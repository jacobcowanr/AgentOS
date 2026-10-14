/* AgentOS — app shell: router, voice, chat, browser, Hermes Oracle, models, Team Hermes, AI Factory, ghost text */
"use strict";
const $ = id => document.getElementById(id);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LS = {
  get(k, d){ try{ const v = localStorage.getItem("agentos."+k); return v == null ? d : JSON.parse(v); }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem("agentos."+k, JSON.stringify(v)); }catch{} },
};
const api = {
  async get(p){ const r = await fetch(p); const j = await r.json().catch(()=>({error:"bad response"})); if(!r.ok || j.error) throw new Error(j.error || r.statusText); return j; },
  async post(p, body){
    const r = await fetch(p, {method:"POST", headers:{"Content-Type":"application/json","X-AgentOS":"1"}, body:JSON.stringify(body||{})});
    const j = await r.json().catch(()=>({error:"bad response"})); if(!r.ok) throw new Error(j.error || r.statusText); return j;
  },
};
async function streamChat(body, on, signal){
  const r = await fetch("/api/chat", {method:"POST", headers:{"Content-Type":"application/json","X-AgentOS":"1"}, body:JSON.stringify(body), signal});
  if(!r.ok || !r.body) throw new Error("chat request failed ("+r.status+")");
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "";
  for(;;){
    const {value, done} = await reader.read(); if(done) break;
    buf += dec.decode(value, {stream:true}); let i;
    while((i = buf.indexOf("\n\n")) >= 0){
      const chunk = buf.slice(0, i); buf = buf.slice(i+2);
      if(chunk.startsWith("data:")){ let ev; try{ ev = JSON.parse(chunk.slice(5)); }catch{ continue; } on(ev); }
    }
  }
}
const ago = ts => { if(!ts) return ""; const d = Date.now()/1000 - ts; return d<60?"just now":d<3600?Math.floor(d/60)+"m ago":d<86400?Math.floor(d/3600)+"h ago":Math.floor(d/86400)+"d ago"; };
const fmtCtx = n => !n ? "—" : n >= 1e6 ? (n/1e6).toFixed(n%1e6?1:0)+"M" : Math.round(n/1000)+"K";
const host = u => { try{ return new URL(u).hostname.replace(/^www\./,""); }catch{ return u; } };

/* ---------- icons ---------- */
const ICON = {
  orb:'<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  cog:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  speaker:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  loop:'<path d="M18.2 8.3a5 5 0 1 1 0 7.4L12 12 5.8 8.3a5 5 0 1 0 0 7.4L12 12z"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  back:'<path d="M15 18l-6-6 6-6"/>', fwd:'<path d="M9 18l6-6-6-6"/>',
  reload:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  send:'<path d="M4 12l16-8-6 16-2.5-6.5z"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  code:'<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
  brain:'<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3 3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3 3 3 0 0 1-3-3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  ear:'<path d="M6 9a6 6 0 1 1 12 0c0 3-2 4-3 5.5S14 18 12 19a3 3 0 0 1-4-2"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3.5"/>',
};
const icon = n => `<svg viewBox="0 0 24 24">${ICON[n]||""}</svg>`;
$$("i[data-i]").forEach(i => i.outerHTML = icon(i.dataset.i));

/* ---------- toasts ---------- */
function toast(title, sub="", kind="", onclick=null){
  const t = document.createElement("div");
  t.className = "toast glass " + kind;
  t.innerHTML = `<i class="ti"></i><div>${esc(title)}${sub?`<small>${esc(sub)}</small>`:""}</div>`;
  t.onclick = ()=>{ onclick && onclick(); t.remove(); };
  $("toasts").appendChild(t);
  setTimeout(()=>t.remove(), kind==="bad" ? 9000 : 6500);
  while($("toasts").children.length > 4) $("toasts").firstChild.remove();
}

/* =====================================================================================
   GHOST TEXT — inline suggestions (Tab accepts all, → accepts a word, Esc dismisses)
   Instant local completions (commands, history, models, sites) + fast-model completions
   on pause + next-message prediction after replies.
   ===================================================================================== */
const HIST = { get(k){ return LS.get("hist."+k, []); }, add(k, v){ v = String(v||"").trim(); if(v.length < 3) return; const h = HIST.get(k).filter(x => x.toLowerCase() !== v.toLowerCase()); h.unshift(v); LS.set("hist."+k, h.slice(0, 150)); } };
const ghostCSS = document.createElement("style");
ghostCSS.textContent = `.gt-ghost{position:absolute;pointer-events:none;overflow:hidden;color:transparent;z-index:3;white-space:pre}
.gt-ghost .gs{color:rgba(190,180,240,.42)}.gt-ghost .gk{display:inline-block;margin-left:8px;font:600 9px var(--mono);letter-spacing:.08em;color:var(--dim);border:1px solid var(--line2);border-radius:4px;padding:0 5px;line-height:15px;vertical-align:1px;background:rgba(var(--accent-rgb),.12)}`;
document.head.appendChild(ghostCSS);

class Ghost {
  constructor(el, opt){
    this.el = el; this.opt = opt; this.sug = ""; this.pred = ""; this.reqId = 0; this.timer = null; this.ph = el.placeholder;
    const host = el.parentElement; if(getComputedStyle(host).position === "static") host.style.position = "relative";
    this.g = document.createElement("div"); this.g.className = "gt-ghost"; el.after(this.g);
    el.addEventListener("input", ()=>this.onInput());
    el.addEventListener("keydown", e=>this.onKey(e), true);
    el.addEventListener("focus", ()=>this.paint());
    el.addEventListener("blur", ()=>{ this.g.style.display = "none"; this.restorePh(); });
    el.addEventListener("scroll", ()=>this.paint());
    el.addEventListener("click", ()=>this.paint());
    addEventListener("resize", ()=>this.paint());
  }
  setPrediction(p){ this.pred = (p||"").trim(); if(!this.el.value) this.paint(); }
  restorePh(){ if(this.el.placeholder !== this.ph) this.el.placeholder = this.ph; }
  onInput(){
    const v = this.el.value;
    // keep typing through the current suggestion without flicker
    if(this.sug && this._last != null && v.startsWith(this._last) && this.sug.toLowerCase().startsWith(v.slice(this._last.length).toLowerCase()) && v.length > this._last.length){
      this.sug = this.sug.slice(v.length - this._last.length);
    } else this.sug = "";
    this._last = v;
    if(!this.sug) this.sug = v.trim() ? this.local(v) : "";
    this.paint();
    clearTimeout(this.timer);
    if(!this.sug && v.trim().length >= 3 && this.opt.remote !== false) this.timer = setTimeout(()=>this.remote(v), 380);
  }
  local(v){
    const lv = v.toLowerCase();
    for(const c of this.opt.local ? this.opt.local(v) : []){
      if(c && c.length > v.length && c.toLowerCase().startsWith(lv)) return c.slice(v.length);
    }
    return "";
  }
  async remote(v){
    const id = ++this.reqId;
    try{
      const j = await api.post("/api/suggest", {text:v, kind:this.opt.kind, context:this.opt.context ? this.opt.context() : []});
      if(id !== this.reqId || this.el.value !== v || document.activeElement !== this.el) return;
      const s = (j.suggestion||"").replace(/[  ]/g," ");
      if(s.trim()){ this.sug = s; this._last = v; this.paint(); }
    }catch{}
  }
  async predict(){
    if(this.opt.remote === false) return;
    const id = ++this.reqId;
    try{
      const j = await api.post("/api/suggest", {text:"", kind:this.opt.kind, context:this.opt.context ? this.opt.context() : []});
      if(id !== this.reqId) return;
      let p = (j.suggestion||"").replace(/[\u202f\u00a0]/g," ").trim();
      const m = p.match(/^.{8,}?[.?!](?=\s|[A-Z]|$)/); if(m) p = m[0];      // one sentence only
      this.setPrediction(p.slice(0, 90));
    }catch{}
  }
  current(){ const v = this.el.value; return v ? this.sug : this.pred; }
  atEnd(){ const e = this.el; return e.selectionStart === e.value.length && e.selectionEnd === e.value.length; }
  onKey(e){
    const s = this.current(); if(!s || !this.atEnd()) return;
    if(e.key === "Tab" && !e.shiftKey){ e.preventDefault(); e.stopPropagation(); this.accept(s); }
    else if(e.key === "ArrowRight" && !e.shiftKey && !e.metaKey && !e.altKey){
      e.preventDefault(); e.stopPropagation(); const w = s.match(/^\s*\S+/); this.accept(w ? w[0] : s);
    }
    else if(e.key === "Escape"){ if(this.el.value) this.sug = ""; else this.pred = ""; this.paint(); e.stopPropagation(); }
  }
  accept(part){
    const v = this.el.value, full = this.current();
    this.el.value = v + part;
    if(v){ this.sug = full.slice(part.length); } else { this.pred = ""; this.sug = full.slice(part.length); }
    this._last = this.el.value;
    this.el.dispatchEvent(new Event("input", {bubbles:true}));
    if(!this.sug) this.sug = this.local(this.el.value);
    this.el.setSelectionRange(this.el.value.length, this.el.value.length);
    this.paint(); this.opt.onAccept && this.opt.onAccept();
  }
  paint(){
    const el = this.el, s = this.current();
    const show = s && document.activeElement === el && this.atEnd() && !(el.tagName === "INPUT" && el.scrollWidth > el.clientWidth + 2);
    if(!show){ this.g.style.display = "none"; this.restorePh(); return; }
    const cs = getComputedStyle(el), pr = el.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect();
    Object.assign(this.g.style, {
      display:"block", left:(r.left-pr.left)+"px", top:(r.top-pr.top)+"px", width:r.width+"px", height:r.height+"px",
      font:cs.font, letterSpacing:cs.letterSpacing, lineHeight:cs.lineHeight, textAlign:cs.textAlign,
      padding:`${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      border:`${cs.borderTopWidth} solid transparent`, boxSizing:cs.boxSizing,
      whiteSpace: el.tagName === "TEXTAREA" ? "pre-wrap" : "pre", wordWrap:"break-word",
      display: "block",
    });
    if(el.tagName === "INPUT"){ this.g.style.display = "flex"; this.g.style.alignItems = "center"; }
    else this.g.scrollTop = el.scrollTop;
    if(!el.value) el.placeholder = "";
    this.g.innerHTML = `<span>${esc(el.value)}</span><span class="gs">${esc(s)}</span><span class="gk">TAB</span>`;
  }
  clear(){ this.sug = ""; this.pred = ""; this._last = ""; this.paint(); }
}

/* ---------- router ---------- */
const PAGES = ["home","chat","browser","oracle","models","builds","memory","team","factory"];
const TITLE = {home:"Home", chat:"Chat", browser:"Browser", oracle:"Hermes Oracle", models:"Models", builds:"Builds", memory:"Memory", team:"Team Hermes", factory:"AI Factory"};
const HUDVIEW = {home:"home", team:"team", factory:"factory"};
let page = "home";
function go(p){
  if(!PAGES.includes(p)) return;
  page = p;
  $$(".nav").forEach(b=>b.classList.toggle("on", b.dataset.page === p));
  $$(".page").forEach(s=>s.classList.toggle("on", s.id === "p-"+p));
  HUD.setView(HUDVIEW[p] || "ambient");
  document.body.classList.toggle("dimbg", !HUDVIEW[p]);
  $("crumb").innerHTML = `AgentOS / <b>${esc(TITLE[p])}</b>`;
  try{ history.replaceState(null, "", "#"+p); }catch{}
  closePicker();
  if(p === "models") loadModels();
  if(p === "oracle") loadNews();
  if(p === "chat") setTimeout(()=>$("cin").focus(), 60);
  if(p === "home") setTimeout(()=>{ if(!V.listening) $("vtext").focus(); }, 60);
  if(p === "browser" && !B.hist.length) B.renderHome();
  if(p === "builds") loadBuilds();
  if(p === "memory") loadMemory();
  $("mini").hidden = p === "home";
}
$$(".nav").forEach(b=>b.onclick = ()=>go(b.dataset.page));

/* =====================================================================================
   MODELS — live catalog
   ===================================================================================== */
const DEFAULT_MODEL = {provider:"nous", id:"stepfun/step-5-preview:free", name:"StepFun: Step 5 Preview (free)"};
const M = {list:[], providers:[], refreshed:0, loaded:false, shown:250, filterProv:null, busy:false};
let active = LS.get("model", DEFAULT_MODEL);
const provName = id => id === "hermes" ? "Hermes" : (M.providers.find(p=>p.id===id)||{}).name || id;
const shortName = m => (m.name||m.id).replace(/\s*\((free)\)\s*$/i,"").replace(/^[^:]{1,24}:\s*/,"");
async function loadModels(force){
  if(M.busy) return; if(M.loaded && !force){ renderModels(); return; }
  M.busy = true; if(force){ $("mrefresh").disabled = true; $("msub").innerHTML = `<span class="spin"></span> Refreshing every provider…`; }
  try{
    const d = await api.get("/api/models" + (force ? "?refresh=1" : ""));
    Object.assign(M, {list:d.models, providers:d.providers, refreshed:d.refreshed, loaded:true});
    const a = M.list.find(m=>m.provider===active.provider && m.id===active.id); if(a) active.name = a.name;
    renderModels(); renderActive(); renderHomeStats(); renderOracleSide();
    if(force) toast("Catalog refreshed", `${M.list.filter(m=>m.free).length} free models across ${M.providers.filter(p=>p.ok).length} providers`, "good");
  }catch(e){ toast("Catalog failed", e.message, "bad"); }
  M.busy = false; $("mrefresh").disabled = false;
}
function setActive(m){
  active = {provider:m.provider, id:m.id, name:m.name}; LS.set("model", active);
  renderActive(); if(page === "models") renderModels();
  toast(`Now using ${shortName(m)}`, provName(m.provider), "good");
}
function renderActive(){
  const t = active.provider === "hermes" ? "Hermes Agent" : shortName(active);
  $("sidemodel").innerHTML = `<i>◆</i><span>${esc(t)}</span>`;
  $("chatmodel").innerHTML = `<i>◆</i><span>${esc(t)} · ${esc(provName(active.provider))}</span>`;
}
function testBadge(t){
  if(!t) return "";
  return t.ok ? `<span class="tres ok" title="${esc(t.reply||"")}">✓ ${(t.ms/1000).toFixed(1)}s</span>` : `<span class="tres bad" title="${esc(t.error||"")}">✗ failed</span>`;
}
const tierTag = m => `<span class="tag ${m.tier}">${{free:"FREE","free-tier":"FREE TIER",credits:"CREDITS",paid:"PAID",agent:"AGENT"}[m.tier]||m.tier}</span>`;
function filteredModels(){
  const q = $("mq").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let l = M.list.filter(m=>
    (!$("mfree").checked || m.free) && (!$("mnew").checked || m.new) && (!$("mok").checked || (m.test && m.test.ok)) &&
    (!M.filterProv || m.provider === M.filterProv) &&
    q.every(w => (m.id+" "+m.name+" "+m.provider).toLowerCase().includes(w)));
  const s = $("msort").value;
  if(s === "new") l = l.slice().sort((a,b)=>(b.first_seen||0)-(a.first_seen||0));
  if(s === "ctx") l = l.slice().sort((a,b)=>(b.ctx||0)-(a.ctx||0));
  return l;
}
function renderModels(){
  if(!M.loaded) return;
  const free = M.list.filter(m=>m.free).length, nw = M.list.filter(m=>m.new && m.free).length;
  $("msub").textContent = `${M.list.length} models · ${free} free · ${nw} new this week · ${M.providers.filter(p=>p.ok).length}/${M.providers.length} providers online · refreshed ${ago(M.refreshed)} · auto-refresh every 30 min`;
  $("mprovs").innerHTML = M.providers.map(p=>`
    <div class="prov glass ${M.filterProv===p.id?"on":""}" data-p="${esc(p.id)}">
      ${(p.custom||p.override)?`<button class="del" data-del="${esc(p.id)}" title="${p.custom?"Remove provider":"Remove pasted key"}">✕</button>`:""}
      <div class="pn"><i class="led ${p.ok?"ok":p.has_key?"":"idle"}"></i>${esc(p.name)}</div>
      <div class="pc">${p.ok?`${p.free} free / ${p.count}`:(p.has_key?"offline":"no key")}${p.stale?" · cached":""}</div>
      ${p.ok?"":`<div class="pe" title="${esc(p.error||"")}">${esc(p.has_key?(p.error||""):"click to add a key")}</div>`}
    </div>`).join("") + `<div class="prov glass add" id="addprov">+ Add provider</div>`;
  $$(".prov[data-p]").forEach(el=>el.onclick = e=>{
    if(e.target.dataset.del) return;
    const p = M.providers.find(x=>x.id===el.dataset.p);
    if(p && !p.has_key && !p.custom) return openModal(p.id);
    M.filterProv = M.filterProv === el.dataset.p ? null : el.dataset.p; M.shown = 250; renderModels();
  });
  $$("[data-del]").forEach(b=>b.onclick = async e=>{
    e.stopPropagation(); const id = b.dataset.del;
    if(!confirm(`Remove ${provName(id)}${M.providers.find(p=>p.id===id)?.custom?"":" key override"}?`)) return;
    await api.post("/api/providers/delete", {id}); M.loaded = false; loadModels();
  });
  $("addprov").onclick = ()=>openModal();
  const l = filteredModels();
  $("mcount").textContent = `${l.length} shown`;
  $("mrows").innerHTML = l.slice(0, M.shown).map(m=>{
    const on = m.provider===active.provider && m.id===active.id;
    return `<div class="mt ${on?"on":""}" data-k="${esc(m.key)}">
      <div class="mn"><b title="${esc(m.name)}">${esc(m.name)}</b><small title="${esc(m.desc||"")}">${esc(m.id)}</small></div>
      <span class="muted">${esc(provName(m.provider))}</span>
      <span class="mono muted">${fmtCtx(m.ctx)}</span>
      <span>${m.new?'<span class="tag new">NEW</span> ':""}${tierTag(m)} ${testBadge(m.test)}</span>
      <span class="acts">${m.provider==="hermes"?"":`<button class="btn ghost sm" data-test>Test</button>`}<button class="btn ${on?"ghost":"pri"} sm" data-use ${on?"disabled":""}>${on?"Active":"Use"}</button></span>
    </div>`;
  }).join("") + (l.length > M.shown ? `<button class="btn ghost more" id="mmore">Show ${Math.min(250, l.length-M.shown)} more</button>` : "") + (l.length ? "" : `<div class="empty">No models match.</div>`);
  if($("mmore")) $("mmore").onclick = ()=>{ M.shown += 250; renderModels(); };
  $$("#mrows .mt").forEach(row=>{
    const m = M.list.find(x=>x.key===row.dataset.k); if(!m) return;
    const u = row.querySelector("[data-use]"); if(u) u.onclick = ()=>setActive(m);
    const t = row.querySelector("[data-test]");
    if(t) t.onclick = async ()=>{
      t.disabled = true; t.innerHTML = `<span class="spin"></span>`;
      try{ m.test = await api.post("/api/models/test", {provider:m.provider, model:m.id}); }catch(e){ m.test = {ok:false, error:e.message}; }
      if(!m.test.ok) toast(`${shortName(m)} failed`, m.test.error, "bad");
      renderModels();
    };
  });
}
["mq","mfree","mnew","mok","msort"].forEach(id=>$(id).addEventListener(id==="mq"?"input":"change", ()=>{ M.shown = 250; renderModels(); }));
$("mrefresh").onclick = ()=>loadModels(true);
$("maddp").onclick = ()=>openModal();

/* add-provider modal */
const PRESETS = [
  ["Custom (OpenAI-compatible)", "", "", true],
  ["Groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", true, "groq"],
  ["Together AI", "https://api.together.xyz/v1", "TOGETHER_API_KEY", true],
  ["Fireworks", "https://api.fireworks.ai/inference/v1", "FIREWORKS_API_KEY", false],
  ["DeepInfra", "https://api.deepinfra.com/v1/openai", "DEEPINFRA_API_KEY", false],
  ["SambaNova", "https://api.sambanova.ai/v1", "SAMBANOVA_API_KEY", true],
  ["Chutes", "https://llm.chutes.ai/v1", "CHUTES_API_KEY", true],
  ["Ollama (local)", "http://127.0.0.1:11434/v1", "", true],
  ["LM Studio (local)", "http://127.0.0.1:1234/v1", "", true],
  ["OpenAI", "https://api.openai.com/v1", "OPENAI_API_KEY", false],
  ["DeepSeek", "https://api.deepseek.com/v1", "DEEPSEEK_API_KEY", false],
];
$("ap-preset").innerHTML = PRESETS.map((p,i)=>`<option value="${i}">${esc(p[0])}</option>`).join("");
let modalBuiltin = null;
function openModal(builtinId){
  modalBuiltin = builtinId || null;
  const b = builtinId && M.providers.find(p=>p.id===builtinId);
  $("ap-title").textContent = b ? `Add a key for ${b.name}` : "Add a model provider";
  $("ap-preset").disabled = !!b; $("ap-name").disabled = $("ap-base").disabled = $("ap-env").disabled = !!b;
  if(b){ $("ap-name").value = b.name; $("ap-base").value = b.base; $("ap-env").value = b.key_name || ""; $("ap-key").value = ""; }
  else { $("ap-preset").value = 0; applyPreset(); }
  $("modal").classList.add("on"); setTimeout(()=>(b ? $("ap-key") : $("ap-name")).focus(), 50);
}
function applyPreset(){
  const p = PRESETS[+$("ap-preset").value];
  $("ap-name").value = p[1] ? p[0].replace(/ \(local\)$/,"") : ""; $("ap-base").value = p[1]; $("ap-env").value = p[2]; $("ap-free").checked = p[3]; $("ap-key").value = "";
  if(p[4]){ modalBuiltin = p[4]; }
}
$("ap-preset").onchange = ()=>{ modalBuiltin = null; applyPreset(); };
$("ap-cancel").onclick = ()=>$("modal").classList.remove("on");
$("modal").onclick = e=>{ if(e.target.id === "modal") $("modal").classList.remove("on"); };
$("ap-save").onclick = async ()=>{
  const body = {name:$("ap-name").value.trim(), base:$("ap-base").value.trim(), api_key:$("ap-key").value.trim(), key_name:$("ap-env").value.trim(), free:$("ap-free").checked};
  if(modalBuiltin) body.id = modalBuiltin;
  $("ap-save").disabled = true; $("ap-save").innerHTML = `<span class="spin"></span> Fetching models…`;
  try{
    const r = await api.post("/api/providers", body);
    $("modal").classList.remove("on"); $("ap-key").value = "";
    const p = r.provider || {};
    toast(p.ok ? `${p.name} connected` : `${body.name} added, but listing failed`, p.ok ? `${p.count} models (${p.free} free)` : (p.error||""), p.ok ? "good" : "bad");
    M.loaded = false; await loadModels();
  }catch(e){ toast("Could not add provider", e.message, "bad"); }
  $("ap-save").disabled = false; $("ap-save").textContent = "Add & fetch models";
};

/* model picker popover */
let pickCb = null;
function openPicker(anchor, cb){
  pickCb = cb || setActive;
  const p = $("picker"), r = anchor.getBoundingClientRect();
  p.classList.add("on");
  const h = p.offsetHeight, w = p.offsetWidth;
  p.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.left)) + "px";
  p.style.top = (r.bottom + h + 8 < innerHeight ? r.bottom + 8 : Math.max(10, r.top - h - 8)) + "px";
  $("pq").value = ""; renderPicker(); setTimeout(()=>$("pq").focus(), 30);
  if(!M.loaded) loadModels().then(renderPicker);
}
function closePicker(){ $("picker").classList.remove("on"); }
function renderPicker(){
  const q = $("pq").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const l = M.list.filter(m=>m.free && q.every(w=>(m.id+" "+m.name+" "+provName(m.provider)).toLowerCase().includes(w)));
  const groups = {};
  const ok = l.filter(m=>m.test && m.test.ok && m.provider !== "hermes");
  if(ok.length) groups["TESTED & WORKING"] = ok;
  l.forEach(m=>{ const g = m.provider === "hermes" ? "AGENT" : provName(m.provider).toUpperCase(); (groups[g] = groups[g] || []).push(m); });
  let n = 0;
  $("plist").innerHTML = Object.entries(groups).map(([g, ms])=>`<div class="grp">${esc(g)}</div>` + ms.slice(0, 60).map(m=>{ n++;
    const on = m.provider===active.provider && m.id===active.id;
    return `<div class="mrow ${on?"on":""}" data-k="${esc(m.key)}"><b>${esc(shortName(m))}</b><small>${esc(m.id)}</small><span class="tags">${m.new?'<span class="tag new">NEW</span>':""}${tierTag(m)}</span></div>`;
  }).join("")).join("") || `<div class="empty">${M.loaded?"No free models match.":'<span class="spin"></span>'}</div>`;
  $$("#plist .mrow").forEach(r=>r.onclick = ()=>{ const m = M.list.find(x=>x.key===r.dataset.k); closePicker(); m && pickCb(m); });
}
$("pq").addEventListener("input", renderPicker);
$("pq").addEventListener("keydown", e=>{ if(e.key === "Enter"){ const f = $("plist").querySelector(".mrow"); f && f.click(); } });
document.addEventListener("mousedown", e=>{ if($("picker").classList.contains("on") && !e.target.closest("#picker") && !e.target.closest(".modelchip")) closePicker(); });
$("sidemodel").onclick = e=>openPicker(e.currentTarget);
$("chatmodel").onclick = e=>openPicker(e.currentTarget);

/* =====================================================================================
   VOICE — the home screen. Web Speech API in, speechSynthesis out, sentence streaming.
   ===================================================================================== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const V = { rec:null, listening:false, speaking:false, busy:false, abort:null, history:[], empties:0,
  hands:LS.get("hands", false), speak:LS.get("speak", true), mode:LS.get("vmode", "direct"), stream:null, meterRaf:0 };
let miniTimer = 0;
function miniShow(text){
  const el = $("mini"); if(text != null) $("mtext").textContent = text.length > 400 ? "…" + text.slice(-400) : text;
  el.classList.add("show"); clearTimeout(miniTimer);
  miniTimer = setTimeout(()=>{ if(!V.busy && !V.speaking && !V.listening) el.classList.remove("show"); }, 9000);
}
function setVState(m, label){ HUD.setMode(m); $("vlabel").textContent = label;
  $("mini").className = m === "idle" ? "" : m; $("mlabel").textContent = label; if(m !== "idle") miniShow(); else if($("mini").hidden === false) miniShow(); $("mic").classList.toggle("live", m === "listen"); $("led-mic").className = "led " + (m === "idle" ? "idle" : "ok"); $("micstat").textContent = m === "idle" ? (V.hands ? "HANDS-FREE" : "VOICE READY") : label; }
function renderVoiceToggles(){
  $("vhands").classList.toggle("on", V.hands); $("vspeak").classList.toggle("on", V.speak); $("vwake").classList.toggle("on", !!V.wake);
  $$("#vmodes button").forEach(b=>b.classList.toggle("on", b.dataset.m === V.mode));
}
$$("#vmodes button").forEach(b=>b.onclick = ()=>{ V.mode = b.dataset.m; LS.set("vmode", V.mode); renderVoiceToggles(); });
function setHands(on){ V.hands = on; LS.set("hands", on); V.empties = 0; renderVoiceToggles(); if(on && !V.listening && !V.busy && !V.speaking) listen(); }
$("vhands").onclick = ()=>{ if(!V.hands && V.wake) setWake(false); setHands(!V.hands); };
$("vwake").onclick = ()=>setWake(!V.wake);
$("vbrief").onclick = ()=>briefing("daily");
$("vspeak").onclick = ()=>{ V.speak = !V.speak; LS.set("speak", V.speak); if(!V.speak) stopSpeaking(); renderVoiceToggles(); };

async function meterOn(){
  try{
    V.stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true}});
    const ctx = V.actx || (V.actx = new AudioContext()); if(ctx.state === "suspended") await ctx.resume();
    const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(V.stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const loop = ()=>{ if(!V.listening) return; an.getByteTimeDomainData(buf); let s = 0; for(const v of buf){ const x = (v-128)/128; s += x*x; } HUD.setLevel(Math.min(1, Math.sqrt(s/buf.length)*5)); V.meterRaf = requestAnimationFrame(loop); };
    loop();
  }catch{ /* the level meter is cosmetic */ }
}
function meterOff(){ cancelAnimationFrame(V.meterRaf); if(V.stream){ V.stream.getTracks().forEach(t=>t.stop()); V.stream = null; } }

function listen(){
  if(!SR){ toast("Voice input needs Chrome", "This browser has no Web Speech API — type below instead.", "bad"); $("vtext").focus(); return; }
  if(V.listening){ V.rec && V.rec.stop(); return; }
  if(V.wakeRec){ wakeStop(); setTimeout(listen, 180); return; }
  stopSpeaking(); if(V.abort) V.abort.abort();
  const rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let final = "";
  rec.onstart = ()=>{ V.listening = true; setVState("listen", "LISTENING"); $("vheard").textContent = ""; meterOn(); };
  rec.onresult = e=>{
    let interim = ""; for(let i = e.resultIndex; i < e.results.length; i++){ const r = e.results[i]; if(r.isFinal) final += r[0].transcript; else interim += r[0].transcript; }
    const t = (final + interim).trim(); $("vheard").textContent = t ? `“${t}”` : "";
  };
  rec.onerror = e=>{
    if(e.error === "not-allowed" || e.error === "service-not-allowed"){ V.hands = false; LS.set("hands", false); renderVoiceToggles(); toast("Microphone blocked", "Allow microphone access for 127.0.0.1 (click the icon in the address bar).", "bad"); }
    else if(e.error === "network") toast("Voice service unreachable", "Chrome speech recognition needs internet.", "bad");
    else if(e.error !== "no-speech" && e.error !== "aborted") toast("Voice error", e.error, "bad");
  };
  rec.onend = ()=>{
    V.listening = false; V.rec = null; meterOff();
    const t = final.trim();
    if(t){ V.empties = 0; handleUtterance(t); return; }
    setVState("idle", V.hands ? "HANDS-FREE · SAY SOMETHING" : "STANDING BY");
    if(!V.hands) wakeStart();
    if(V.hands && page === "home"){
      if(++V.empties >= 4){ setHands(false); toast("Hands-free paused", "No speech for a while. Press Space or tap the mic to resume."); setVState("idle", "STANDING BY"); }
      else setTimeout(()=>{ if(V.hands && !V.listening && !V.busy && !V.speaking) listen(); }, 300);
    }
  };
  V.rec = rec; try{ rec.start(); }catch{}
}
$("mic").onclick = listen;
$("mcore").onclick = ()=>{ if(V.busy || V.speaking){ stopAll(); return; } listen(); };

/* text-to-speech, streamed sentence by sentence */
const TTS = {buf:""};
let voicesReady = speechSynthesis.getVoices();
speechSynthesis.onvoiceschanged = ()=>{ voicesReady = speechSynthesis.getVoices(); };
function pickVoice(){
  const vs = voicesReady.length ? voicesReady : speechSynthesis.getVoices(), pref = LS.get("voice", "");
  return vs.find(v=>v.name === pref) || vs.find(v=>/Daniel/.test(v.name) && /en[-_]GB/.test(v.lang)) || vs.find(v=>/Google UK English Male/.test(v.name))
    || vs.find(v=>/en[-_]GB/.test(v.lang)) || vs.find(v=>/^en/.test(v.lang)) || null;
}
const speakable = t => t.replace(/```[\s\S]*?```/g, " ").replace(/https?:\/\/\S+/g, "").replace(/\[(\d+)\]/g, "").replace(/[*_#`>|~]/g, "").replace(/\s+/g, " ").trim();
function speakChunk(text){
  text = speakable(text); if(!text) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(); if(v) u.voice = v;
  u.rate = 1.04; u.pitch = .95;
  u.onstart = ()=>{ V.speaking = true; setVState("speak", "SPEAKING"); };
  u.onboundary = ()=>HUD.setLevel(.75);
  u.onend = u.onerror = ()=>{ setTimeout(()=>{ if(!speechSynthesis.speaking && !speechSynthesis.pending){ V.speaking = false; speechDone(); } }, 60); };
  speechSynthesis.speak(u);
}
function feedSpeech(delta){
  TTS.buf += delta; let m;
  while((m = TTS.buf.match(/^[\s\S]*?(?:[.!?…](?=\s)|\n)/))){ const s = m[0]; TTS.buf = TTS.buf.slice(s.length); if(s.trim().length > 1) speakChunk(s); }
}
function flushSpeech(){ if(TTS.buf.trim()) speakChunk(TTS.buf); TTS.buf = ""; }
function stopSpeaking(){ TTS.buf = ""; speechSynthesis.cancel(); V.speaking = false; }
function speechDone(){
  if(V.busy || V.speaking) return;
  setVState("idle", V.hands ? "HANDS-FREE" : V.wake ? "SAY “HEY AGENTOS”" : "STANDING BY");
  if(V.hands && page === "home") setTimeout(()=>{ if(V.hands && !V.listening && !V.busy && !V.speaking) listen(); }, 350);
  else wakeStart();
}

/* wake word — a continuous recogniser that only listens for “Hey AgentOS” (or “Jarvis”) */
V.wake = LS.get("wake", false);
const WAKE_RX = /\b(?:hey|hi|ok|okay|yo)?[\s,]*(?:agent[\s-]?o\.?\s?s\.?|agentos|agent of s|agent oss|jarvis)\b[\s,.!?]*(.*)$/i;
function chime(){
  try{ const c = V.actx || (V.actx = new AudioContext()); const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(660, c.currentTime); o.frequency.exponentialRampToValueAtTime(990, c.currentTime + .12);
    g.gain.setValueAtTime(.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(.18, c.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .25);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + .26); }catch{}
}
function wakeStop(){ const r = V.wakeRec; V.wakeRec = null; if(r){ r.onend = null; r.onresult = null; try{ r.abort(); }catch{} } }
function wakeStart(){
  if(!SR || !V.wake || V.wakeRec || V.listening || V.busy || V.speaking || V.hands) return;
  const r = new SR(); r.lang = "en-US"; r.continuous = true; r.interimResults = true;
  let hit = null;
  r.onresult = e=>{
    const res = e.results[e.results.length - 1], m = res[0].transcript.match(WAKE_RX);
    if(!m) return;
    HUD.setMode("listen"); $("vlabel").textContent = "YES?";
    if(res.isFinal){ hit = m[1].trim(); try{ r.stop(); }catch{} }
  };
  r.onerror = e=>{ if(e.error === "not-allowed" || e.error === "service-not-allowed"){ V.wake = false; LS.set("wake", false); renderVoiceToggles(); toast("Wake word needs the microphone", "Allow mic access for 127.0.0.1, then turn it back on.", "bad"); } };
  r.onend = ()=>{
    if(V.wakeRec !== r) return; V.wakeRec = null;
    if(hit !== null){
      chime();
      if(hit.replace(/[^a-z0-9]/gi, "").length > 2) handleUtterance(hit); else listen();
    } else setTimeout(wakeStart, 300);     // Chrome ends continuous sessions every ~minute — just re-arm
  };
  V.wakeRec = r; try{ r.start(); }catch{ V.wakeRec = null; }
}
function setWake(on){
  V.wake = on; LS.set("wake", on); renderVoiceToggles();
  if(on){ if(V.hands) setHands(false); wakeStart(); toast("Wake word on", "Say “Hey AgentOS” — then your request. Chrome streams mic audio to Google while this is on."); setVState("idle", "SAY “HEY AGENTOS”"); }
  else { wakeStop(); setVState("idle", "STANDING BY"); }
}
function say(msg){ $("vreply").textContent = msg; $("vsrc").innerHTML = ""; miniShow(msg); if(V.speak){ stopSpeaking(); speakChunk(msg); } else speechDone(); }
function stopAll(){ wakeStop(); setTimeout(wakeStart, 600); if(V.rec){ V.rec.abort(); } if(V.abort) V.abort.abort(); stopSpeaking(); V.busy = false; setVState("idle", "STANDING BY"); }

/* intents — say it naturally; anything else goes to the model */
const NAVMAP = {home:"home", chat:"chat", browser:"browser", web:"browser", "web browser":"browser", oracle:"oracle", news:"oracle", model:"models", models:"models", catalog:"models", "model catalog":"models",
  team:"team", "team hermes":"team", crew:"team", factory:"factory", "ai factory":"factory"};
const NUMW = {one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10"};
const INTENTS = [
  [/^(?:stop|cancel|never ?mind|be quiet|silence|shut up|that's all)[.!]?$/i, ()=>{ stopAll(); }],
  [/^(?:open|show(?: me)?|go to|switch to|take me to|pull up|bring up)\s+(?:the\s+)?(home|chat|web browser|browser|hermes oracle|oracle|news|model catalog|models?|catalog|team hermes|team|crew|ai factory|factory)(?: page| tab| view| screen)?[.!]?$/i,
    m=>{ const p = NAVMAP[m[1].toLowerCase().replace(/^hermes /,"")]; go(p); say(`Opening ${TITLE[p]}.`); }],
  [/^(?:open|go to|visit|browse to|pull up)\s+((?:https?:\/\/)?[a-z0-9-]+(?:\s?(?:dot|\.)\s?[a-z0-9-]+)+(?:\/\S*)?)[.!]?$/i,
    m=>{ const url = m[1].replace(/\s?dot\s?/gi, ".").replace(/\s/g, ""); go("browser"); B.nav(url); say(`Opening ${url}.`); }],
  [/^(?:search(?: the web| online| the internet)?(?: for)?|google|look up|browse for|find me)\s+(.+)/i, m=>{ B.search(m[1].replace(/[.?!]$/,""), false); return converse(m[0], {web:true}); }],
  [/^(?:remember|note|don'?t forget|make a note)(?: that| this)?[:,]?\s+(.{3,})/i, m=>memoryAdd(m[1].replace(/[.!]$/,""), true)],
  [/^what (?:do you|else do you) (?:remember|know about me|have in memory)(?: about (.+?))?\??$/i, m=>memoryRecall(m[1])],
  [/^forget(?: that| about)?\s+(.+)/i, m=>memoryForget(m[1].replace(/[.!]$/,""))],
  [/(?:what'?s|what is|anything) (?:new|hot|happening|trending|the latest)(?: in| with)? (?:ai|a\.i\.|the ai world|artificial intelligence)|consult the oracle|\bai news\b|news brief(?:ing)?|brief me on (?:the )?(?:ai|news)/i, ()=>O.consult(true)],
  [/^(?:(?:give|read) me |what'?s )?(?:my |the )?(daily|morning|weekly|evening)?\s*brief(?:ing)?[.!?]?$|^brief me[.!]?$|^good (?:morning|afternoon|evening)(?:,? (?:agent ?os|jarvis))?[.!]?$/i, m=>briefing((m[1]||"").toLowerCase() === "weekly" ? "weekly" : "daily")],
  [/^(?:(?:can|could|would) you |please )?(?:build|code|make|create)(?: me)? (?:an? |the )?(.*?\b(?:game|app|tool|website|site|dashboard|calculator|timer|tracker|clock|visuali[sz]er|widget|simulator|editor|player|board|quiz|generator|converter|planner|keyboard|synth|drum machine|chart)s?\b.*?)[.!?]?$/i, m=>buildApp(m[0].replace(/^(?:(?:can|could|would) you |please )/i,""), true)],
  [/^play (.+?) on youtube[.!]?$/i, m=>openChrome("https://www.youtube.com/results?search_query=" + encodeURIComponent(m[1]), `Playing ${m[1]} on YouTube.`)],
  [/^(?:open|show|pull up|go to|launch)\s+(.+?)\s+(?:in|on|with) (?:chrome|google chrome|my browser|the real browser)[.!]?$/i, m=>openChrome(resolveSite(m[1]), `Opening ${m[1]} in Chrome.`)],
  [/^(?:(?:tell|ask|have|get) (?:the )?(?:crew|team|hermes team|team hermes)(?: to)?|dispatch(?: to the crew)?|team hermes,?)\s+(.+)/i, m=>dispatchVoice(m[1])],
  [/^(?:switch|change|set)(?: the)? (?:model|brain)(?: to)?\s+(.+)|^use (?:the )?(.+?) model[.!]?$/i, m=>switchModelVoice(m[1] || m[2])],
  [/^(?:hands[- ]?free|conversation mode)(?: mode)?\s+(on|off)/i, m=>{ say(`Hands-free ${m[1].toLowerCase()}.`); setHands(m[1].toLowerCase() === "on"); }],
  [/^(?:refresh|update|rescan)(?: the)? (?:model )?catalog/i, async ()=>{ say("Refreshing the model catalog."); await loadModels(true); }],
];
async function handleUtterance(text){
  text = text.trim(); if(!text) return;
  HIST.add("voice", text);
  $("vheard").textContent = `“${text}”`; $("vsrc").innerHTML = ""; vGhost.clear();
  for(const [rx, fn] of INTENTS){ const m = text.match(rx); if(m){ await fn(m, text); return; } }
  return converse(text, {web:V.mode === "web", agent:V.mode === "agent"});
}
async function converse(text, {web=false, agent=false, prompt=null} = {}){
  if(V.abort) V.abort.abort();
  stopSpeaking();
  V.history.push({role:"user", content:prompt || text});
  V.history = V.history.slice(-20); const idx = V.history.length - 1;
  const model = agent ? {provider:"hermes", id:"agent"} : active;
  V.busy = true; setVState("think", agent ? "HERMES AGENT WORKING" : web ? "SEARCHING THE WEB" : "THINKING");
  $("vreply").textContent = ""; let out = "";
  const ac = V.abort = new AbortController();
  try{
    await streamChat({provider:model.provider, model:model.id, messages:V.history, web, voice:true}, ev=>{
      if(ev.type === "delta"){ out += ev.text; $("vreply").textContent = out; $("vreply").scrollTop = 1e9; if(page !== "home") miniShow(out); if(V.speak) feedSpeech(ev.text); if(!V.speaking) setVState("think", "RESPONDING"); }
      else if(ev.type === "status" && !out) $("vlabel").textContent = ev.text.replace("…","").toUpperCase();
      else if(ev.type === "sources") $("vsrc").innerHTML = ev.items.slice(0, 5).map(s=>`<a data-url="${esc(s.url)}" href="${esc(s.url)}">${esc(s.title || host(s.url))}</a>`).join("");
      else if(ev.type === "error") throw new Error(ev.error);
    }, ac.signal);
    if(prompt && V.history[idx]) V.history[idx].content = text;
    V.history.push({role:"assistant", content:out});
    vGhost.predict();
  }catch(e){
    if(e.name !== "AbortError"){ $("vreply").textContent = "I couldn't reach the model: " + e.message; if(V.speak) speakChunk("I couldn't reach the model. Check the error on screen."); }
  }
  if(V.abort === ac) V.abort = null;
  V.busy = false;
  if(V.speak){ flushSpeech(); if(!speechSynthesis.speaking && !speechSynthesis.pending) speechDone(); } else speechDone();
}
async function dispatchVoice(task){
  setVState("think", "DISPATCHING");
  try{
    const r = await api.post("/api/dispatch", {task});
    const bots = (r.out.match(/Bots:\s*(.+)/) || [])[1];
    say(r.ok ? `Dispatched to ${bots ? bots.trim().split(/\s+/).join(", ") : "the crew"}. Watch Team Hermes for progress.` : "The dispatcher refused that task. " + r.out.split("\n").pop());
    HIST.add("crew", task);
  }catch(e){ say("Dispatch failed: " + e.message); }
}
async function switchModelVoice(q){
  if(!M.loaded) await loadModels();
  const words = q.toLowerCase().replace(/[.!?]/g, "").split(/\s+/).map(w=>NUMW[w] || w).filter(w=>w && !["the","model","free"].includes(w));
  if(/hermes|agent/.test(words.join(" "))){ setActive(M.list.find(m=>m.provider === "hermes")); say("Switched to the Hermes agent."); return; }
  let best = null, bs = 0;
  for(const m of M.list.filter(m=>m.free)){
    const hay = (m.name + " " + m.id + " " + provName(m.provider)).toLowerCase().replace(/[-_/:.]/g, " ");
    const s = words.reduce((a, w)=>a + (hay.includes(w) ? w.length : 0), 0) + (m.test && m.test.ok ? .5 : 0);
    if(s > bs){ bs = s; best = m; }
  }
  if(best && bs >= 2){ setActive(best); say(`Switched to ${shortName(best)} on ${provName(best.provider)}.`); }
  else say(`I couldn't find a free model matching ${q}.`);
}

/* home text input + ghost text */
const VOICE_CMDS = ["open the oracle", "open the browser", "open the model catalog", "open team hermes", "open the ai factory", "open chat",
  "search the web for ", "what's new in AI today?", "consult the oracle", "brief me on AI news", "tell the crew to research ", "tell the crew to write ",
  "tell the crew to build ", "switch model to ", "hands-free on", "hands-free off", "refresh the catalog",
  "give me my daily briefing", "give me my weekly briefing", "build me a ", "build me a snake game", "remember that ", "what do you remember about ",
  "forget ", "play  on youtube", "open github in chrome", "open youtube in chrome"];
const vGhost = new Ghost($("vtext"), {kind:"voice", context:()=>V.history.slice(-6),
  local:v=>{
    const lv = v.toLowerCase();
    if(/^(switch|change|use) (the )?model to /.test(lv) && M.loaded){
      const pre = v.match(/^.*? to /i)[0];
      return M.list.filter(m=>m.free).map(m=>pre + shortName(m).toLowerCase());
    }
    return [...HIST.get("voice"), ...VOICE_CMDS];
  }});
$("vtext").addEventListener("keydown", e=>{ if(e.key === "Enter" && $("vtext").value.trim()){ const t = $("vtext").value; $("vtext").value = ""; vGhost.clear(); handleUtterance(t); } });
const HOME_SUG = ["Give me my daily briefing", "What's new in AI today?", "Build me a snake game", "Search the web for the best free coding models"];
$("hsug").innerHTML = HOME_SUG.map(s=>`<button class="chip">${esc(s)}</button>`).join("");
$$("#hsug .chip").forEach(c=>c.onclick = ()=>handleUtterance(c.textContent));

/* =====================================================================================
   CHAT
   ===================================================================================== */
const C = {sessions:LS.get("sessions", []), cur:LS.get("cursession", null), abort:null};
const save = ()=>{ LS.set("sessions", C.sessions.slice(0, 40)); LS.set("cursession", C.cur); };
const session = ()=>C.sessions.find(s=>s.id === C.cur);
function md(src){
  const blocks = [];
  src = String(src||"").replace(/```(\w*)\n?([\s\S]*?)(?:```|$)/g, (_, l, code)=>{ blocks.push(`<pre><code>${esc(code.replace(/\n$/,""))}</code></pre>`); return `\n\u0000${blocks.length-1}\u0000\n`; });
  let h = esc(src)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" data-url="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)"]+)/g, '$1<a href="$2" data-url="$2">$2</a>');
  const out = []; let list = null, para = [];
  const fP = ()=>{ if(para.length){ out.push("<p>" + para.join("<br>") + "</p>"); para = []; } };
  const fL = ()=>{ if(list){ out.push(`<${list.t}>${list.items.map(i=>"<li>"+i+"</li>").join("")}</${list.t}>`); list = null; } };
  for(const line of h.split("\n")){
    let m;
    if(/^\u0000\d+\u0000$/.test(line.trim())){ fP(); fL(); out.push(line.trim()); continue; }
    if((m = line.match(/^#{1,4}\s+(.*)/))){ fP(); fL(); out.push(`<h3>${m[1]}</h3>`); continue; }
    if((m = line.match(/^\s*[-*•]\s+(.*)/))){ fP(); if(!list || list.t !== "ul"){ fL(); list = {t:"ul", items:[]}; } list.items.push(m[1]); continue; }
    if((m = line.match(/^\s*\d+[.)]\s+(.*)/))){ fP(); if(!list || list.t !== "ol"){ fL(); list = {t:"ol", items:[]}; } list.items.push(m[1]); continue; }
    if((m = line.match(/^&gt;\s?(.*)/))){ fP(); fL(); out.push(`<blockquote>${m[1]}</blockquote>`); continue; }
    if(!line.trim()){ fP(); fL(); continue; }
    fL(); para.push(line);
  }
  fP(); fL();
  return out.join("").replace(/\u0000(\d+)\u0000/g, (_, i)=>blocks[+i]);
}
function newChat(){ const s = {id:"c"+Date.now(), title:"New chat", msgs:[], ts:Date.now()}; C.sessions.unshift(s); C.cur = s.id; save(); renderSessions(); renderMsgs(); $("cin").focus(); cGhost.clear(); }
function renderSessions(){
  $("slist").innerHTML = C.sessions.map(s=>`<div class="sess ${s.id===C.cur?"on":""}" data-id="${s.id}"><span>${esc(s.title)}</span><button class="x" title="Delete">✕</button></div>`).join("") || `<div class="empty">No chats yet</div>`;
  $$("#slist .sess").forEach(el=>{
    el.onclick = e=>{ if(e.target.classList.contains("x")){ delChat(el.dataset.id); return; } C.cur = el.dataset.id; save(); renderSessions(); renderMsgs(); };
  });
}
function delChat(id){ C.sessions = C.sessions.filter(s=>s.id !== id); if(C.cur === id) C.cur = C.sessions[0]?.id || null; save(); renderSessions(); renderMsgs(); }
$("chatclear").onclick = ()=>{ if(C.cur && confirm("Delete this chat?")) delChat(C.cur); };
$("newchat").onclick = newChat;
const CHAT_SUG = ["What can you do?", "Compare the best free models for coding", "Summarize today's AI news", "Help me plan my week"];
function msgHTML(m, i){
  const who = m.role === "user" ? "YOU" : "AGENTOS";
  const meta = m.role === "assistant" && m.model ? `<i>${esc(m.model)}${m.ms?` · ${(m.ms/1000).toFixed(1)}s`:""}</i>` : "";
  const body = m.role === "user" ? `<p>${esc(m.content).replace(/\n/g,"<br>")}</p>` : (m.content ? md(m.content) : "");
  const st = m.pending ? `<div class="status"><span class="spin"></span>${esc(m.status || "Thinking…")}</div>` : "";
  const err = m.error ? `<div class="err">⚠ ${esc(m.error)}</div>` : "";
  const src = m.sources && m.sources.length ? `<div class="srcs">${m.sources.map((s,j)=>`<a data-url="${esc(s.url)}" href="${esc(s.url)}">[${j+1}] ${esc(s.title || host(s.url))}</a>`).join("")}</div>` : "";
  return `<div class="msg ${m.role}" data-i="${i}"><div class="av">${m.role==="user"?"J":"A"}</div><div><div class="who">${who}${meta}</div><div class="md">${body}</div>${st}${err}${src}</div></div>`;
}
function renderMsgs(){
  const s = session();
  if(!s || !s.msgs.length){
    $("msgs").innerHTML = `<div class="welcome"><div class="eyebrow">AgentOS chat</div><h2>What are we working on?</h2><p class="muted">Pick any free model from the live catalog. Turn on Web search to ground answers in live results.</p><div class="suggest">${CHAT_SUG.map(t=>`<button class="chip">${esc(t)}</button>`).join("")}</div></div>`;
    $$("#msgs .chip").forEach(c=>c.onclick = ()=>{ $("cin").value = c.textContent; sendChat(); });
  } else $("msgs").innerHTML = s.msgs.map(msgHTML).join("");
  $("msgs").scrollTop = 1e9;
  $("chatinfo").textContent = s ? `${s.msgs.length} messages` : "";
}
function updateLast(){
  const s = session(); if(!s) return; const i = s.msgs.length - 1, el = $("msgs").querySelector(`.msg[data-i="${i}"]`);
  const nearBottom = $("msgs").scrollHeight - $("msgs").scrollTop - $("msgs").clientHeight < 140;
  if(el) el.outerHTML = msgHTML(s.msgs[i], i); else renderMsgs();
  if(nearBottom) $("msgs").scrollTop = 1e9;
}
async function sendChat(){
  if(C.abort){ C.abort.abort(); return; }
  const text = $("cin").value.trim(); if(!text) return;
  if(!session()) newChat();
  const s = session(); HIST.add("chat", text);
  $("cin").value = ""; autoSize(); cGhost.clear();
  if(s.title === "New chat") s.title = text.slice(0, 48);
  s.msgs.push({role:"user", content:text});
  const a = {role:"assistant", content:"", pending:true, model:shortName(active), status:"Thinking…"}; s.msgs.push(a);
  renderSessions(); renderMsgs(); save();
  const ac = C.abort = new AbortController(); $("csend").innerHTML = icon("stop") + "Stop";
  const speak = $("cspeak").checked; let thinking = 0;
  try{
    await streamChat({provider:active.provider, model:active.id, web:$("cweb").checked, voice:false,
      messages:s.msgs.filter(m=>!m.pending && !m.error).map(m=>({role:m.role, content:m.content}))}, ev=>{
      if(ev.type === "delta"){ a.content += ev.text; a.status = ""; if(speak) feedSpeech(ev.text); }
      else if(ev.type === "thinking"){ thinking = ev.n; a.status = `Reasoning… ${thinking.toLocaleString()} chars`; }
      else if(ev.type === "status") a.status = ev.text;
      else if(ev.type === "sources") a.sources = ev.items;
      else if(ev.type === "done") a.ms = ev.ms;
      else if(ev.type === "error") throw new Error(ev.error);
      updateLast();
    }, ac.signal);
  }catch(e){ if(e.name !== "AbortError") a.error = e.message; else a.content += a.content ? "\n\n*(stopped)*" : "*(stopped)*"; }
  a.pending = false; delete a.status; C.abort = null; $("csend").innerHTML = icon("send") + "Send";
  if(speak) flushSpeech();
  updateLast(); save();
  if(!a.error) cGhost.predict();
}
function autoSize(){ const t = $("cin"); t.style.height = "auto"; t.style.height = Math.min(180, t.scrollHeight) + "px"; }
$("cin").addEventListener("input", autoSize);
$("cin").addEventListener("keydown", e=>{ if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); } });
$("csend").onclick = sendChat;
$("cweb").checked = LS.get("cweb", false); $("cspeak").checked = LS.get("cspeak", false);
$("cweb").onchange = ()=>LS.set("cweb", $("cweb").checked); $("cspeak").onchange = ()=>{ LS.set("cspeak", $("cspeak").checked); if(!$("cspeak").checked) stopSpeaking(); };
const cGhost = new Ghost($("cin"), {kind:"chat", context:()=>(session()?.msgs || []).filter(m=>!m.pending).slice(-6).map(m=>({role:m.role, content:m.content})),
  local:()=>[...HIST.get("chat"), ...CHAT_SUG]});
/* dictation into the composer */
$("cmic").onclick = ()=>{
  if(!SR){ toast("Dictation needs Chrome", "", "bad"); return; }
  const rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; const base = $("cin").value ? $("cin").value.trimEnd() + " " : "";
  rec.onstart = ()=>$("cmic").classList.add("on");
  rec.onresult = e=>{ let t = ""; for(const r of e.results) t += r[0].transcript; $("cin").value = base + t; autoSize(); };
  rec.onend = ()=>{ $("cmic").classList.remove("on"); $("cin").focus(); };
  rec.start();
};

/* =====================================================================================
   BROWSER — Exa search + server-side reader view + page assistant
   ===================================================================================== */
const SITES = ["news.ycombinator.com", "huggingface.co", "huggingface.co/models?sort=trending", "openrouter.ai/models", "portal.nousresearch.com",
  "hermes-agent.nousresearch.com/docs", "github.com/trending", "arxiv.org/list/cs.AI/recent", "simonwillison.net", "techcrunch.com/category/artificial-intelligence",
  "www.theverge.com/ai-artificial-intelligence", "openai.com/news", "deepmind.google/blog"];
const B = {hist:[], idx:-1, page:null, chat:[]};
B.cur = ()=>B.hist[B.idx];
B.isUrl = s => /^https?:\/\//i.test(s) || (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(s) && !/\s/.test(s));
B.nav = input=>{ input = (input||"").trim(); if(!input) return; HIST.add("browser", input); if(B.isUrl(input)) B.open(/^https?:/i.test(input) ? input : "https://" + input); else B.search(input); };
B.push = e=>{ B.hist = B.hist.slice(0, B.idx+1); B.hist.push(e); B.idx = B.hist.length - 1; };
B.search = async (q, show=true)=>{
  const e = {type:"search", q}; B.push(e); if(show || page === "browser") B.render();
  try{ const d = await api.get("/api/search?q=" + encodeURIComponent(q)); e.results = d.results; }catch(err){ e.error = err.message; }
  if(B.cur() === e) B.render();
};
B.open = async url=>{
  const e = {type:"page", url}; B.push(e); B.render();
  try{ e.page = await api.get("/api/read?url=" + encodeURIComponent(url)); }catch(err){ e.error = err.message; }
  if(B.cur() === e) B.render();
};
B.reload = ()=>{ const e = B.cur(); if(!e) return; B.hist.splice(B.idx, 1); B.idx--; e.type === "page" ? B.open(e.url) : B.search(e.q); };
B.renderHome = ()=>{
  $("baddr").value = ""; $("actx").textContent = "NO PAGE"; B.page = null;
  $("bview").innerHTML = `<div class="reader" style="text-align:center;padding-top:30px"><div class="eyebrow">AgentOS browser</div><h1 class="t" style="margin-top:10px">Search, read, ask.</h1>
    <p class="muted">Pages open in a clean reader view. The assistant on the right can summarize or answer questions about whatever is open. Anything that needs a login or scripts: open it in Chrome (↗).</p>
    <div class="speed">${[["Hacker News","news.ycombinator.com"],["HF trending","huggingface.co/models?sort=trending"],["OpenRouter models","openrouter.ai/models"],["Hermes docs","hermes-agent.nousresearch.com/docs"],["arXiv cs.AI","arxiv.org/list/cs.AI/recent"],["GitHub trending","github.com/trending"]]
      .map(([n,u])=>`<button data-go="${esc(u)}">${esc(n)}<small>${esc(u)}</small></button>`).join("")}</div></div>`;
  $$("#bview [data-go]").forEach(b=>b.onclick = ()=>B.nav(b.dataset.go));
};
B.render = ()=>{
  const e = B.cur(); if(!e) return B.renderHome();
  $("bback").disabled = B.idx <= 0; $("bfwd").disabled = B.idx >= B.hist.length - 1;
  if(e.type === "search"){
    $("baddr").value = e.q; B.page = null; $("actx").textContent = "SEARCH";
    if(e.error) $("bview").innerHTML = `<div class="empty err">Search failed: ${esc(e.error)}</div>`;
    else if(!e.results) $("bview").innerHTML = `<div class="empty"><span class="spin"></span> Searching for “${esc(e.q)}”…</div>`;
    else $("bview").innerHTML = e.results.map(r=>`<div class="res" data-url="${esc(r.url)}"><div class="ru">${esc(host(r.url))}${r.published?` · ${esc(r.published.slice(0,10))}`:""}</div><div class="rt">${esc(r.title)}</div><div class="rs">${esc(r.text)}</div></div>`).join("") || `<div class="empty">No results.</div>`;
    $$("#bview .res").forEach(el=>el.onclick = ()=>B.open(el.dataset.url));
    return;
  }
  $("baddr").value = e.url;
  if(e.error){ $("bview").innerHTML = `<div class="reader"><div class="src">${esc(e.url)}</div><h1 class="t">Couldn't open this page</h1><p class="muted">${esc(e.error)}</p><p><button class="btn ghost" id="bextc">${icon("ext")} Open in Chrome</button></p></div>`; $("bextc").onclick = ()=>window.open(e.url, "_blank"); return; }
  if(!e.page){ $("bview").innerHTML = `<div class="empty"><span class="spin"></span> Loading ${esc(host(e.url))}…</div>`; return; }
  const p = e.page; B.page = p; B.chat = []; $("alog").innerHTML = ""; $("actx").textContent = host(p.url).toUpperCase();
  const seg = s => s.length > 1 && s[1] ? `<a data-href="${esc(s[1])}">${esc(s[0])}</a>` : esc(s[0]);
  const body = p.blocks.map(b=>{ const inner = b.s.map(seg).join(""); return b.t === "li" ? `<li>${inner}</li>` : `<${b.t}>${inner}</${b.t}>`; }).join("");
  $("bview").innerHTML = `<article class="reader"><div class="src">${esc(p.url)}</div><h1 class="t">${esc(p.title)}</h1>${p.desc?`<p class="desc">${esc(p.desc)}</p>`:""}${body || '<p class="muted">This page has no readable text (it probably needs JavaScript). Open it in Chrome.</p>'}</article>`;
  $("bview").scrollTop = 0;
  $$("#bview a[data-href]").forEach(a=>a.onclick = ev=>{ ev.preventDefault(); if(ev.metaKey) window.open(a.dataset.href, "_blank"); else B.open(a.dataset.href); });
  $("alog").innerHTML = `<div class="suggest" style="justify-content:flex-start">${["Summarize this page","What are the key points?","Is this source trustworthy?"].map(t=>`<button class="chip">${t}</button>`).join("")}</div>`;
  $$("#alog .chip").forEach(c=>c.onclick = ()=>B.ask(c.textContent));
  aGhost.setPrediction("Summarize this page");
};
B.ask = async q=>{
  q = (q||"").trim(); if(!q) return;
  if(!B.page){ toast("Open a page first", "The assistant answers about the page in the reader."); return; }
  $("ain").value = ""; aGhost.clear(); HIST.add("page", q);
  B.chat.push({role:"user", content:q});
  const qa = document.createElement("div"); qa.innerHTML = `<div class="q">${esc(q)}</div><div class="md" style="margin-top:6px"><span class="spin"></span></div>`;
  $("alog").querySelector(".suggest")?.remove(); $("alog").appendChild(qa);
  const out = qa.querySelector(".md"); let txt = "";
  try{
    await streamChat({provider:active.provider === "hermes" ? DEFAULT_MODEL.provider : active.provider, model:active.provider === "hermes" ? DEFAULT_MODEL.id : active.id,
      messages:B.chat, context:`${B.page.title}\n${B.page.url}\n\n${B.page.text}`}, ev=>{
      if(ev.type === "delta"){ txt += ev.text; out.innerHTML = md(txt); $("alog").scrollTop = 1e9; }
      else if(ev.type === "error") throw new Error(ev.error);
    });
    B.chat.push({role:"assistant", content:txt});
    aGhost.predict();
  }catch(e){ out.innerHTML = `<span class="err">⚠ ${esc(e.message)}</span>`; }
};
$("bgo").onclick = ()=>B.nav($("baddr").value);
$("baddr").addEventListener("keydown", e=>{ if(e.key === "Enter") B.nav($("baddr").value); });
$("bback").onclick = ()=>{ if(B.idx > 0){ B.idx--; B.render(); } };
$("bfwd").onclick = ()=>{ if(B.idx < B.hist.length - 1){ B.idx++; B.render(); } };
$("breload").onclick = B.reload;
$("bext").onclick = ()=>{ const e = B.cur(); if(e && e.type === "page") window.open(e.url, "_blank"); else if(e) window.open("https://duckduckgo.com/?q=" + encodeURIComponent(e.q), "_blank"); };
$("bside").onclick = ()=>{ $("bro").classList.toggle("noside"); $("bside").classList.toggle("on"); };
$("asend").onclick = ()=>B.ask($("ain").value);
$("ain").addEventListener("keydown", e=>{ if(e.key === "Enter") B.ask($("ain").value); });
new Ghost($("baddr"), {kind:"browser", local:()=>[...HIST.get("browser"), ...SITES, ...SITES.map(s=>"https://" + s)]});
const aGhost = new Ghost($("ain"), {kind:"page", context:()=>[{role:"system", content:B.page ? "Page: " + B.page.title : ""}, ...B.chat.slice(-4)],
  local:()=>[...HIST.get("page"), "Summarize this page", "What are the key points?", "Is this source trustworthy?", "Explain this like I'm new to it"]});

/* =====================================================================================
   HERMES ORACLE — live AI signals
   ===================================================================================== */
const O = {data:null, filter:"All", brief:"", loading:false, consulting:false};
const SRC_HUE = s => { let h = 0; for(const c of s) h = (h*31 + c.charCodeAt(0)) % 360; return 215 + h % 75; };
const srcStyle = s => `color:hsl(${SRC_HUE(s)} 85% 78%);background:hsl(${SRC_HUE(s)} 60% 50% / .14);border:1px solid hsl(${SRC_HUE(s)} 70% 70% / .3)`;
async function loadNews(force){
  if(O.loading) return; if(O.data && !force){ renderOracle(); return; }
  O.loading = true; $("oscan").textContent = "SCANNING…"; $("oled").className = "led ok";
  try{ O.data = await api.get("/api/news" + (force ? "?refresh=1" : "")); renderOracle(); renderHomeNews(); if(force) toast("Oracle rescanned", `${O.data.items.length} stories`, "good"); }
  catch(e){ $("oscan").textContent = "SCAN FAILED"; $("oled").className = "led"; toast("Oracle scan failed", e.message, "bad"); }
  O.loading = false;
}
const newFree = ()=>M.list.filter(m=>m.free && m.new);
function renderOracle(){
  const d = O.data; if(!d) return;
  const live = d.items.filter(i=>Date.now()/1000 - i.ts < 172800).length, ok = d.sources.filter(s=>!s.error).length;
  $("oscan").textContent = `LAST SCAN ${ago(d.fetched).toUpperCase()}`; $("oled").className = "led ok";
  $("ostats").innerHTML = [[live,"LIVE STORIES · 48H"],[`${ok}/${d.sources.length}`,"SOURCES ONLINE"],[M.loaded ? newFree().length : "—","NEW FREE MODELS · 7D"],[d.trending.length,"TRENDING ON HF"]]
    .map(([v,l])=>`<div class="stat glass"><b>${v}</b><span>${l}</span></div>`).join("");
  const srcs = ["All", ...new Set(d.items.map(i=>i.source))];
  $("ofilt").innerHTML = srcs.map(s=>`<button class="chip ${O.filter===s?"on":""}" data-s="${esc(s)}">${esc(s)}</button>`).join("");
  $$("#ofilt .chip").forEach(c=>c.onclick = ()=>{ O.filter = c.dataset.s; renderOracle(); });
  const items = d.items.filter(i=>O.filter === "All" || i.source === O.filter).slice(0, 80);
  $("ofcount").textContent = `${items.length} SIGNALS`;
  $("ofeed").innerHTML = items.map(i=>`<div class="news" data-url="${esc(i.link)}"><span class="src" style="${srcStyle(i.source)}">${esc(i.source.toUpperCase())}</span><div class="nt">${esc(i.title)}</div>${i.summary?`<div class="ns">${esc(i.summary)}</div>`:""}<div class="nm">${ago(i.ts)} · ${esc(host(i.link))}</div><button class="btn ghost sm draft">${icon("spark")}Draft this</button></div>`).join("");
  $$("#ofeed .news").forEach((n, k)=>{
    n.onclick = ()=>{ go("browser"); B.open(n.dataset.url); };
    n.querySelector(".draft").onclick = e=>{ e.stopPropagation(); draftFrom(items[k]); };
  });
  $("otrend").innerHTML = d.trending.slice(0, 10).map(t=>`<div class="lrow"><span title="${esc(t.id)}">${esc(t.id)}</span><small>${esc(t.task||"")} · ♥ ${t.likes??0}</small></div>`).join("") || `<div class="empty">Unavailable</div>`;
  $$("#otrend .lrow").forEach((r,i)=>r.onclick = ()=>{ go("browser"); B.open(d.trending[i].url); });
  $("osrc").innerHTML = d.sources.map(s=>`<div class="lrow"><i class="led ${s.error?"":"ok"}"></i><span>${esc(s.name)}</span><small title="${esc(s.error||"")}">${s.error?"error":s.count+" items"}</small></div>`).join("")
    + (window.S && S.oracle ? S.oracle.map(w=>`<div class="lrow"><i class="led idle"></i><span>Watcher · ${esc(w.label)}</span><small>${w.tracked!=null?w.tracked+" tracked · ":""}${ago(w.checked)}</small></div>`).join("") : "");
  renderOracleSide();
}
function renderOracleSide(){
  if(!$("onew")) return;
  const l = newFree();
  $("onew").innerHTML = !M.loaded ? `<div class="empty"><span class="spin"></span></div>` : l.length ? l.slice(0, 10).map(m=>`<div class="lrow"><span title="${esc(m.id)}">${esc(shortName(m))}</span><small>${esc(provName(m.provider))}</small><button class="btn ghost sm" data-k="${esc(m.key)}">Use</button></div>`).join("")
    : `<div class="empty" style="padding:12px 0">No new free models this week yet. The catalog checks every 30 minutes and pings you here when one appears.</div>`;
  $$("#onew [data-k]").forEach(b=>b.onclick = ()=>setActive(M.list.find(m=>m.key === b.dataset.k)));
  if(O.data) $("ostats").querySelectorAll(".stat b")[2] && ($("ostats").querySelectorAll(".stat b")[2].textContent = l.length);
}
function oraclePrompt(spoken){
  const d = O.data;
  const items = d.items.slice(0, 45).map((it,i)=>`${i+1}. [${it.source}] ${it.title} (${ago(it.ts)})`).join("\n");
  const nm = newFree().slice(0, 10).map(m=>`${provName(m.provider)}: ${m.id}`).join(", ") || "none detected this week";
  const tr = d.trending.slice(0, 10).map(t=>t.id).join(", ");
  return `You are the Hermes Oracle inside AgentOS. From these live AI headlines, tell Jacob what's hot in AI right now. Use only the data given.\n\nHEADLINES:\n${items}\n\nNEW FREE MODELS IN HIS CATALOG (7 days): ${nm}\nTRENDING ON HUGGING FACE: ${tr}\n\n`
    + (spoken ? "Give a spoken briefing: the three biggest stories, one free model worth trying, and one thing to build or learn today. Under 120 words, plain sentences."
              : "Format: one bold line summing up the day. Then '## Top signals' with 5 bullets (what happened + why it matters, name the source). Then '## Free models to try' with 1–3 bullets. Then '## Make today' with 2 concrete things Jacob could build or learn. Be specific.");
}
O.consult = async spoken=>{
  if(!O.data) await loadNews(); if(!O.data) return;
  if(spoken) return converse("Consult the Oracle", {prompt:oraclePrompt(true)});
  if(O.consulting) return; O.consulting = true;
  const model = active.provider === "hermes" ? DEFAULT_MODEL : active;
  $("obrief").classList.add("on"); $("oorb").classList.add("busy"); $("obmodel").textContent = shortName(model).toUpperCase();
  $("obtext").innerHTML = `<div class="status"><span class="spin"></span> Reading ${O.data.items.length} signals…</div>`; O.brief = "";
  try{
    await streamChat({provider:model.provider, model:model.id, messages:[{role:"user", content:oraclePrompt(false)}]}, ev=>{
      if(ev.type === "delta"){ O.brief += ev.text; $("obtext").innerHTML = md(O.brief); }
      else if(ev.type === "thinking" && !O.brief) $("obtext").innerHTML = `<div class="status"><span class="spin"></span> The Oracle is reasoning over ${O.data.items.length} signals… ${ev.n.toLocaleString()} chars of thought</div>`;
      else if(ev.type === "error") throw new Error(ev.error);
    });
  }catch(e){ $("obtext").innerHTML = `<span class="err">⚠ ${esc(e.message)}</span>`; }
  $("oorb").classList.remove("busy"); O.consulting = false;
};
$("oconsult").onclick = ()=>O.consult(false);
$("ohear").onclick = ()=>{ if(O.brief){ stopSpeaking(); O.brief.split(/(?<=[.!?])\s+|\n+/).forEach(speakChunk); } else { go("home"); O.consult(true); } };
$("orescan").onclick = ()=>loadNews(true);
function renderHomeNews(){
  if(!O.data) return;
  $("hnews").innerHTML = O.data.items.slice(0, 5).map(i=>`<div class="item" data-url="${esc(i.link)}">${esc(i.title)}<small>${esc(i.source)} · ${ago(i.ts)}</small></div>`).join("");
  $$("#hnews .item").forEach(n=>n.onclick = ()=>{ go("browser"); B.open(n.dataset.url); });
}

/* =====================================================================================
   TEAM HERMES + AI FACTORY (live state from /api/state)
   ===================================================================================== */
window.S = null; let selBot = null;
const botState = b => (b.counts.running||0) ? "run" : ((b.counts.blocked||0) ? "blk" : "idle");
function renderCrew(){
  if(!S) return;
  $("crewcount").textContent = S.crew.length + " UNITS";
  $("crew").innerHTML = S.crew.map(b=>{
    const open = (b.counts.running||0) + (b.counts.ready||0) + (b.counts.todo||0);
    return `<div class="bot ${selBot===b.name?"sel":""}" data-bot="${esc(b.name)}"><i class="dot ${botState(b)}"></i><div><b>${esc(b.name)}</b><em>${esc(b.current || b.role)}</em></div><span class="n">${open||""}</span></div>`;
  }).join("");
  $$("#crew .bot").forEach(el=>el.onclick = ()=>{ selBot = selBot === el.dataset.bot ? null : el.dataset.bot; HUD.select(selBot); renderCrew(); });
  const b = S.crew.find(x=>x.name === selBot);
  $("detail").innerHTML = b
    ? `<strong>${esc(b.name.toUpperCase())}</strong><br>${esc(b.role)}<br>${b.triggers.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}${b.never_auto?`<br><span style="color:var(--gold)">⚠ explicit mention only</span>`:""}`
    : `<span class="mono" style="letter-spacing:.2em;font-size:10px">SELECT A UNIT</span><br>Click a node in the scene or a row above to inspect a crew member.`;
  $("hcrewn").textContent = S.gateway ? "DISPATCHER ONLINE" : "DISPATCHER OFFLINE";
  $("hcrew").innerHTML = S.crew.map(b=>`<div><i class="dot ${botState(b)}"></i>${esc(b.name)}</div>`).join("");
}
HUD.onSelectBot = n=>{ selBot = n; renderCrew(); };
function renderKanban(){
  const c = {}; S.tasks.forEach(t=>c[t.status] = (c[t.status]||0) + 1);
  $("cols").innerHTML = [["ready","READY"],["running","RUNNING"],["blocked","BLOCKED"],["done","DONE"]].map(([k,l])=>`<div class="col ${k==="running"&&c[k]?"hot":""}"><b>${c[k]||0}</b><span>${l}</span></div>`).join("");
  $("kb-total").textContent = S.tasks.length + " CARDS";
  $("tasks").innerHTML = S.tasks.length ? S.tasks.slice(0, 30).map(t=>`<div class="task"><span class="st ${esc(t.status)}">${esc(t.status.toUpperCase())}</span><div class="t">${esc(t.title)}</div><div class="m">${esc(t.assignee||"—")} · ${esc(t.id)} · ${ago(t.completed_at||t.started_at||t.created_at)}</div></div>`).join("")
    : `<div class="empty">Board clear — dispatch a task below.</div>`;
  $("feed").innerHTML = S.tasks.slice(0, 4).map(t=>`<span><b>${esc((t.assignee||"?").toUpperCase())}</b> ${esc(t.status)} · ${ago(t.completed_at||t.started_at||t.created_at)}</span>`).join("") || `<span>NO ACTIVITY YET</span>`;
}
function renderFactory(){
  const c = S.curator, sk = S.skills || [];
  if(!c || c.error){ $("cur-state").textContent = "OFFLINE"; return; }
  $("cur-state").textContent = c.paused ? "PAUSED" : c.enabled ? "ARMED" : "DISABLED";
  $("fac-big").innerHTML = [["ACTIVE",c.active],["STALE",c.stale],["ARCHIVED",c.archived]].map(([l,v])=>`<div class="col ${l==="ACTIVE"?"hot":""}"><b>${v}</b><span>${l}</span></div>`).join("");
  const next = c.last_run_at && c.interval ? (()=>{ const m = /(\d+)d/.exec(c.interval); if(!m) return "—"; const d = (Date.parse(c.last_run_at) + m[1]*864e5 - Date.now())/864e5; return d <= 0 ? "due now" : "in " + d.toFixed(1) + "d"; })() : "—";
  $("fac-kv").innerHTML = [["CONSOLIDATE", c.consolidate?`<span class="on-pill">ON</span>`:`<span class="off-pill">OFF</span>`], ["INTERVAL", esc(c.interval||"—")], ["NEXT RUN", next], ["RUNS", c.runs ?? "—"], ["STALE AFTER", esc(c.stale_after||"—")], ["ARCHIVE AFTER", esc(c.archive_after||"—")]]
    .map(([k,v])=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`).join("") + `<div class="detail" style="min-height:0">${esc(c.summary||"")}</div>`;
  $("sk-total").textContent = sk.length + " SKILLS";
  const top = sk.slice().sort((a,b)=>b.act-a.act).slice(0, 40), max = top[0] ? top[0].act : 1;
  $("sk-list").innerHTML = top.map(s=>`<div class="sk"><span>${esc(s.name)}</span><i>${esc(s.last)}</i><div class="bar"><u style="width:${Math.max(2, s.act/max*100)}%;${s.dormant?"opacity:.35":""}"></u></div></div>`).join("");
  $("ledger").innerHTML = (c.ledger||[]).slice(0, 12).map(l=>`<div><b>${esc(l.action)}</b>${esc(l.skill)}</div>`).join("") || `<div>NO RECENT CHANGES</div>`;
  $("oracle").innerHTML = (S.oracle||[]).map(o=>`<span><b>ORACLE</b> ${esc(o.label)}${o.tracked!=null?" · "+o.tracked+" tracked":""}</span>`).join("");
}
function renderHomeStats(){
  if(!M.loaded) return;
  $("hstats").innerHTML = [[M.list.filter(m=>m.free).length,"FREE MODELS"],[newFree().length,"NEW · 7D"],[`${M.providers.filter(p=>p.ok).length}/${M.providers.length}`,"PROVIDERS"]]
    .map(([v,l])=>`<div><b>${v}</b><span>${l}</span></div>`).join("");
  const n = newFree().length; $("newbadge").hidden = !n; $("newbadge").textContent = n;
  $("catstat").textContent = `CATALOG · ${M.list.filter(m=>m.free).length} FREE`; $("led-cat").className = "led ok";
}
let evSeen = LS.get("evseen", 0);
async function poll(){
  try{
    S = window.S = await api.get("/api/state");
    HUD.apply(S); renderCrew(); renderKanban(); renderFactory();
    $("led-gw").classList.toggle("ok", !!S.gateway); $("gw").textContent = S.gateway ? "DISPATCHER ONLINE" : "DISPATCHER OFFLINE";
    const ev = (S.catalog && S.catalog.events) || [];
    if(!evSeen){ evSeen = Date.now()/1000; LS.set("evseen", evSeen); }
    const fresh = ev.filter(e=>e.ts > evSeen);
    if(fresh.length){
      evSeen = Math.max(...fresh.map(e=>e.ts)); LS.set("evseen", evSeen);
      fresh.slice(-3).forEach(e=>toast(`New free model: ${e.model}`, `on ${provName(e.provider)} — click to view`, "good", ()=>{ go("models"); $("mnew").checked = true; renderModels(); }));
      M.loaded = false; loadModels();
    }
    if(S.catalog && S.catalog.refreshed > M.refreshed + 1 && M.loaded){ M.loaded = false; loadModels(); }
  }catch{ $("led-gw").classList.remove("ok"); $("gw").textContent = "LINK LOST"; }
  setTimeout(poll, 3000);
}
async function sendDispatch(dry){
  const task = $("cmd").value.trim(); if(!task) return;
  $("cmdout").textContent = dry ? "Routing…" : "Dispatching…";
  try{ const j = await api.post("/api/dispatch", {task, dry}); $("cmdout").textContent = j.out || ""; if(!dry && j.ok){ $("cmd").value = ""; HIST.add("crew", task); } }
  catch(e){ $("cmdout").textContent = "Dispatch failed: " + e.message; }
}
$("go").onclick = ()=>sendDispatch(false); $("prev").onclick = ()=>sendDispatch(true);
$("cmd").addEventListener("keydown", e=>{ if(e.key === "Enter") sendDispatch(e.shiftKey); });
new Ghost($("cmd"), {kind:"crew", local:()=>[...HIST.get("crew"), "research ", "research the latest free models on OpenRouter and Nous and compare them", "write a ", "build a script that ", "review and verify "]});

/* ---------- global keys, links, clock ---------- */
document.addEventListener("click", e=>{
  const a = e.target.closest("a[data-url]");
  if(a){ e.preventDefault(); if(e.metaKey || e.ctrlKey) window.open(a.dataset.url, "_blank"); else { go("browser"); B.open(a.dataset.url); } }
});
addEventListener("keydown", e=>{
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"){ e.preventDefault(); openPicker($("sidemodel")); return; }
  if(e.key === "Escape"){ closePicker(); $("modal").classList.remove("on"); if(V.listening || V.busy || V.speaking){ stopAll(); } return; }
  if(typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if(/^[1-9]$/.test(e.key)){ go(PAGES[+e.key - 1]); e.preventDefault(); }
  else if(e.code === "Space" && page === "home"){ e.preventDefault(); listen(); }
});
// Space from the empty home input also talks
$("vtext").addEventListener("keydown", e=>{ if(e.code === "Space" && !$("vtext").value && !vGhost.current()){ e.preventDefault(); listen(); } });
function tick(){
  const d = new Date(); $("clock").textContent = d.toLocaleTimeString([], {hour12:false});
  const h = d.getHours(); $("greet").innerHTML = `${h<5?"Working late":h<12?"Good morning":h<18?"Good afternoon":"Good evening"}, <b>Jacob</b>.`;
  $("gdate").textContent = d.toLocaleDateString([], {weekday:"long", month:"long", day:"numeric"}).toUpperCase() + " · ALL SYSTEMS NOMINAL";
}
setInterval(tick, 1000); tick();

/* ---------- boot ---------- */
(async function boot(){
  renderActive(); renderVoiceToggles(); renderSessions(); renderMsgs(); B.renderHome();
  poll(); loadModels(); loadNews();
  const start = (location.hash || "#home").slice(1); go(PAGES.includes(start) ? start : "home");
  if(!SR) $("micstat").textContent = "VOICE: CHROME ONLY";
  const lines = ["LINKING HERMES GATEWAY", "LOADING CREW CATALOG", "SYNCING LIVE MODEL CATALOG", "TUNING HERMES ORACLE", "VOICE SYSTEMS ONLINE"];
  const out = $("bootlines");
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){ $("boot").classList.add("gone"); return; }
  for(const l of lines){ out.textContent += "▸ " + l + "\n"; await new Promise(r=>setTimeout(r, 220)); }
  await new Promise(r=>setTimeout(r, 300)); $("boot").classList.add("gone");
})();


/* =====================================================================================
   APOLLO PARITY — briefing, memory, voice builds, real-browser control, Oracle drafts
   ===================================================================================== */
async function briefing(kind="daily"){
  setVState("think", "PREPARING BRIEFING");
  let f; try{ f = await api.get("/api/briefing"); }catch(e){ say("I couldn't gather the briefing data: " + e.message); return; }
  const part = f.hour < 12 ? "morning" : f.hour < 18 ? "afternoon" : "evening";
  const prompt = `Write Jacob's ${kind} briefing, spoken aloud by AgentOS in a calm JARVIS style. Start exactly with "Good ${part}, Jacob." `
    + `Then: how many open crew tasks and what's running or blocked; what got done; one line on the AI Factory; the 2 most important AI headlines; any new free models worth trying; `
    + `and end with the single best next step. ${kind === "weekly" ? "Frame it as a look back at the week and the week ahead. Under 160 words." : "Under 110 words."} `
    + `Use only these facts and do not invent tasks:\n${JSON.stringify(f)}`;
  if(page !== "home") miniShow("");
  return converse(kind === "weekly" ? "Give me my weekly briefing" : "Give me my daily briefing", {prompt});
}

/* memory */
let MEM = [];
async function loadMemory(){ try{ MEM = (await api.get("/api/memory")).memories; }catch{} renderMemory(); }
function renderMemory(){
  $("memlist").innerHTML = MEM.slice().reverse().map(m=>`<div class="mem"><span>${esc(m.text)}</span><small>${ago(m.ts)}</small><button data-id="${esc(m.id)}" title="Forget">✕</button></div>`).join("")
    || `<div class="empty">Nothing yet. Try saying “remember that I prefer short answers”.</div>`;
  $$("#memlist [data-id]").forEach(b=>b.onclick = async ()=>{ await api.post("/api/memory/delete", {id:b.dataset.id}); loadMemory(); });
}
async function memoryAdd(text, spoken){
  text = text.trim().replace(/^(?:my|i)\b/i, s=>s); if(!text) return;
  try{ await api.post("/api/memory", {text}); await loadMemory(); if(spoken) say("Noted. I'll remember that."); else toast("Remembered", text, "good"); }
  catch(e){ spoken ? say("I couldn't save that: " + e.message) : toast("Couldn't save", e.message, "bad"); }
}
async function memoryRecall(q){
  await loadMemory();
  const words = (q||"").toLowerCase().split(/\W+/).filter(w=>w.length > 2);
  const hits = words.length ? MEM.filter(m=>words.some(w=>m.text.toLowerCase().includes(w))) : MEM;
  if(!hits.length) return say(q ? `I don't have anything saved about ${q}.` : "My memory is empty so far. Say “remember that…” to teach me.");
  say((q ? `About ${q}: ` : `I remember ${hits.length} thing${hits.length>1?"s":""}. `) + hits.slice(-6).map(m=>m.text).join(". ") + ".");
}
async function memoryForget(q){
  await loadMemory();
  const words = q.toLowerCase().split(/\W+/).filter(w=>w.length > 2);
  const scored = MEM.map(m=>({m, s:words.filter(w=>m.text.toLowerCase().includes(w)).length})).filter(x=>x.s).sort((a,b)=>b.s-a.s);
  if(!scored.length) return say(`I don't have anything matching ${q}.`);
  await api.post("/api/memory/delete", {id:scored[0].m.id}); await loadMemory();
  say(`Forgotten: ${scored[0].m.text}.`);
}
$("memadd").onclick = ()=>{ const t = $("memin").value.trim(); if(t){ $("memin").value = ""; memoryAdd(t, false); } };
$("memin").addEventListener("keydown", e=>{ if(e.key === "Enter") $("memadd").click(); });

/* voice builds */
const BD = {list:[], sel:null, busy:false};
async function loadBuilds(){
  try{ const d = await api.get("/api/builds"); BD.list = d.builds; $("bddir").textContent = d.dir.replace(/^\/Users\/[^/]+/, "~"); }catch{}
  renderBuilds();
}
function renderBuilds(){
  $("bdlist").innerHTML = BD.list.map(b=>`<div class="bd ${BD.sel===b.slug?"on":""}" data-s="${esc(b.slug)}"><b>${esc(b.title)}</b><small title="${esc(b.prompt)}">${esc(b.prompt)}</small><small>${ago(b.ts)} · ${esc((b.model||"").split("::").pop())}</small></div>`).join("")
    || `<div class="empty">No builds yet. Say “build me a snake game”.</div>`;
  $$("#bdlist .bd").forEach(el=>el.onclick = ()=>showBuild(el.dataset.s));
}
function showBuild(slug){
  const b = BD.list.find(x=>x.slug === slug); if(!b) return;
  BD.sel = slug; $("bdtitle").textContent = b.title.toUpperCase();
  // srcdoc (not src): no frame request for blockers to intercept; the sandbox attribute keeps it an opaque origin
  fetch(b.url, {cache:"no-store"}).then(r=>r.text()).then(html=>{ if(BD.sel === slug) $("bdframe").srcdoc = html; }).catch(e=>{ $("bdstat").innerHTML = `<span class="err">⚠ ${esc(e.message)}</span>`; });
  $("bdopen").disabled = $("bddel").disabled = false; $("bdstat").textContent = ""; renderBuilds();
}
$("bdopen").onclick = ()=>{ const b = BD.list.find(x=>x.slug === BD.sel); b && window.open(b.url, "_blank", "width=1100,height=800"); };
$("bddel").onclick = async ()=>{ if(!BD.sel || !confirm("Remove this build? (moved to AgentOS-Builds/.trash)")) return; await api.post("/api/builds/delete", {slug:BD.sel}); BD.sel = null; $("bdframe").srcdoc = ""; $("bdtitle").textContent = "PREVIEW"; loadBuilds(); };
async function buildApp(prompt, spoken){
  prompt = prompt.trim(); if(!prompt) return; if(BD.busy){ spoken && say("I'm still building the last one."); return; }
  BD.busy = true; HIST.add("build", prompt);
  if(spoken){ say(`On it. Building ${prompt.replace(/^(build|make|create|code)( me)?\s*/i, "").replace(/[.!?]+$/, "")}.`); }
  go("builds"); $("bdin").value = ""; $("bdgo").disabled = true;
  const model = active.provider === "hermes" ? DEFAULT_MODEL : active;
  $("bdstat").innerHTML = `<span class="spin"></span> Building with ${esc(shortName(model))}…`; $("bdtitle").textContent = "BUILDING…";
  try{
    const r = await fetch("/api/build", {method:"POST", headers:{"Content-Type":"application/json","X-AgentOS":"1"}, body:JSON.stringify({prompt, provider:model.provider, model:model.id})});
    const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "", done = null;
    for(;;){
      const {value, done:end} = await reader.read(); if(end) break;
      buf += dec.decode(value, {stream:true}); let i;
      while((i = buf.indexOf("\n\n")) >= 0){
        const line = buf.slice(0, i); buf = buf.slice(i + 2); if(!line.startsWith("data:")) continue;
        const ev = JSON.parse(line.slice(5));
        if(ev.type === "thinking") $("bdstat").innerHTML = `<span class="spin"></span> Designing… ${ev.n.toLocaleString()} chars of reasoning`;
        else if(ev.type === "progress") $("bdstat").innerHTML = `<span class="spin"></span> Writing code… ${ev.chars.toLocaleString()} chars`;
        else if(ev.type === "error") throw new Error(ev.error);
        else if(ev.type === "done") done = ev;
      }
    }
    if(!done) throw new Error("the build stream ended early");
    await loadBuilds(); showBuild(done.slug);
    $("bdstat").textContent = `Built in ${(done.ms/1000).toFixed(1)}s · saved to ${done.path.replace(/^\/Users\/[^/]+/, "~")}`;
    if(spoken) say(`${done.title} is ready. It's running on the Builds page.`); else toast(`${done.title} is ready`, "", "good");
  }catch(e){ $("bdstat").innerHTML = `<span class="err">⚠ ${esc(e.message)}</span>`; $("bdtitle").textContent = "PREVIEW"; if(spoken) say("The build failed: " + e.message); }
  BD.busy = false; $("bdgo").disabled = false;
}
$("bdgo").onclick = ()=>buildApp($("bdin").value, false);
$("bdin").addEventListener("keydown", e=>{ if(e.key === "Enter") buildApp($("bdin").value, false); });
new Ghost($("bdin"), {kind:"chat", local:()=>[...HIST.get("build"), "a snake game", "a pomodoro timer with a purple progress ring", "a markdown editor with live preview", "a habit tracker", "a typing speed test"]});
new Ghost($("memin"), {kind:"chat", remote:false, local:()=>["I prefer short, direct answers", "my bachelor's starts November 11, 2026", "I'm moving into IT operations and cybersecurity"]});

/* real-browser control */
const SITES_MAP = {youtube:"https://www.youtube.com", gmail:"https://mail.google.com", github:"https://github.com", "google drive":"https://drive.google.com", drive:"https://drive.google.com",
  calendar:"https://calendar.google.com", "hugging face":"https://huggingface.co", huggingface:"https://huggingface.co", openrouter:"https://openrouter.ai", "nous portal":"https://portal.nousresearch.com",
  linkedin:"https://www.linkedin.com", reddit:"https://www.reddit.com", "hacker news":"https://news.ycombinator.com", obsidian:"https://obsidian.md", claude:"https://claude.ai", chatgpt:"https://chatgpt.com"};
function resolveSite(q){
  const k = q.toLowerCase().replace(/^the /, "").trim();
  if(SITES_MAP[k]) return SITES_MAP[k];
  const dom = k.replace(/\s?dot\s?/g, ".").replace(/\s/g, "");
  if(/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(dom)) return "https://" + dom;
  return "https://duckduckgo.com/?q=" + encodeURIComponent("!ducky " + q);
}
async function openChrome(url, msg){
  try{ await api.post("/api/open", {url}); say(msg); }catch(e){ say("I couldn't open Chrome: " + e.message); }
}

/* Oracle → draft a post in Chat */
function draftFrom(item){
  go("chat"); newChat();
  $("cin").value = `Draft a short, punchy social post with a clear point of view about this AI story. Give me 2 variants and a one-line hook for each.\n\n${item.title}\n${item.summary||""}\n${item.link}`;
  sendChat();
}

if(V.wake) setTimeout(wakeStart, 1500);
