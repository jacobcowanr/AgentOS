# Operations

## Run

| Action | How |
|---|---|
| Start + open | Open **AgentOS** from `/Applications`, Launchpad or Spotlight, or run `agentos` |
| Stop | `agentos --stop`. This also closes AgentOS's headless NotebookLM browser |
| Stock Hermes dashboard | `agentos --classic` (port 9119) |
| Dispatch from the terminal | `agentos "research the best free coding models"` · `agentos --dry-run "…"` · `agentos --status` |
| Pick up code changes | `agentos --stop && agentos`, then ⌘R in the window |

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    APP["/Applications/AgentOS.app<br/>(AppleScript launcher)"] --> BIN["~/.local/bin/agentos<br/>→ bin/agentos"]
    BIN --> UP{"server up on :9120?"}
    UP -- no --> START["nohup python3 web/server.py<br/>log: /tmp/agentos-web.log"]
    UP -- yes --> OPEN
    START --> OPEN["Chrome --app=http://127.0.0.1:9120"]
```

### Commands

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    A["agentos"] --> Q{"First argument"}
    Q -- "none" --> OPEN["Start the server if needed<br/>open the app window"]
    Q -- "--stop" --> STOP["pkill the server<br/>hermes dashboard --stop"]
    Q -- "--classic" --> CL["Start the stock dashboard on :9119<br/>and open it"]
    Q -- "anything else" --> DISP["exec agentos-dispatch"]
    DISP --> D1["--help"]
    DISP --> D2["--status<br/>hermes kanban list"]
    DISP --> D3["--dry-run task<br/>print the plan only"]
    DISP --> D4["--bots a,b task<br/>explicit bots"]
    DISP --> D5["task<br/>route, then create cards"]
```

## First-time setup (new machine)

1. Install and configure Hermes Agent. The crew profiles, Kanban and curator come from Hermes.
2. Clone this repo to `~/.hermes/agentos`, then link the launchers:
   ```bash
   ln -sf ~/.hermes/agentos/bin/agentos ~/.local/bin/agentos && ln -sf ~/.hermes/agentos/bin/agentos-dispatch ~/.local/bin/agentos-dispatch
   ```
3. Create AgentOS's helper environment (neural voice + PDFs):
   ```bash
   cd ~/.hermes/agentos && uv venv .venv && VIRTUAL_ENV=.venv uv pip install edge-tts pypdf pypdfium2 pillow
   ```
4. The server itself needs PyYAML: `python3 -m pip install pyyaml`.
5. Optional, for portfolio grounding: install `notebooklm-mcp` at `~/.npm-global/bin/notebooklm-mcp` and log in once through its own setup.
6. Put your keys in `~/.hermes/.env` (see the README).
7. Build the launcher: `bin/build-app.sh`

### Setup at a glance

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    H["1 Hermes Agent<br/>crew, Kanban, curator"] --> C["2 Clone to ~/.hermes/agentos<br/>link agentos and agentos-dispatch"]
    C --> V["3 .venv<br/>edge-tts · pypdf · pypdfium2"]
    C --> Y["4 PyYAML for the server"]
    C --> N["5 notebooklm-mcp<br/>optional, for the portfolio"]
    C --> K["6 Keys in ~/.hermes/.env"]
    V & Y & N & K --> B["7 bin/build-app.sh"] --> RUN["Open AgentOS"]
```

## Logs

| Log | Path |
|---|---|
| Server | `/tmp/agentos-web.log` |
| NotebookLM bridge | `~/.hermes/agentos/data/notebooklm.log` |
| Crew activity | `hermes kanban watch` · vault `Hermes Team/team_memory.md` |

## Troubleshooting

| Symptom | Fix |
|---|---|
| No AgentOS in Applications | Run `~/.hermes/agentos/bin/build-app.sh` |
| Mic does nothing / "Microphone blocked" | Click the site-settings icon in the AgentOS window and allow the microphone for 127.0.0.1. Speech recognition also needs internet |
| She cuts you off mid-sentence | ♪ in the sidebar → **Wait for me** → Patient (4s) |
| Robotic voice | The neural voice service was unreachable, so AgentOS used the system voice. Check internet, then ♪ → preview a voice |
| "Model at capacity" / slow replies | Normal for free tiers. The fallback chain answers automatically. Or pick a faster model (⌘K), such as Cerebras `gpt-oss-120b` |
| Portfolio lookups time out | Check `data/notebooklm.log`. If it says you're logged out, log in again through `notebooklm-mcp`'s own setup (**not** from AgentOS). Re-sync from the Memory page |
| Catalog shows a provider offline | Hover the provider card for the error. "no key" means add it on the card or in `~/.hermes/.env` |
| Dispatcher offline | `hermes gateway status`, then `hermes gateway start` (or `hermes gateway run` in the foreground). Kanban cards wait until it runs |
| A page won't open in Browser | The reader can't run scripts or logins. Use ↗ to open it in Chrome |
| Upload refused | Only images, PDFs and text/code files up to 25 MB. Broken PDFs are rejected with the parser's error |

### Triage flow

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    S["Something is wrong"] --> W{"Does the window open?"}
    W -- no --> A1["Run agentos in a terminal<br/>read /tmp/agentos-web.log"]
    W -- yes --> X{"Which area?"}
    X -- "Voice" --> V1{"Mic silent?"}
    V1 -- yes --> V2["Allow the microphone for 127.0.0.1<br/>speech recognition needs internet"]
    V1 -- no --> V3{"Robotic voice?"}
    V3 -- yes --> V4["Neural service unreachable<br/>check internet, then preview a voice"]
    V3 -- no --> V5["Cut off mid-sentence?<br/>Wait for me: Patient"]
    X -- "Models" --> M1{"Slow or at capacity?"}
    M1 -- yes --> M2["Normal on free tiers<br/>fallback answers, or pick a faster model"]
    M1 -- no --> M3["Provider offline?<br/>hover the card, add the key"]
    X -- "Portfolio" --> P1["Read data/notebooklm.log<br/>log in through notebooklm-mcp, then Re-sync"]
    X -- "Crew" --> C1["Dispatcher offline?<br/>hermes gateway status, then start"]
    X -- "Browser or uploads" --> B1["Reader can't run scripts or logins: open in Chrome<br/>uploads: images, PDFs, text up to 25 MB"]
```

## Rebuilding the app icon

`assets/agentos.svg` is the source. To regenerate `assets/AgentOS.icns`, render it to PNG with transparency, make an iconset with `sips`, and run `iconutil`. Then run `bin/build-app.sh`.

### Building the app

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    A["AgentOS.applescript"] --> B["osacompile<br/>creates AgentOS.app"]
    I["assets/AgentOS.icns"] --> C["Copy in as applet.icns<br/>remove Assets.car"]
    B --> C --> D["PlistBuddy<br/>bundle id and display name"] --> E["Ad-hoc codesign"] --> F["touch, then lsregister<br/>refresh Launch Services"] --> G["/Applications/AgentOS.app"]
```
