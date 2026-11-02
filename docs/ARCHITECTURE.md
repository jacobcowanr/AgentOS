# Architecture

AgentOS has three parts:
- **`web/server.py`:** one Python process (standard library + PyYAML) bound to `127.0.0.1:9120`.
- **The UI:** a single-page app (`index.html`, `app.js`, `app.css`, `hud.js`) opened in a Chrome `--app` window.
- **Helpers:** small scripts run in AgentOS's own `.venv` for speech and PDFs, plus `notebooklm-mcp` for NotebookLM.

## Components

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TB
    subgraph Browser["AgentOS window (Chrome --app)"]
        direction TB
        HUD["hud.js<br/>three.js: voice orb · crew constellation · skill galaxy"]
        APP["app.js<br/>router · voice loop · chat · browser · oracle<br/>models · builds · memory · ghost text · attachments"]
        SR["Web Speech API<br/>speech recognition"]
        AUD["Audio queue<br/>neural speech playback + level meter"]
    end
    subgraph Server["web/server.py · 127.0.0.1:9120"]
        direction TB
        HTTP["ThreadingHTTPServer<br/>Host check · X-AgentOS header"]
        CHAT["/api/chat (SSE)<br/>persona · memory · routing · fallback"]
        CAT["Model catalog<br/>8 providers + custom"]
        WEB["Web: Exa search + reader"]
        NEWS["Oracle: RSS + HF trending"]
        PF["NotebookLM client<br/>MCP stdio"]
        FILES["Uploads<br/>images · PDFs · text"]
        TTSH["/api/tts<br/>streams MP3"]
        BLD["Builds<br/>sandboxed apps"]
        CREW["Crew + Factory<br/>kanban.db · curator"]
    end
    APP <--> HTTP
    HUD --- APP
    SR --> APP
    AUD --- APP
    HTTP --> CHAT & CAT & WEB & NEWS & PF & FILES & TTSH & BLD & CREW
    CHAT --> CAT
    CHAT --> WEB
    CHAT --> PF
    CHAT --> FILES
```

## Runtime topology

One Python process serves everything. Each request gets its own thread, three daemon threads keep data fresh, and anything heavy runs as a short-lived child process.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    subgraph Win["Chrome --app window"]
        FE["index.html · app.js · hud.js"]
    end
    subgraph Py["python3 web/server.py (one process)"]
        direction TB
        MAIN["ThreadingHTTPServer<br/>one thread per request"]
        STATE[("Shared in-memory state<br/>model catalog · TTL cache · speech cache")]
        T1["catalog_loop<br/>every 10 min"]
        T2["news_loop<br/>every 15 min"]
        T3["portfolio_loop<br/>every 5 min"]
        MCP["MCP client<br/>JSON-RPC over stdio"]
    end
    subgraph Kids["Child processes (started on demand)"]
        direction TB
        TTS["tts_stream.py<br/>.venv python"]
        PDF["pdf_extract.py<br/>.venv python"]
        SIPS["sips<br/>image resize"]
        HZ["hermes -z<br/>agent mode"]
        DSP["agentos-dispatch<br/>route.py then hermes kanban"]
        CUR["hermes curator<br/>status · usage"]
        OPN["open -a Google Chrome"]
        NB["notebooklm-mcp<br/>headless Chrome"]
    end
    FE <-- "HTTP · SSE" --> MAIN
    MAIN --- STATE
    T1 & T2 & T3 --- STATE
    MAIN --> TTS & PDF & SIPS & HZ & DSP & CUR & OPN
    MAIN --> MCP
    T3 --> MCP
    MCP --> NB
```

## Startup sequence

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
sequenceDiagram
    autonumber
    actor You
    participant App as AgentOS.app
    participant CLI as bin/agentos
    participant Srv as web/server.py
    participant Chr as Chrome --app
    participant UI as app.js
    You->>App: open AgentOS
    App->>CLI: run agentos
    CLI->>Srv: curl http://127.0.0.1:9120/
    alt server not running
        CLI->>Srv: nohup python3 web/server.py (log in /tmp/agentos-web.log)
        loop up to 20 times, 0.3 s apart
            CLI->>Srv: curl until it answers
        end
    end
    Srv->>Srv: start the catalog, news and portfolio threads
    CLI->>Chr: --app=http://127.0.0.1:9120/ (1560 by 940)
    Note over CLI,Chr: without Chrome installed it uses the default browser
    Chr->>Srv: GET / and the static files
    UI->>Srv: GET /api/state (then every 3 s)
    UI->>Srv: GET /api/models and /api/news
    UI->>UI: boot lines, then reveal Home
    Note over Srv: after 8 s the portfolio loop asks NotebookLM one warm-up question
```

## Life of a chat request

Every spoken or typed message goes through `POST /api/chat`. The reply streams back as Server-Sent Events. Each step only happens when it's needed:

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
sequenceDiagram
    autonumber
    participant UI as app.js
    participant S as server.py /api/chat
    participant R as Router (Cerebras gpt-oss, ~0.3s)
    participant X as Exa search
    participant N as NotebookLM
    participant M as Chat model chain
    UI->>S: messages + web=auto + attachments + voice flag
    S->>S: persona + spoken style + memory notes
    alt last message has files
        S->>S: skip web search (the question is about the file)
    else web = auto
        S->>R: does this need live info or Jacob's portfolio?
        R-->>S: search, query, portfolio
        S-->>UI: route event
    end
    opt search
        S-->>UI: status "Searching the web"
        S->>X: rewritten query
        X-->>S: results with dates
        S-->>UI: sources
    end
    opt portfolio summary or deep
        S->>S: add synced portfolio digest
        opt deep lookup
            S-->>UI: status "Checking your portfolio"
            S->>N: ask_question (75s, one fresh-session retry)
            N-->>S: grounded answer
        end
    end
    opt attachments
        S->>S: PDF/text into context, images as image parts
    end
    S->>M: stream (vision chain if images, else chosen model then fallbacks)
    M-->>S: deltas
    S-->>UI: delta, delta, ... done
    Note over UI: voice mode splits sentences to /api/tts and plays them in order
```

**The chain rules:**
- If the chosen model fails *before saying anything* (busy, 429, 5xx), the next model in the chain answers.
- If a model fails mid-reply, the error is shown. AgentOS never splices two models into one answer.
- Hermes Agent mode skips all of this and runs `hermes -z` with the conversation as context.

## Front end

The UI is vanilla JavaScript with no build step. `app.js` owns state, pages and the voice loop. `hud.js` owns the 3D canvas and exposes `window.HUD`.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TB
    NAV["Sidebar and router<br/>go(page) · keys 1 to 9"]
    subgraph Core["Shared plumbing in app.js"]
        direction LR
        API["api.get / api.post<br/>adds X-AgentOS: 1"]
        SC["streamChat()<br/>reads the SSE stream"]
        POLL["poll()<br/>/api/state every 3 s"]
        GH["Ghost text<br/>history + /api/suggest"]
        ATT["Attachments<br/>drop · paste · clip"]
        LS[("localStorage<br/>chats · history · settings")]
    end
    subgraph Pages["Pages"]
        direction LR
        HOME["Home<br/>voice loop · intents<br/>speech queue"]
        CHAT["Chat<br/>sessions"]
        BRW["Browser<br/>search · reader · assistant"]
        ORC["Oracle"]
        MOD["Models<br/>catalog · picker · providers"]
        BLD["Builds"]
        MEM["Memory<br/>+ portfolio card"]
        CREW["Team Hermes<br/>AI Factory"]
    end
    HUD["hud.js · window.HUD<br/>three.js canvas"]
    NAV --> Pages
    Pages --> API & SC & GH & ATT
    Pages --> LS
    POLL --> CREW
    POLL --> HUD
    HOME -- "setMode · audio level" --> HUD
    HUD -- "onSelectBot" --> CREW
```

### The 3D scene

One canvas and one camera serve three scenes. Only the active scene is visible, and the camera glides between presets when you change page.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    IN1["HUD.setMode<br/>idle · listen · think · speak"] --> ORB
    IN2["Audio level<br/>real meter, or a synthesised pulse<br/>while she speaks"] --> ORB
    IN3["HUD.apply(state)<br/>crew and skill list from /api/state"] --> TEAMG & SKY
    subgraph Scene["three.js scene"]
        ORB["Voice orb (Home)<br/>particle sphere · wireframe core · rings<br/>colour follows the voice state"]
        TEAMG["Crew constellation (Team Hermes)<br/>orchestrator on top, bots on a ring<br/>running = gold · blocked = red"]
        SKY["Skill galaxy (AI Factory)<br/>golden-angle spiral per origin<br/>size by activity · dormant dimmed"]
    end
    CAM["Camera presets<br/>home · team · factory · ambient"] --> Scene
    Scene --> OUT["Raycast hover tooltip<br/>click a bot to select it"]
```

## API reference

### API map

Every route passes the same gate first. The groups below are the whole surface.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    GATE{"Gate<br/>Host is 127.0.0.1 or localhost<br/>POST also needs X-AgentOS: 1"}
    GATE --> G1["Chat and models<br/>POST /api/chat (SSE)<br/>POST /api/suggest<br/>GET /api/models · POST /api/models/test<br/>POST /api/providers · /api/providers/delete"]
    GATE --> G2["Knowledge<br/>GET · POST /api/memory · /api/memory/delete<br/>GET /api/portfolio · POST /api/portfolio/ask · /refresh<br/>POST /api/upload · GET /api/upload/{id}/thumb"]
    GATE --> G3["Web<br/>GET /api/search · /api/read<br/>GET /api/news · POST /api/open"]
    GATE --> G4["Voice<br/>GET /api/voices · /api/tts"]
    GATE --> G5["Crew<br/>GET /api/state · /api/briefing<br/>POST /api/dispatch"]
    GATE --> G6["Builds<br/>GET /api/builds · /builds/{slug}/...<br/>POST /api/build (SSE) · /api/builds/delete"]
    GATE --> G7["Static files<br/>GET / and web/ assets"]
```


**All routes:** requests must target `127.0.0.1` or `localhost` (DNS-rebinding guard).

**POST routes:** also require the header `X-AgentOS: 1`. A custom header forces a CORS preflight, which the server never grants, so other websites can't call these routes.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/state` | Crew, Kanban cards, curator, skills, Oracle watchers, catalog events (polled every 3s) |
| GET | `/api/models[?refresh=1]` | Live model catalog + provider status |
| POST | `/api/models/test` | Ping one model; result cached in `catalog_state.json` |
| POST | `/api/providers` · `/api/providers/delete` | Add/replace or remove a custom provider (or a pasted key for a built-in) |
| POST | `/api/chat` | **SSE**: `route` · `status` · `sources` · `thinking` · `model` · `delta` · `done` · `error` |
| POST | `/api/suggest` | Ghost-text completion / next-message prediction |
| GET | `/api/search?q=` | Exa web search |
| GET | `/api/read?url=` | Fetch a page and return a readable version (private addresses blocked) |
| GET | `/api/news[?refresh=1]` | Oracle: 9 RSS feeds + Hugging Face trending |
| GET | `/api/briefing` | Facts for the daily/weekly briefing |
| GET/POST | `/api/memory` · `/api/memory/delete` | Long-term memory notes |
| GET | `/api/portfolio` | NotebookLM status + synced digest |
| POST | `/api/portfolio/ask` · `/api/portfolio/refresh` | Live NotebookLM question / re-sync the digest |
| POST | `/api/upload` | Raw-body upload (`X-Filename` header), 25 MB max |
| GET | `/api/upload/{id}/thumb` | Thumbnail for an image or rendered PDF page |
| GET | `/api/voices` · `/api/tts?text=&voice=&rate=` | Voice list · streamed MP3 speech |
| GET | `/api/builds` · `/builds/{slug}/index.html` | Build list · built app (served with a CSP sandbox) |
| POST | `/api/build` · `/api/builds/delete` | **SSE** build · move a build to `.trash` |
| POST | `/api/open` | Open an http(s) URL in the real Chrome |
| POST | `/api/dispatch` | Run `bin/agentos-dispatch` (optionally `--dry-run`) |

## Background jobs

| Job | Cadence | What it does |
|---|---|---|
| Catalog loop | checks every 10 min, refreshes if older than 30 min | Lists models from every provider, flags newly seen free models (NEW for 7 days), emits catalog events the UI turns into toasts |
| News loop | every 15 min | Re-pulls the 9 feeds + HF trending |
| Portfolio loop | on launch, then every 5 min | Warm-up question to NotebookLM. Re-syncs the digest if older than 3 days, closes the headless browser after 30 idle minutes, prunes uploads older than 30 days |
| UI poll | every 3 s | `/api/state` drives crew/Kanban/factory panels and new-model toasts |

### Job schedule

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    subgraph C["catalog_loop"]
        C1["refresh_catalog()<br/>skips if fresher than 30 min"] --> C2["sleep 10 min"] --> C1
    end
    subgraph N["news_loop"]
        N1["sleep 15 min"] --> N2["pull 9 feeds + HF trending"] --> N3["replace the cached copy"] --> N1
    end
    subgraph P["portfolio_loop"]
        P0["prune uploads older than 30 days"] --> P1["sleep 8 s"]
        P1 --> P2{"notebooklm-mcp installed?"}
        P2 -- yes --> P3["warm-up question"] --> P4
        P2 -- no --> P4
        P4{"digest older than 3 days?"}
        P4 -- yes --> P5["refresh_digest()"] --> P6
        P4 -- no --> P6
        P6{"bridge idle over 30 min?"}
        P6 -- yes --> P7["close the headless Chrome"] --> P8
        P6 -- no --> P8["sleep 5 min"]
        P8 --> P4
    end
```

## Local data

Everything stateful lives in `~/.hermes/agentos/data/`. The folder is gitignored.

| File | Contents | Mode |
|---|---|---|
| `providers.json` | Custom providers and pasted API keys | 600 |
| `memory.json` | Memory notes | 600 |
| `portfolio_digest.json` | Synced NotebookLM profile | 600 |
| `catalog_state.json` | When each model was first seen + test results | 644 |
| `notebooklm.log` | The NotebookLM bridge's own log | 644 |
| `uploads/{id}/` | Original file, normalized image or rendered pages, extracted text, `meta.json` | 644 |

Built apps live in `~/Projects/AgentOS-Builds/{slug}/` (`index.html` + `agentos.json`). Removed builds go to `.trash/`.

### Storage map

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    SRV["web/server.py"]
    subgraph Data["~/.hermes/agentos/data (gitignored)"]
        PJ[("providers.json<br/>custom providers, pasted keys · 600")]
        ME[("memory.json<br/>notes · 600")]
        DG[("portfolio_digest.json<br/>synced profile · 600")]
        CS[("catalog_state.json<br/>first seen, test results")]
        UP[("uploads/{id}/<br/>original, normalised image or pages,<br/>extracted text, meta.json")]
        NL[("notebooklm.log")]
    end
    subgraph RO["Read-only inputs"]
        EN[("~/.hermes/.env<br/>provider keys")]
        KB[("~/.hermes/kanban.db<br/>opened read-only")]
        SK[("~/.hermes/skills<br/>.curator_state · .curator_ledger.jsonl")]
        OW[("~/.hermes/scripts<br/>oracle_*.state.json")]
        CAT[("catalog.yaml<br/>crew roster and triggers")]
    end
    subgraph Out["Outside the repo"]
        BD[("~/Projects/AgentOS-Builds/{slug}/<br/>index.html · agentos.json · .trash/")]
        TM[("vault Hermes Team/team_memory.md<br/>appended by the bots")]
    end
    subgraph Br["In the browser"]
        LS[("localStorage<br/>chats (40) · history · voice settings")]
    end
    SRV --> Data
    EN --> SRV
    KB --> SRV
    SK --> SRV
    OW --> SRV
    CAT --> SRV
    SRV --> BD
```

## Caching

`cached(key, ttl, fn)` wraps every slow read. A failing source never blanks the UI: the last good value is served instead.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    Q["cached(key, ttl, fn)"] --> H{"Stored value younger than ttl?"}
    H -- yes --> R1["Return it"]
    H -- no --> F["Run fn()"]
    F --> OK{"Succeeded?"}
    OK -- yes --> V["value = fresh result"]
    OK -- no --> OLD{"Older value exists?"}
    OLD -- yes --> V2["value = the stale one"]
    OLD -- no --> V3["value = error object"]
    V & V2 & V3 --> S["Store (now, value)"] --> R2["Return it"]
```

| Cache | TTL | Holds |
|---|---|---|
| Kanban cards | 2 s | `kanban.db` rows |
| Gateway check | 5 s | whether the Hermes gateway is running |
| Curator · Oracle watchers | 30 s | `hermes curator status`, watcher state files |
| Skills | 60 s | `hermes curator usage` |
| Ghost-text suggestions | 5 min | one completion per input and context |
| Web search | 10 min | Exa results per query |
| News | 15 min | 9 feeds + Hugging Face trending |
| Model catalog | 30 min (checked every 10) | provider model lists |
| Speech | last 60 | synthesised MP3 clips |
