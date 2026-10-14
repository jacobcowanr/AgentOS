#!/usr/bin/env python3
"""AgentOS web shell server — loopback only.

GET  /api/state              crew, kanban, curator/skills, oracle watchers, catalog events
GET  /api/models[?refresh=1] live model catalog (free tiers across providers + custom)
GET  /api/providers          provider status (never returns keys)
GET  /api/search?q=          web search (Exa)
GET  /api/read?url=          fetch a page and return a readable version
GET  /api/news[?refresh=1]   Hermes Oracle: AI news feeds + HF trending + new free models
POST /api/chat               SSE stream  {provider, model, messages, web, voice}
POST /api/models/test        {provider, model} -> quick ping, result cached
POST /api/providers          add/replace a custom OpenAI-compatible provider
POST /api/providers/delete   {id}
POST /api/dispatch           {"task": "...", "dry": bool} -> agentos-dispatch
All POSTs need the X-AgentOS: 1 header; every request must target 127.0.0.1/localhost.
"""
import json, os, re, sqlite3, subprocess, sys, time, threading, getpass, ipaddress, socket
import urllib.request, urllib.parse, urllib.error
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
from datetime import datetime
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import yaml

HOME = Path.home()
HERE = Path(__file__).resolve().parent
HERMES = HOME / ".hermes"
PORT = int(os.environ.get("AGENTOS_PORT", "9120"))
CATALOG = HERMES / "agentos" / "catalog.yaml"
DATA = HERMES / "agentos" / "data"
DATA.mkdir(parents=True, exist_ok=True)
CUSTOM = DATA / "providers.json"          # custom providers (may hold keys -> chmod 600)
CATSTATE = DATA / "catalog_state.json"    # first_seen per model + test results
DB = HERMES / "kanban.db"
SKILLS = HERMES / "skills"
HBIN = str(HOME / ".local" / "bin" / "hermes")
ENV = {**os.environ, "PATH": f"{HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"}
ENV.pop("AGENTOS_ACTIVE", None); ENV.pop("HERMES_KANBAN_TASK", None); ENV.pop("HERMES_HOME", None)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 AgentOS/2"

PERSONA = ("You are AgentOS, Jacob's personal AI operating system — calm, precise and quietly witty, in the spirit of JARVIS. "
           "You run locally on his Mac and front a crew of Hermes agents (orchestrator, research, writer, developer, auditor, librarian) "
           "plus an AI Factory that keeps improving their skills. Be direct and useful. Never invent facts; if unsure, say so. "
           "Facts about your own system (do not contradict or embellish): Hermes Agent by Nous Research is the agent runtime; "
           "new skills are taught with the /learn command (from a URL, a folder, or the current chat); the curator (the AI Factory) "
           "maintains skills on a schedule — marking stale ones and archiving unused ones, never deleting — and can consolidate overlapping skills; "
           "crew tasks are dispatched through a Kanban board where the orchestrator decomposes work; the librarian only runs when Jacob names it; "
           "shared memory lives in his Obsidian vault. If asked how to do something in Hermes you are not sure about, say so and suggest checking the Hermes docs. "
           "Today is {date}.")
VOICE_RULES = ("This reply will be spoken aloud. Use plain conversational English: no markdown, no bullet symbols, no URLs, no code. "
               "Keep it under 70 words unless Jacob explicitly asks for detail.")

_cache = {}
def cached(key, ttl, fn):
    now = time.time(); hit = _cache.get(key)
    if hit and now - hit[0] < ttl: return hit[1]
    try: val = fn()
    except Exception as e: val = hit[1] if hit else {"error": str(e)}
    _cache[key] = (now, val); return val

def run(args, timeout=25):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, env=ENV).stdout

def keys():
    out = {}
    p = HERMES / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line: continue
            k, v = line.split("=", 1)
            out[k.replace("export ", "").strip()] = v.strip().strip('"').strip("'")
    return out

def http_json(url, headers=None, data=None, timeout=20):
    h = {"User-Agent": UA, **(headers or {})}
    if data is not None and not isinstance(data, bytes):
        data = json.dumps(data).encode(); h.setdefault("Content-Type", "application/json")
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=timeout) as r:
        return json.load(r)

def err_text(e):
    if isinstance(e, urllib.error.HTTPError):
        try: body = e.read().decode(errors="replace")[:300]
        except Exception: body = ""
        m = re.search(r'"message"\s*:\s*"([^"]+)"', body) or re.search(r'"error"\s*:\s*"([^"]+)"', body) or re.search(r'"detail"\s*:\s*"([^"]+)"', body)
        return f"HTTP {e.code}: {m.group(1) if m else body[:160]}"
    return f"{type(e).__name__}: {e}"

# ---------------------------------------------------------------- crew / factory (unchanged)
def age_days(s):
    s = s.strip()
    if s == "never": return None
    m = re.match(r"(\d+)([smhdw])", s)
    if not m: return None
    n, u = int(m.group(1)), m.group(2)
    return n * {"s": 1/86400, "m": 1/1440, "h": 1/24, "d": 1, "w": 7}[u]

def crew():
    bots = yaml.safe_load(CATALOG.read_text())["bots"]
    return {name: {"name": name, "role": c.get("role", ""), "triggers": c.get("triggers", []),
                   "never_auto": bool(c.get("never_auto")), "counts": {}, "current": None} for name, c in bots.items()}

def kanban():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=3)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT id,title,assignee,status,created_at,started_at,completed_at,last_failure_error "
                       "FROM tasks WHERE status!='archived' ORDER BY created_at DESC LIMIT 60").fetchall()
    con.close()
    return [dict(r) for r in rows]

def curator():
    st = {}
    p = SKILLS / ".curator_state"
    if p.exists(): st = json.loads(p.read_text())
    txt = run([HBIN, "curator", "status"])
    def g(rx, d=None):
        m = re.search(rx, txt, re.M); return m.group(1).strip() if m else d
    info = {
        "enabled": "ENABLED" in txt.split("\n")[0], "paused": bool(st.get("paused")),
        "runs": st.get("run_count"), "last_run_at": st.get("last_run_at"),
        "summary": st.get("last_run_summary"), "interval": g(r"interval:\s+(.*)"),
        "stale_after": g(r"stale after:\s+(.*)"), "archive_after": g(r"archive after:\s+(.*)"),
        "consolidate": (g(r"consolidate:\s+(\w+)") == "on"),
        "active": int(g(r"^\s+active\s+(\d+)", 0)), "stale": int(g(r"^\s+stale\s+(\d+)", 0)),
        "archived": int(g(r"^\s+archived\s+(\d+)", 0)),
    }
    ledger = []
    lp = SKILLS / ".curator_ledger.jsonl"
    if lp.exists():
        for line in lp.read_text().splitlines()[-14:]:
            try:
                d = json.loads(line); ledger.append({"ts": d.get("ts"), "action": d.get("action"), "skill": d.get("skill"), "actor": d.get("actor")})
            except Exception: pass
    info["ledger"] = ledger[::-1]
    return info

def skills():
    txt = run([HBIN, "curator", "usage"])
    out = []
    for line in txt.splitlines():
        m = re.match(r"^\s{2}(\S+)\s+(agent|bundled|hub|external)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*)$", line)
        if m:
            d = age_days(m.group(7))
            out.append({"name": m.group(1), "origin": m.group(2), "use": int(m.group(3)), "patch": int(m.group(5)),
                        "act": int(m.group(6)), "last": m.group(7).strip(), "dormant": d is None or d >= 14})
    return out

def oracle_watchers():
    res = []
    for key, label in [("openrouter_free", "OpenRouter free models"), ("hf_models", "HF trending models"), ("hf_spaces", "HF trending spaces")]:
        p = HERMES / "scripts" / f"oracle_{key}.state.json"
        if p.exists():
            res.append({"label": label, "tracked": len(json.loads(p.read_text()).get("seen", [])), "checked": p.stat().st_mtime})
    p = HERMES / "scripts" / "oracle_hermes_docs.state.json"
    if p.exists(): res.append({"label": "Hermes docs", "tracked": None, "checked": p.stat().st_mtime})
    return res

def gateway_up():
    return subprocess.run(["pgrep", "-f", "gateway run"], capture_output=True).returncode == 0

def state():
    c = crew(); tasks = cached("kanban", 2, kanban)
    if isinstance(tasks, list):
        for t in tasks:
            b = c.get(t["assignee"])
            if b:
                b["counts"][t["status"]] = b["counts"].get(t["status"], 0) + 1
                if t["status"] == "running" and not b["current"]: b["current"] = t["title"]
    else:
        tasks = []
    return {"now": time.time(), "crew": list(c.values()), "tasks": tasks,
            "gateway": cached("gw", 5, gateway_up),
            "curator": cached("curator", 30, curator), "skills": cached("skills", 60, skills),
            "oracle": cached("oracle", 30, oracle_watchers),
            "catalog": {"refreshed": CAT["refreshed"], "events": CAT["events"][-25:]}}

# ---------------------------------------------------------------- providers + live model catalog
# tier: "pricing" = free only when price is 0 · "free" = provider free tier · "credits" = monthly free credits
BUILTIN = [
    {"id": "nous", "name": "Nous Portal", "base": "https://inference-api.nousresearch.com/v1", "key": "NOUS_API_KEY", "tier": "pricing"},
    {"id": "openrouter", "name": "OpenRouter", "base": "https://openrouter.ai/api/v1", "key": "OPENROUTER_API_KEY", "tier": "pricing"},
    {"id": "huggingface", "name": "Hugging Face", "base": "https://router.huggingface.co/v1", "key": "HF_TOKEN", "tier": "credits"},
    {"id": "cerebras", "name": "Cerebras", "base": "https://api.cerebras.ai/v1", "key": "CEREBRAS_API_KEY", "tier": "free"},
    {"id": "google", "name": "Google Gemini", "base": "https://generativelanguage.googleapis.com/v1beta/openai", "key": "GOOGLE_API_KEY", "tier": "free"},
    {"id": "mistral", "name": "Mistral", "base": "https://api.mistral.ai/v1", "key": "MISTRAL_API_KEY", "tier": "free"},
    {"id": "nvidia", "name": "NVIDIA NIM", "base": "https://integrate.api.nvidia.com/v1", "key": "NVIDIA_API_KEY", "tier": "free"},
    {"id": "groq", "name": "Groq", "base": "https://api.groq.com/openai/v1", "key": "GROQ_API_KEY", "tier": "free"},
]
HERMES_AGENT = {"key": "hermes::agent", "provider": "hermes", "id": "agent", "name": "Hermes Agent — tools, web, crew",
                "ctx": None, "free": True, "tier": "agent", "first_seen": 0, "new": False,
                "desc": "Full Hermes agent loop (web search, terminal, skills) on your default Hermes model. Slower, can act."}
NONCHAT = re.compile(r"embed|rerank|tts|whisper|transcri|speech|audio|asr|guard|safety|reward|imagen|veo|image-gen|moderation|"
                     r"retriev|ocr|fim|aqa|:batch|lyria|robotics|native-audio|-live|-image|computer-use|deplot|kosmos|nv-clip|parse|detector|"
                     r"(?<![a-z])clip|text-bison|chat-bison|gecko|cosmos|sdxl|stable-diffusion|flux", re.I)
CAT = {"models": [], "providers": {}, "refreshed": 0, "events": [], "lock": threading.Lock(), "busy": False}
NEW_DAYS = 7

def load_json(p, default):
    try: return json.loads(p.read_text())
    except Exception: return default

def save_json(p, data, private=False):
    tmp = p.with_suffix(".tmp"); tmp.write_text(json.dumps(data, indent=1))
    if private: os.chmod(tmp, 0o600)
    tmp.replace(p)

def custom_providers():
    return load_json(CUSTOM, [])

def all_providers():
    cust = {c["id"]: c for c in custom_providers()}
    ids = {b["id"] for b in BUILTIN}
    out = [{**b, "api_key": cust[b["id"]]["api_key"], "override": True} if cust.get(b["id"], {}).get("api_key") else b for b in BUILTIN]
    return out + [{**c, "custom": True} for c in cust.values() if c["id"] not in ids]

def provider(pid):
    return next((p for p in all_providers() if p["id"] == pid), None)

def provider_key(p, env=None):
    if p.get("api_key"): return p["api_key"]
    if p.get("key"): return (env or keys()).get(p["key"], "")
    return ""

def list_models(p, env):
    k = provider_key(p, env)
    if p.get("key") and not k and not p.get("api_key") and p["id"] != "openrouter":
        raise LookupError(f"no key ({p['key']} not in ~/.hermes/.env)")
    h = {"Authorization": f"Bearer {k}"} if k else {}
    d = http_json(p["base"].rstrip("/") + "/models", h, timeout=20)
    data = d.get("data", d) if isinstance(d, dict) else d
    out = []
    for m in data or []:
        mid = str(m.get("id") or m.get("name") or "").removeprefix("models/")
        if not mid or NONCHAT.search(mid): continue
        arch = m.get("architecture") or {}
        if isinstance(arch, dict) and arch.get("output_modalities") and "text" not in arch["output_modalities"]: continue
        price = m.get("pricing") or {}
        tier = p.get("tier", "paid")
        if tier == "pricing":
            free = str(price.get("prompt")) in ("0", "0.0") and str(price.get("completion")) in ("0", "0.0")
            t = "free" if free else "paid"
        elif tier == "credits": free, t = True, "credits"
        elif tier == "free": free, t = True, "free-tier"
        else: free, t = False, "paid"
        ctx = m.get("context_length") or (m.get("top_provider") or {}).get("context_length")
        if not ctx and m.get("providers"):
            ctx = max((x.get("context_length") or 0) for x in m["providers"]) or None
        out.append({"key": f"{p['id']}::{mid}", "provider": p["id"], "id": mid, "name": m.get("name") or mid,
                    "ctx": ctx, "free": free, "tier": t, "desc": (m.get("description") or "")[:220]})
    return out

def refresh_catalog(force=False):
    with CAT["lock"]:
        if CAT["busy"] or (not force and time.time() - CAT["refreshed"] < 1800 and CAT["models"]): return
        CAT["busy"] = True
    try:
        env = keys(); provs = all_providers()
        st = load_json(CATSTATE, {})
        baseline = "first_seen" not in st
        seen = st.setdefault("first_seen", {}); tests = st.setdefault("tests", {})
        now = time.time(); models = []; pstat = {}
        def one(p):
            t0 = time.time()
            try:
                ms = list_models(p, env)
                return p, ms, {"ok": True, "count": len(ms), "free": sum(m["free"] for m in ms), "ms": int((time.time()-t0)*1000)}
            except Exception as e:
                return p, [], {"ok": False, "count": 0, "free": 0, "error": err_text(e) if not isinstance(e, LookupError) else str(e)}
        with ThreadPoolExecutor(8) as ex:
            for p, ms, s in ex.map(one, provs):
                prev = CAT["providers"].get(p["id"], {})
                s.update({"id": p["id"], "name": p["name"], "base": p["base"], "tier": p.get("tier"), "custom": bool(p.get("custom")), "override": bool(p.get("override")),
                          "key_name": p.get("key"), "has_key": bool(provider_key(p, env)), "ts": now})
                if not s["ok"] and prev.get("ok"):          # keep last good list on a transient failure
                    ms = [m for m in CAT["models"] if m["provider"] == p["id"]]; s["stale"] = True
                pstat[p["id"]] = s; models.extend(ms)
        new_events = []
        for m in models:
            if m["key"] not in seen:
                seen[m["key"]] = 0 if baseline else now
                if not baseline and m["free"]:
                    new_events.append({"ts": now, "type": "new_model", "key": m["key"], "provider": m["provider"], "model": m["id"]})
            m["first_seen"] = seen[m["key"]]
            m["new"] = bool(m["first_seen"]) and now - m["first_seen"] < NEW_DAYS * 86400
            m["test"] = tests.get(m["key"])
        models.sort(key=lambda m: (not m["free"], not m["new"], m["provider"], m["id"].lower()))
        save_json(CATSTATE, st)
        CAT.update(models=[{**HERMES_AGENT}] + models, providers=pstat, refreshed=now)
        CAT["events"] = (CAT["events"] + new_events)[-100:]
    finally:
        CAT["busy"] = False

def record_test(key, result):
    st = load_json(CATSTATE, {})
    st.setdefault("tests", {})[key] = result
    save_json(CATSTATE, st)
    for m in CAT["models"]:
        if m["key"] == key: m["test"] = result

def catalog_loop():
    while True:
        try: refresh_catalog()
        except Exception as e: print("catalog refresh failed:", e, file=sys.stderr)
        time.sleep(600)

# ---------------------------------------------------------------- chat (OpenAI-compatible streaming + Hermes agent)
def chat_request(p, model, messages, stream=True, max_tokens=4000, extra=None):
    env = keys(); k = provider_key(p, env)
    body = {"model": model, "messages": messages, "stream": stream, "max_tokens": max_tokens, **(extra or {})}
    h = {"Content-Type": "application/json", "User-Agent": UA}
    if k: h["Authorization"] = f"Bearer {k}"
    if p["id"] == "nous": body["tags"] = ["product=agentos", f"user={getpass.getuser()}"]
    if p["id"] == "openrouter": h.update({"HTTP-Referer": "http://127.0.0.1:9120", "X-Title": "AgentOS"})
    return urllib.request.Request(p["base"].rstrip("/") + "/chat/completions", data=json.dumps(body).encode(), headers=h)

def stream_openai(p, model, messages, emit):
    got, finish = False, None
    with urllib.request.urlopen(chat_request(p, model, messages, max_tokens=16000), timeout=300) as r:
        thinking = 0
        for raw in r:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"): continue
            payload = line[5:].strip()
            if payload == "[DONE]": break
            try: d = json.loads(payload)
            except Exception: continue
            if d.get("error"): raise RuntimeError(str(d["error"].get("message") if isinstance(d["error"], dict) else d["error"]))
            ch = (d.get("choices") or [{}])[0]; dl = ch.get("delta") or ch.get("message") or {}
            rs = dl.get("reasoning") or dl.get("reasoning_content") or ""
            if rs:
                thinking += len(rs); emit({"type": "thinking", "n": thinking})
            if dl.get("content"): got = True; emit({"type": "delta", "text": dl["content"]})
            finish = ch.get("finish_reason") or finish
    if not got:
        raise RuntimeError("the model finished without an answer" + (" — it ran out of tokens while reasoning" if finish == "length" else "")
                           + ". Try again or pick a faster model.")

def stream_hermes(messages, emit):
    convo = [m for m in messages if m["role"] in ("user", "assistant")][-10:]
    sys_extra = "\n".join(m["content"] for m in messages if m["role"] == "system" and "spoken aloud" in m["content"])
    if len(convo) > 1:
        hist = "\n".join(f"{'Jacob' if m['role']=='user' else 'AgentOS'}: {m['content'][:1500]}" for m in convo[:-1])
        prompt = f"Conversation so far (for context):\n{hist}\n\nJacob's new message: {convo[-1]['content']}"
    else:
        prompt = convo[-1]["content"] if convo else ""
    if sys_extra: prompt += "\n\n" + sys_extra
    proc = subprocess.Popen([HBIN, "-z", prompt], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=ENV, cwd=str(HOME))
    timer = threading.Timer(420, proc.kill); timer.start()
    try:
        emit({"type": "status", "text": "Hermes agent working…"})
        while True:
            chunk = proc.stdout.read1(512) if hasattr(proc.stdout, "read1") else proc.stdout.read(512)
            if not chunk: break
            emit({"type": "delta", "text": chunk.decode("utf-8", "replace")})
        proc.wait()
        if proc.returncode not in (0, None): raise RuntimeError(f"hermes exited {proc.returncode}")
    finally:
        timer.cancel()
        if proc.poll() is None: proc.kill()

# ---------------------------------------------------------------- ghost-text suggestions (fast free models, first that answers wins)
# benchmarked 2026-10-14: cerebras gpt-oss-120b (low effort) ~0.3s, nous solar-mini4 ~1.0s, mistral ministral-8b ~0.7s
SUGGEST_MODELS = [("cerebras", "gpt-oss-120b", {"reasoning_effort": "low"}), ("nous", "upstage/solar-mini4:free", {}),
                  ("mistral", "ministral-8b-latest", {})]
SUGGEST_KIND = {
    "voice": "a command bar for a JARVIS-style assistant (it can chat, search the web, open pages, brief AI news, dispatch tasks to a crew of agents, switch models)",
    "chat": "a chat with an AI assistant",
    "browser": "a web browser address bar (search queries or URLs)",
    "page": "a question about the web page currently open",
    "crew": "a task to dispatch to a crew of AI agents (research, writer, developer, auditor, orchestrator)",
}
def suggest(text, kind, context):
    ctx = "\n".join(f"{m.get('role','user')}: {str(m.get('content',''))[:600]}" for m in (context or [])[-6:])
    if text.strip():
        task = ("Continue the user's partially typed input with the most likely ending. Reply with ONLY the characters to append "
                "(include a leading space if the next word needs one). At most 12 words. No quotes, no explanation. "
                "If it already reads as complete, reply with nothing.")
    else:
        task = ("Predict the single most likely next message the user will type. Reply with ONLY that message, at most 12 words, "
                "no quotes, no explanation. Make it specific to the conversation.")
    prompt = (f"Input surface: {SUGGEST_KIND.get(kind, SUGGEST_KIND['chat'])}.\n"
              + (f"Recent context:\n{ctx}\n" if ctx else "") + f"\nTyped so far: <<{text}>>\n\n{task}")
    last = None
    for pid, model, extra in SUGGEST_MODELS:
        p = provider(pid)
        if not p or not provider_key(p): continue
        try:
            with urllib.request.urlopen(chat_request(p, model, [{"role": "user", "content": prompt}], stream=False, max_tokens=700, extra=extra), timeout=8) as r:
                j = json.load(r)
            out = (((j.get("choices") or [{}])[0].get("message") or {}).get("content") or "")
            out = next((l for l in out.split("\n") if l.strip()), "").replace("<<", "").replace(">>", "")
            lead = out[:1] == " "
            out = out.strip().strip('"\u201c\u201d\'`').rstrip()
            if re.search(r"\[[^\]]*\]", out): out = ""                             # template placeholders like [topic] are useless
            if text:
                low, tl = out.lower(), text.lower()
                cut = next((n for n in range(min(len(tl), len(low)), 0, -1) if tl.endswith(low[:n])), 0)  # strip echoed overlap
                if cut and (cut >= 3 or cut == len(low)): out = out[cut:]; lead = out[:1] == " "; out = out.strip()
                if out and not text.endswith(" ") and (lead or text[-1:].isalnum() is False or cut): out = " " + out
                elif out and not text.endswith(" ") and not lead and re.match(r"\w", out) and text[-1:].isalnum():
                    # model continued mid-word only if the last typed token looks unfinished; otherwise add a space
                    out = (" " + out) if re.search(r"\b\w{3,}$", text) and not re.match(r"[a-z]{1,3}\b", out) else out
            return {"suggestion": out[:120], "model": f"{pid}::{model}"}
        except Exception as e:
            last = err_text(e)
    return {"suggestion": "", "error": last or "no suggestion model available"}

# ---------------------------------------------------------------- web: search + reader
def web_search(q, n=8):
    def go():
        k = keys().get("EXA_AI_API_KEY")
        if not k: raise RuntimeError("EXA_AI_API_KEY is not set in ~/.hermes/.env")
        d = http_json("https://api.exa.ai/search", {"x-api-key": k},
                      {"query": q, "numResults": n, "contents": {"text": {"maxCharacters": 1500}}}, timeout=25)
        return [{"title": r.get("title") or r.get("url"), "url": r.get("url"), "published": r.get("publishedDate"),
                 "text": re.sub(r"\s+", " ", r.get("text") or "")[:1500]} for r in d.get("results", [])]
    return cached("search:" + q.lower().strip() + f":{n}", 600, go)

def public_host(host):
    try: infos = socket.getaddrinfo(host, None)
    except socket.gaierror: raise ValueError(f"cannot resolve {host}")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            raise ValueError("refusing to open a private/local address")
    return True

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        u = urllib.parse.urlparse(newurl)
        if u.scheme not in ("http", "https"): raise ValueError("bad redirect")
        public_host(u.hostname or "")
        return super().redirect_request(req, fp, code, msg, headers, newurl)
OPENER = urllib.request.build_opener(SafeRedirect)

BLOCK = {"h1", "h2", "h3", "h4", "h5", "p", "li", "pre", "blockquote", "figcaption", "dt", "dd", "td", "th"}
SKIP = {"script", "style", "noscript", "svg", "nav", "footer", "header", "aside", "form", "iframe", "template", "button", "select", "dialog"}
VOID = {"br", "img", "hr", "input", "meta", "link", "source", "wbr", "area", "col", "embed", "param", "track"}

class Reader(HTMLParser):
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base = base; self.title = ""; self.desc = ""
        self.skip = 0; self.main = 0; self.in_title = False
        self.blocks = []; self.cur = None; self.href = None; self.stack = []
    def _flush(self):
        b = self.cur; self.cur = None
        if not b: return
        segs, txt = [], ""
        for s in b["s"]:
            t = re.sub(r"\s+", " ", s[0])
            if not t.strip():
                if segs and t: segs[-1][0] += " "
                continue
            if len(s) == 1 and segs and len(segs[-1]) == 1: segs[-1][0] += t
            else: segs.append([t] + s[1:])
            txt += t
        if len(txt.strip()) >= 2:
            if segs: segs[0][0] = segs[0][0].lstrip(); segs[-1][0] = segs[-1][0].rstrip()
            self.blocks.append({"t": b["t"], "s": segs, "main": b["main"], "n": len(txt)})
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in VOID: self.stack.append(tag)
        if tag == "title": self.in_title = True
        if tag == "meta" and (a.get("name") or a.get("property") or "").lower() in ("description", "og:description") and not self.desc:
            self.desc = (a.get("content") or "")[:400]
        if tag in SKIP: self.skip += 1; return
        if tag in ("main", "article"): self.main += 1
        if self.skip: return
        if tag in BLOCK:
            self._flush(); self.cur = {"t": tag if tag in ("h1","h2","h3","h4","pre","blockquote","li") else "p", "s": [], "main": self.main > 0}
        elif tag == "br" and self.cur: self.cur["s"].append(["\n" if self.cur["t"] == "pre" else " "])
        elif tag == "a":
            h = a.get("href") or ""
            if h and not h.startswith(("javascript:", "#", "mailto:")): self.href = urllib.parse.urljoin(self.base, h)
    def handle_endtag(self, tag):
        if tag in VOID: return
        while self.stack:
            t = self.stack.pop()
            if t in SKIP and self.skip: self.skip -= 1
            if t in ("main", "article") and self.main: self.main -= 1
            if t == tag: break
        if tag == "title": self.in_title = False
        if tag == "a": self.href = None
        if tag in BLOCK: self._flush()
    def handle_data(self, data):
        if self.in_title: self.title += data; return
        if self.skip: return
        if self.cur is None:
            if not data.strip(): return
            self.cur = {"t": "p", "s": [], "main": self.main > 0}
        self.cur["s"].append([data, self.href] if self.href else [data])

def read_page(url):
    u = urllib.parse.urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname: raise ValueError("only http(s) URLs")
    public_host(u.hostname)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5",
                                               "Accept-Language": "en-US,en;q=0.9"})
    with OPENER.open(req, timeout=20) as r:
        final = r.geturl(); ctype = r.headers.get("Content-Type", "")
        raw = r.read(4_000_000)
        cs = r.headers.get_content_charset() or "utf-8"
    text = raw.decode(cs, "replace")
    if "html" not in ctype and "xml" not in ctype:
        if ctype.startswith("text/"):
            blocks = [{"t": "pre", "s": [[text[:60000]]], "main": True, "n": len(text)}]
            return {"url": final, "title": final, "desc": "", "blocks": blocks, "text": text[:14000]}
        raise ValueError(f"not a web page ({ctype or 'unknown type'}) — open it in Chrome instead")
    rd = Reader(final); rd.feed(text); rd._flush()
    blocks = rd.blocks
    main = [b for b in blocks if b["main"]]
    if sum(b["n"] for b in main) > 600: blocks = main
    blocks = blocks[:700]
    plain = "\n".join("".join(s[0] for s in b["s"]) for b in blocks)
    for b in blocks: b.pop("main", None); b.pop("n", None)
    return {"url": final, "title": re.sub(r"\s+", " ", rd.title).strip() or final, "desc": rd.desc, "blocks": blocks, "text": plain[:14000]}

# ---------------------------------------------------------------- Hermes Oracle: AI news
FEEDS = [
    ("Hacker News", "https://hnrss.org/newest?q=AI+OR+LLM&points=50"),
    ("Hugging Face", "https://huggingface.co/blog/feed.xml"),
    ("OpenAI", "https://openai.com/news/rss.xml"),
    ("Google AI", "https://blog.google/technology/ai/rss/"),
    ("DeepMind", "https://deepmind.google/blog/rss.xml"),
    ("The Verge", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    ("TechCrunch", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("MarkTechPost", "https://www.marktechpost.com/feed/"),
    ("Simon Willison", "https://simonwillison.net/atom/everything/"),
]
TAGRX = re.compile(r"<[^>]+>")

def _ts(s):
    if not s: return 0
    s = s.strip()
    try: return parsedate_to_datetime(s).timestamp()
    except Exception: pass
    try: return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception: return 0

def parse_feed(name, xml):
    root = ET.fromstring(xml)
    for el in root.iter():
        if isinstance(el.tag, str) and "}" in el.tag: el.tag = el.tag.split("}", 1)[1]
    items = []
    for it in list(root.iter("item")) + list(root.iter("entry")):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        if not link:
            for l in it.findall("link"):
                if l.get("rel") in (None, "alternate") and l.get("href"): link = l.get("href"); break
        date = it.findtext("pubDate") or it.findtext("published") or it.findtext("updated") or it.findtext("date")
        summ = it.findtext("description") or it.findtext("summary") or it.findtext("content") or ""
        summ = re.sub(r"\s+", " ", TAGRX.sub(" ", summ)).strip()
        import html as _h
        if title and link:
            items.append({"title": _h.unescape(title)[:240], "link": link, "source": name, "ts": _ts(date), "summary": _h.unescape(summ)[:300]})
    return items

def news():
    def one(f):
        name, url = f
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=15) as r: xml = r.read(3_000_000)
            its = sorted(parse_feed(name, xml), key=lambda x: -x["ts"])[:15]
            return name, its, None
        except Exception as e:
            return name, [], err_text(e)
    items, sources = [], []
    with ThreadPoolExecutor(9) as ex:
        for name, its, err in ex.map(one, FEEDS):
            items += its; sources.append({"name": name, "count": len(its), "error": err})
    seen, uniq = set(), []
    for it in sorted(items, key=lambda x: -x["ts"]):
        k = re.sub(r"\W+", "", it["title"].lower())[:60]
        if k in seen: continue
        seen.add(k); uniq.append(it)
    try:
        hf = http_json("https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=16", timeout=15)
        trending = [{"id": m["id"], "likes": m.get("likes"), "downloads": m.get("downloads"), "task": m.get("pipeline_tag"),
                     "url": f"https://huggingface.co/{m['id']}"} for m in hf]
    except Exception as e:
        trending = []; sources.append({"name": "HF trending", "count": 0, "error": err_text(e)})
    return {"items": uniq[:150], "sources": sources, "trending": trending, "fetched": time.time()}

def news_loop():
    while True:
        time.sleep(900)
        try: _cache["news"] = (time.time(), news())
        except Exception: pass

# ---------------------------------------------------------------- HTTP
STATIC = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2"}

class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a): pass
    def _host_ok(self):
        return self.headers.get("Host", "").split(":")[0] in ("127.0.0.1", "localhost")
    def _send(self, code, body, ctype="application/json"):
        b = body if isinstance(body, bytes) else (body if isinstance(body, str) else json.dumps(body)).encode()
        self.send_response(code); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(b)
    def _json_body(self):
        n = int(self.headers.get("Content-Length", 0) or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}
    def _q(self):
        return {k: v[0] for k, v in urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).items()}

    def do_GET(self):
        if not self._host_ok(): return self._send(403, {"error": "forbidden"})
        path = urllib.parse.urlparse(self.path).path; q = self._q()
        try:
            if path == "/api/state": return self._send(200, state())
            if path == "/api/models":
                if q.get("refresh") or not CAT["models"]: refresh_catalog(force=bool(q.get("refresh")))
                return self._send(200, {"models": CAT["models"], "providers": list(CAT["providers"].values()), "refreshed": CAT["refreshed"]})
            if path == "/api/providers":
                return self._send(200, {"providers": list(CAT["providers"].values())})
            if path == "/api/search":
                qq = q.get("q", "").strip()[:400]
                if not qq: return self._send(400, {"error": "empty query"})
                res = web_search(qq, int(q.get("n", 8)))
                if isinstance(res, dict) and res.get("error"): return self._send(502, res)
                return self._send(200, {"q": qq, "results": res})
            if path == "/api/read":
                return self._send(200, read_page(q.get("url", "")))
            if path == "/api/news":
                if q.get("refresh"): _cache.pop("news", None)
                return self._send(200, cached("news", 900, news))
        except Exception as e:
            return self._send(502, {"error": err_text(e)})
        if path == "/": path = "/index.html"
        f = (HERE / path.lstrip("/")).resolve()
        if HERE in f.parents and f.suffix in STATIC and f.is_file():
            return self._send(200, f.read_bytes(), STATIC[f.suffix])
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self._host_ok() or self.headers.get("X-AgentOS") != "1":
            return self._send(403, {"error": "forbidden"})
        path = urllib.parse.urlparse(self.path).path
        try:
            d = self._json_body()
            if path == "/api/chat": return self.chat(d)
            if path == "/api/dispatch":
                task = str(d.get("task", "")).strip()[:2000]
                if not task: return self._send(400, {"error": "empty task"})
                args = [str(HOME / ".local/bin/agentos-dispatch")] + (["--dry-run"] if d.get("dry") else []) + [task]
                p = subprocess.run(args, capture_output=True, text=True, timeout=60, env=ENV)
                return self._send(200, {"ok": p.returncode == 0, "out": (p.stdout + p.stderr).strip()})
            if path == "/api/models/test": return self.test_model(d)
            if path == "/api/suggest":
                text = str(d.get("text", ""))[:600]; kind = str(d.get("kind", "chat"))
                ctx = d.get("context") if isinstance(d.get("context"), list) else []
                key = "sg:" + kind + ":" + text + ":" + json.dumps(ctx[-2:])[:400]
                return self._send(200, cached(key, 300, lambda: suggest(text, kind, ctx)))
            if path == "/api/providers": return self.add_provider(d)
            if path == "/api/providers/delete":
                pid = str(d.get("id", ""))
                save_json(CUSTOM, [c for c in custom_providers() if c["id"] != pid], private=True)
                if any(b["id"] == pid for b in BUILTIN): refresh_catalog(force=True)   # key override removed -> fall back to env
                else: CAT["providers"].pop(pid, None); CAT["models"] = [m for m in CAT["models"] if m["provider"] != pid]
                return self._send(200, {"ok": True})
        except Exception as e:
            return self._send(500, {"error": err_text(e)})
        self._send(404, {"error": "not found"})

    def add_provider(self, d):
        name = str(d.get("name", "")).strip()[:40]; base = str(d.get("base", "")).strip().rstrip("/")
        pid = re.sub(r"[^a-z0-9]+", "-", (d.get("id") or name).lower()).strip("-")[:30]
        if not name or not pid or not re.match(r"^https?://", base): return self._send(400, {"error": "name and an http(s) base URL are required"})
        if any(b["id"] == pid for b in BUILTIN):          # built-in: only store a pasted key override
            if not d.get("api_key"): return self._send(400, {"error": f"'{pid}' is built in — paste a key, or add its env var to ~/.hermes/.env"})
            save_json(CUSTOM, [c for c in custom_providers() if c["id"] != pid] + [{"id": pid, "api_key": str(d["api_key"]).strip()}], private=True)
            refresh_catalog(force=True)
            return self._send(200, {"ok": True, "provider": CAT["providers"].get(pid)})
        entry = {"id": pid, "name": name, "base": base, "tier": "free" if d.get("free") else "paid"}
        if d.get("key_name"): entry["key"] = re.sub(r"[^A-Z0-9_]", "", str(d["key_name"]).upper())
        if d.get("api_key"): entry["api_key"] = str(d["api_key"]).strip()
        save_json(CUSTOM, [c for c in custom_providers() if c["id"] != pid] + [entry], private=True)
        refresh_catalog(force=True)
        return self._send(200, {"ok": True, "provider": CAT["providers"].get(pid)})

    def test_model(self, d):
        key = f"{d.get('provider')}::{d.get('model')}"
        p = provider(str(d.get("provider")))
        if not p: return self._send(404, {"error": "unknown provider"})
        t0 = time.time()
        try:
            with urllib.request.urlopen(chat_request(p, d["model"], [{"role": "user", "content": "Reply with the single word: ready"}],
                                                     stream=False, max_tokens=600), timeout=90) as r:
                j = json.load(r)
            msg = ((j.get("choices") or [{}])[0].get("message") or {})
            out = (msg.get("content") or "").strip()
            res = {"ok": True, "ms": int((time.time()-t0)*1000), "ts": time.time(), "reply": out[:80]}
        except Exception as e:
            res = {"ok": False, "ms": int((time.time()-t0)*1000), "ts": time.time(), "error": err_text(e)}
        record_test(key, res)
        return self._send(200, res)

    def chat(self, d):
        pid, model = str(d.get("provider", "")), str(d.get("model", ""))
        msgs = [{"role": m.get("role"), "content": str(m.get("content", ""))[:20000]} for m in (d.get("messages") or [])[-30:]
                if m.get("role") in ("user", "assistant", "system")]
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream"); self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close"); self.end_headers()
        self.close_connection = True
        def emit(ev):
            self.wfile.write(f"data: {json.dumps(ev)}\n\n".encode()); self.wfile.flush()
        t0 = time.time()
        try:
            sysmsgs = [{"role": "system", "content": PERSONA.format(date=time.strftime("%A %B %-d, %Y"))}]
            if d.get("voice"): sysmsgs.append({"role": "system", "content": VOICE_RULES})
            last_user = next((m["content"] for m in reversed(msgs) if m["role"] == "user"), "")
            if d.get("web") and last_user and pid != "hermes":
                emit({"type": "status", "text": "Searching the web…"})
                res = web_search(last_user[:400], 6)
                if isinstance(res, list) and res:
                    emit({"type": "sources", "items": [{"title": r["title"], "url": r["url"]} for r in res]})
                    ctx = "\n\n".join(f"[{i+1}] {r['title']} ({r['url']})\n{r['text'][:1100]}" for i, r in enumerate(res))
                    sysmsgs.append({"role": "system", "content": "Live web results for the latest question. Ground your answer in them"
                                    + (" (no citations needed when speaking)." if d.get("voice") else " and cite like [1].") + "\n\n" + ctx})
            if d.get("context"):
                sysmsgs.append({"role": "system", "content": "Page the user is looking at:\n" + str(d["context"])[:14000]})
            full = sysmsgs + [m for m in msgs if m["role"] != "system"]
            if pid == "hermes": stream_hermes(full, emit)
            else:
                p = provider(pid)
                if not p: raise ValueError(f"unknown provider '{pid}'")
                emit({"type": "status", "text": "Thinking…"})
                stream_openai(p, model, full, emit)
            emit({"type": "done", "ms": int((time.time()-t0)*1000)})
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as e:
            try: emit({"type": "error", "error": err_text(e)})
            except Exception: pass

if __name__ == "__main__":
    threading.Thread(target=catalog_loop, daemon=True).start()
    threading.Thread(target=news_loop, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H); srv.daemon_threads = True
    srv.serve_forever()
