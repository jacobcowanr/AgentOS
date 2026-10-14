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

### Dispatch flow

```mermaid
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

## AI Factory

The Hermes **curator** is the crew's self-improvement loop:
- **Creates:** `/learn` turns a URL, a folder or the current chat into a skill.
- **Maintains:** the curator marks stale skills and archives unused ones. It never deletes, and with consolidation on it merges overlapping skills.

The AI Factory page shows:
- **Curator panel:** active, stale and archived counts, the consolidation switch, interval, next run, and the last run's report.
- **Skill matrix:** every skill, ranked by activity, and drawn as a galaxy in 3D. Agent-made skills are lavender, bundled ones blue, hub skills cyan, and dormant ones dim.
- **Forge ledger:** recent skill changes, plus the Oracle watchers' status.

## Builds

"Build me a snake game" (by voice, or on the Builds page):

```mermaid
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
