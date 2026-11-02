# Crew: Team Hermes, AI Factory and Builds

## Team Hermes

Six Hermes bot profiles make up the crew. Their roles and routing triggers live in `catalog.yaml`, the single source of truth:

| Bot | Role | Notes |
|---|---|---|
| orchestrator | Coordinate multi-bot tasks, decompose, synthesize | Joins when 2+ specialists are involved |
| research | Find facts from live sources, cite every claim | |
| writer | Draft finished content from briefs | Paired with auditor |
| developer | Build and fix tools, scripts, automation, config | Paired with auditor |
| auditor | Verify claims, code and briefs before delivery | |
| librarian | Vault caretaker | **Only when named.** Never auto-summoned |

### Roster

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    subgraph Crew["catalog.yaml: six bots"]
        O["orchestrator<br/>coordinate · decompose · synthesize"]
        R["research<br/>live sources · cite every claim"]
        W["writer<br/>drafts from briefs"]
        DV["developer<br/>tools · scripts · config"]
        A["auditor<br/>verifies before delivery"]
        L["librarian<br/>vault caretaker"]
    end
    W -- "always paired with" --> A
    DV -- "always paired with" --> A
    R & W & DV -- "two or more specialists" --> O
    L -. "fires only when named" .-> NEVER["never auto-summoned"]
```

### How a task is routed

`route.py` is deterministic: the same task and catalog always give the same plan. It reads triggers from `catalog.yaml` and matches them at word starts, so "audit" also hits "auditing".

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    IN["Task text, plus optional --bots list"] --> EX{"Bots named explicitly?"}
    EX -- yes --> VAL{"Every name in the catalog?"}
    VAL -- no --> ERR["Stop: unknown bot"]
    VAL -- yes --> USE["Use exactly those bots"]
    EX -- no --> TR["Bots whose triggers match the task<br/>(orchestrator handled separately)"]
    TR --> PAIR{"Writer or developer chosen?"}
    PAIR -- yes --> AUD["Add the auditor"]
    PAIR -- no --> ORCH
    AUD --> ORCH{"Two or more specialists,<br/>an orchestrator trigger,<br/>or no match at all?"}
    ORCH -- yes --> ADD["Add the orchestrator"]
    ORCH -- no --> ORD
    ADD --> ORD["De-duplicate, keep catalog order"]
    USE --> SH
    ORD --> SH["Choose the shape"]
    SH --> SY{"One bot, or just orchestrator alone?"}
    SY -- yes --> SINGLE["single"]
    SY -- no --> VF{"Auditor present with workers?"}
    VF -- yes --> SWARM["swarm"]
    VF -- no --> FANIN["fan-in"]
    SWARM & FANIN --> SYN["Synthesizer: the writer if there are workers,<br/>otherwise the orchestrator (added if missing)"]
```

Run for real on the router, these tasks produce:

| Task | Bots | Shape | Synthesizer |
|---|---|---|---|
| "research the latest models" | research | single | none |
| "build a script" | orchestrator, developer, auditor | swarm | orchestrator |
| "research free models and write a summary" | orchestrator, research, writer, auditor | swarm | writer |
| "clean up the vault" | librarian | single | none |
| "tell me a joke" | orchestrator | single | orchestrator |

### Dispatch flow

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    T["Task<br/>voice · Team Hermes bar · agentos 'task'"] --> G{"Spawn-storm guard<br/>inside a bot/worker session?"}
    G -- yes --> X["Refuse (exit 3)"]
    G -- no --> R["route.py + catalog.yaml<br/>only the bots the task needs"]
    R --> SH{"Shape"}
    SH -- "one bot" --> S1["single card"]
    SH -- "workers + verify" --> SW["swarm: workers → auditor → orchestrator"]
    SH -- "workers, no verify" --> FI["fan-in: parallel cards → synthesis card"]
    S1 & SW & FI --> KB[("hermes kanban<br/>kanban.db")]
    KB --> DSP["Gateway dispatcher<br/>claims ready cards, runs the bot profile"]
    DSP --> LOG["Results appended to the vault's<br/>Hermes Team/team_memory.md"]
```

### The three shapes

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    subgraph S3["fan-in"]
        direction LR
        P1["worker card"] --> SY2["Synthesize card<br/>combines the parents"]
        P2["worker card"] --> SY2
    end
    subgraph S2["swarm"]
        direction LR
        W1["worker card"] --> V["auditor verifies"]
        W2["worker card"] --> V
        V --> SY1["synthesizer<br/>writes the final result"]
    end
    subgraph S1["single"]
        direction LR
        A1["one card<br/>one bot"]
    end
```

### From task to result

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
sequenceDiagram
    autonumber
    actor You
    participant D as agentos-dispatch
    participant R as route.py
    participant K as hermes kanban
    participant G as Gateway dispatcher
    participant B as Bot profile
    participant T as team_memory.md
    You->>D: agentos "task" (terminal, voice or the Team Hermes bar)
    D->>D: spawn-storm guard, refuse inside a bot session (exit 3)
    D->>R: catalog.yaml, task, optional bots
    R-->>D: plan with bots, shape, workers, verifier, synthesizer
    alt dry run
        D-->>You: print the plan, create nothing
    else dispatch
        D->>D: write team-tasks/tasks/ID.md and link current-task.md
        D->>K: create the card, swarm or fan-in cards
        D-->>You: card ids, returns at once
        G->>K: claim ready cards
        G->>B: run the assigned profile
        B->>T: append a dated result (append-only)
    end
```

**The five rules** (born from a real spawn-storm incident):
1. Only summon the bots the task needs.
2. Never auto-summon the librarian.
3. Include the orchestrator for 2+ specialists or synthesis.
4. Return control immediately.
5. Never dispatch from inside a bot session.

**On the Team Hermes page:**
- **3D constellation:** the bots, with the orchestrator on top. Running bots glow gold and send data packets along their links; blocked bots turn red.
- **Kanban panel:** live cards from `kanban.db`.
- **Command bar:** **Preview** shows the routing plan (dry run); **Dispatch** creates the cards.

### Reading the board

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    DB[("kanban.db<br/>opened read-only")] --> Q["Latest 60 cards<br/>archived ones excluded"]
    Q --> G{"Status"}
    G --> OPEN["Open: todo · ready · running · blocked · review"]
    G --> DONE["done"]
    OPEN --> CNT["Per-bot counts<br/>current task = first running card"]
    CNT --> UI["Team Hermes<br/>glowing nodes and the Kanban panel"]
    OPEN --> BR["Briefing<br/>open · running · blocked · next up"]
    DONE --> BR2["Briefing<br/>done in 24 h and 7 days"]
```

## AI Factory

The Hermes **curator** is the crew's self-improvement loop:
- **Creates:** `/learn` turns a URL, a folder or the current chat into a skill.
- **Maintains:** the curator marks stale skills and archives unused ones. It never deletes, and with consolidation on it merges overlapping skills.

The AI Factory page shows:
- **Curator panel:** active, stale and archived counts, the consolidation switch, interval, next run, and the last run's report.
- **Skill matrix:** every skill, ranked by activity, and drawn as a galaxy in 3D. Agent-made skills are lavender, bundled ones blue, hub skills cyan, and dormant ones dim.
- **Forge ledger:** recent skill changes, plus the Oracle watchers' status.

### Where the data comes from

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    subgraph H["Hermes (source of truth)"]
        CS["hermes curator status"]
        CU["hermes curator usage"]
        ST[(".curator_state")]
        LG[(".curator_ledger.jsonl")]
        OW[("oracle_*.state.json")]
    end
    CS & ST --> CP["Curator panel<br/>active · stale · archived<br/>consolidation · interval · last run"]
    CU --> SK["Skill rows<br/>name · origin · uses · patches · activity · last used"]
    SK --> GAL["Skill galaxy in 3D<br/>colour by origin · size by activity<br/>dormant (14 days or more) dimmed"]
    SK --> MAT["Skill matrix list"]
    LG --> FL["Forge ledger<br/>latest 14 changes"]
    OW --> WA["Oracle watchers<br/>items tracked · last check"]
    CP & GAL & MAT & FL & WA --> PG["AI Factory page<br/>server caches 30 to 60 s, UI polls every 3 s"]
```

### Skill lifecycle

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
stateDiagram-v2
    [*] --> Active: /learn creates a skill
    Active --> Active: patched, or merged when consolidation is on
    Active --> Stale: unused longer than stale after
    Stale --> Active: used again, reactivated
    Stale --> Archived: unused longer than archive after
    Archived --> Archived: kept, never deleted
    note right of Stale
        Thresholds are the curator's settings.
        This machine shows 14 days and 30 days.
    end note
```

## Builds

"Build me a snake game" (by voice, or on the Builds page):

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
sequenceDiagram
    participant You
    participant App as app.js
    participant S as server.py /api/build
    participant M as Chosen model
    You->>App: "build me a pomodoro timer"
    App->>S: prompt + model (SSE)
    S->>M: system: one self-contained HTML file, offline, Obsidian palette
    M-->>S: code (progress streamed to the UI)
    S->>S: extract HTML → ~/Projects/AgentOS-Builds/pomodoro-timer/
    S-->>App: done (title, path, ms)
    App->>You: "Pomodoro Timer is ready" + live preview
```

- **Sandboxed:** built apps run in a sandboxed `srcdoc` iframe, and are served with `Content-Security-Policy: sandbox`, so even *Open in window* gives them an opaque origin. Generated code can never call the AgentOS API.
- **Recoverable removal:** *Remove* moves a build to `AgentOS-Builds/.trash/`.

### Build lifecycle

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
stateDiagram-v2
    [*] --> Prompted: build me ...
    Prompted --> Designing: unique slug chosen, stream opened
    Designing --> Writing: model streams the code
    Writing --> Saved: HTML extracted, index.html and agentos.json written
    Writing --> Failed: no HTML returned, or the stream broke
    Saved --> Previewing: shown in a sandboxed iframe
    Previewing --> Saved: close the preview
    Saved --> Trashed: Remove moves it to .trash
    Failed --> [*]
    Trashed --> [*]
```

### Sandbox boundary

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    subgraph Trusted["AgentOS origin 127.0.0.1:9120"]
        UI["app.js"]
        API["/api/*"]
    end
    subgraph Box["Opaque origin (sandboxed)"]
        APP["Generated app<br/>inline HTML, CSS and JS only"]
    end
    UI -- "fetches the HTML, sets iframe srcdoc<br/>with the sandbox attribute" --> APP
    SRV["/builds/slug/index.html<br/>served with CSP sandbox"] -. "same rule when opened in its own window" .-> APP
    APP -. "blocked: no shared origin,<br/>cannot call the API or read AgentOS storage" .-> API
```
