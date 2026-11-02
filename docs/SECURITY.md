# Security & privacy

AgentOS is a personal tool that runs on one Mac. The server listens only on `127.0.0.1`. Its risks: API keys, your personal data, other websites poking at a local server, and generated code.

## What leaves the machine

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    subgraph Local["Stays on the Mac"]
        K[("API keys<br/>~/.hermes/.env · data/providers.json")]
        MEM[("Memory notes · portfolio digest<br/>uploads · chat history (browser storage)")]
        B[("Built apps")]
    end
    subgraph Out["Sent out (only when the feature is used)"]
        P["Model providers<br/>your messages, memory notes, relevant portfolio text,<br/>attached file contents"]
        E["Exa<br/>search queries"]
        G["Google (Chrome speech)<br/>microphone audio while listening"]
        MS["Microsoft (edge-tts)<br/>text she speaks"]
        NB["NotebookLM<br/>portfolio questions"]
        F["News sites · Hugging Face API<br/>plain GETs, no personal data"]
    end
    MEM -- "per request" --> P
    K -- "auth header only" --> P
```

API keys are only sent as auth headers to their own provider. They are never returned to the browser and never committed.

## Trust boundaries

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    subgraph Trusted["Trusted"]
        YOU["You, typing or speaking"]
        CODE["AgentOS code"]
        KEYS["Keys in ~/.hermes/.env<br/>and providers.json"]
    end
    subgraph Untrusted["Untrusted content: reference data, never instructions"]
        WEB["Web results and pages"]
        PF["Portfolio digest and<br/>NotebookLM answers"]
        ATT["Attached files"]
    end
    subgraph Gen["Untrusted code"]
        GEN["Model-generated apps"]
    end
    YOU --> CODE
    KEYS --> CODE
    WEB & PF & ATT --> WRAP["Labelled in the prompt as reference data, not instructions"] --> CODE
    CODE --> GEN
    GEN --> SBX["Sandboxed iframe and CSP sandbox<br/>opaque origin, no API access"]
```

## Guards

| Threat | Guard |
|---|---|
| Other websites calling the local API (CSRF) | Every POST needs `X-AgentOS: 1`. A custom header forces a CORS preflight, which is never granted |
| DNS rebinding | Requests must use `Host: 127.0.0.1` or `localhost` |
| Reader used to probe the local network (SSRF) | `/api/read` only fetches http(s), resolves the host first, refuses private, loopback and link-local addresses, and re-checks every redirect |
| Generated build code | Built apps run in a sandboxed `srcdoc` iframe and are served with `Content-Security-Policy: sandbox`, so they have an opaque origin and can't call the API, even in their own window |
| Untrusted content steering the model | Web results, portfolio text, attached files and NotebookLM answers are passed as *reference data, not instructions* |
| Static-file traversal | Only whitelisted extensions inside `web/` and `AgentOS-Builds/` are served. Paths are resolved and parent checks enforced |
| `/api/open` abuse | Only http(s) URLs, opened in Chrome |
| TTS and voice parameters | Voice, rate and pitch must match strict patterns before reaching a subprocess (argument list, no shell) |
| NotebookLM login wipe | `setup_auth` is refused in code. It's also excluded from the Hermes MCP config |
| Accidental key/data commits | `data/`, `.venv/`, `.env*` are gitignored. During development, staged changes have been scanned for key patterns and real `.env` values before each push. That is a manual step, not a git hook |

## Request guards

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    REQ["Incoming request"] --> HOST{"Host is 127.0.0.1 or localhost?"}
    HOST -- no --> F1["403<br/>DNS-rebinding guard"]
    HOST -- yes --> M{"Method"}
    M -- POST --> HDR{"Header X-AgentOS: 1?"}
    HDR -- no --> F2["403<br/>CSRF guard: a custom header forces a<br/>preflight that is never granted"]
    HDR -- yes --> API1["API handler"]
    M -- GET --> R{"Route"}
    R -- "/api/..." --> API2["API handler"]
    R -- "/builds/..." --> B{"Resolves inside AgentOS-Builds<br/>and extension allowed?"}
    B -- yes --> BS["Serve with CSP sandbox"]
    B -- no --> N1["404"]
    R -- "anything else" --> S{"Inside web/, extension on the list,<br/>file exists?"}
    S -- yes --> SF["Serve the static file"]
    S -- no --> N2["404"]
```

### Reader guard

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    U["URL for /api/read"] --> SCH{"http or https, with a host?"}
    SCH -- no --> X1["Refused"]
    SCH -- yes --> RES["Resolve the host to every IP address"]
    RES --> RNG{"Any address private, loopback, link-local,<br/>reserved, multicast or unspecified?"}
    RNG -- yes --> X2["Refused: private or local address"]
    RNG -- no --> GET["Fetch the page"]
    GET --> RED{"Redirected?"}
    RED -- yes --> CHK["Scheme and host checked again<br/>with the same rules"] --> GET
    RED -- no --> OK["Content returned"]
```

## Key storage

- **`~/.hermes/.env`:** the source of truth, shared with Hermes. Read fresh on each request, so edits apply without a restart.
- **Keys pasted in the Models page:** saved to `data/providers.json` with mode `600`. They override the env var for that provider, can be removed with ✕ on the provider card, and are never sent to the browser.

### Key flow

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    ENV[("~/.hermes/.env")] --> RES["Key resolution<br/>a pasted key overrides the env var"]
    PJ[("data/providers.json<br/>mode 600")] --> RES
    RES --> HDR["Authorization header<br/>on requests to that provider only"]
    HDR --> PROV["Provider API"]
    RES -. "never" .-> BR["Browser"]
    RES -. "never" .-> GIT["Git<br/>data/ and .env* are ignored"]
```

## Deletion policy

AgentOS removes things recoverably:
- removed builds → `AgentOS-Builds/.trash/`
- uploads → pruned after 30 days
- retired projects → moved to the macOS Trash
