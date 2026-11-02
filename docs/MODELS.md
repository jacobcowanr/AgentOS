# Models & routing

## Live catalog

The server lists models from every provider whose key is in `~/.hermes/.env`, plus any custom OpenAI-compatible provider you add on the Models page. It filters out non-chat models (embeddings, TTS, image generation…) and marks each model's tier:

| Provider | Key | How "free" is decided |
|---|---|---|
| Nous Portal | `NOUS_API_KEY` | price = 0 (`:free` models). Requests carry `tags: [product=agentos, user=…]` |
| OpenRouter | `OPENROUTER_API_KEY` | price = 0 |
| Hugging Face | `HF_TOKEN` | monthly free credits |
| Cerebras · Google Gemini · Mistral · NVIDIA NIM · Groq | provider key | free tier (rate-limited) |
| Custom | pasted key or env var | you choose |

**Refresh:** checked every 10 minutes and refreshed when older than 30, or on demand with *Refresh catalog*. A free model never seen before gets a **NEW** flag for 7 days, a sidebar badge, a toast and an entry in the Oracle's *New free models*.

**Test:** sends a one-word ping and records ✓ with its latency or ✗ with the error. The model picker (⌘K) lists tested-and-working models first.

### Key resolution

A pasted key beats the environment, so you can override one provider without touching `~/.hermes/.env`.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    P["Provider"] --> A{"Key pasted on the Models page?<br/>(data/providers.json)"}
    A -- yes --> K1["Use the pasted key"]
    A -- no --> B{"Provider names an env var?"}
    B -- no --> K4["No auth header<br/>(custom provider without a key)"]
    B -- yes --> C{"Value present in ~/.hermes/.env?<br/>(file re-read on every call)"}
    C -- yes --> K2["Use the env value"]
    C -- no --> D{"OpenRouter?"}
    D -- yes --> K3["List models without a key<br/>(its catalog is public)"]
    D -- no --> X["Provider shows offline:<br/>no key (NAME not in ~/.hermes/.env)"]
```

### Refresh pipeline

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    T1["catalog_loop<br/>every 10 min"] & T2["Refresh catalog<br/>or ?refresh=1"] & T3["Provider added<br/>or removed"] --> G{"Already refreshing, or not<br/>forced and under 30 min old?"}
    G -- yes --> KEEP["Keep the current catalog"]
    G -- no --> POOL["Ask every provider for GET /models<br/>in parallel (8 workers, 20 s timeout)"]
    POOL --> FAIL{"Provider failed but<br/>worked last time?"}
    FAIL -- yes --> STALE["Keep its last list, marked stale"]
    FAIL -- no --> USE["Use the fresh list<br/>or show the error"]
    STALE & USE --> FILT["Per model: drop non-chat,<br/>set tier, context size, vision flag"]
```

Then each model is stamped and the catalog is published:

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    M["Each model"] --> SEEN{"Seen before?"}
    SEEN -- "first ever run" --> BASE["Baseline only<br/>nothing is flagged NEW"]
    SEEN -- "no" --> REC["Record the first-seen time<br/>free models also emit a new_model event"]
    SEEN -- "yes" --> OLD["Keep its first-seen time"]
    BASE & REC & OLD --> NEW["NEW = first seen within 7 days<br/>attach the last test result"]
    NEW --> SORT["Sort: free, then NEW,<br/>then provider, then name"]
    SORT --> PUB["Save catalog_state.json<br/>publish, Hermes Agent entry first"]
    PUB --> UI["UI poll sees the new time<br/>a toast for each new free model"]
```

### Free or paid?

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    M["Model from a provider list"] --> NC{"Non-chat?<br/>embedding · TTS · image · moderation ...<br/>or output has no text"}
    NC -- yes --> DROP["Dropped"]
    NC -- no --> T{"Provider tier"}
    T -- "pricing<br/>(Nous, OpenRouter)" --> PR{"Prompt and completion price both 0?"}
    PR -- yes --> F1["free"]
    PR -- no --> P1["paid"]
    T -- "credits<br/>(Hugging Face)" --> F2["free credits"]
    T -- "free tier<br/>(Cerebras, Gemini, Mistral, NVIDIA, Groq)" --> F3["free tier, rate-limited"]
    T -- "custom" --> F4["free tier or paid<br/>(your choice when adding)"]
```

## Provider management

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
sequenceDiagram
    autonumber
    actor You
    participant UI as Models page
    participant S as server.py
    participant F as data/providers.json
    participant P as Provider API
    You->>UI: Add provider (name, base URL, key or env var name)
    UI->>S: POST /api/providers
    S->>S: validate name and http(s) base URL, make an id
    alt id is a built-in provider
        S->>F: store only the pasted key (mode 600)
    else custom provider
        S->>F: store the entry (mode 600)
    end
    S->>P: forced catalog refresh
    P-->>S: model list or error
    S-->>UI: provider status
    You->>UI: Test one model
    UI->>S: POST /api/models/test
    S->>P: "Reply with the single word: ready"
    P-->>S: reply
    S->>S: record the result in catalog_state.json
    S-->>UI: tick with latency, or the error
    You->>UI: Remove a provider
    UI->>S: POST /api/providers/delete
    S->>F: drop the entry
    alt built-in provider
        S->>S: forced refresh, falls back to the env key
    else custom provider
        S->>S: drop its models from the catalog
    end
```

## Routing

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    Q["Your message"] --> A{"Agent mode?"}
    A -- yes --> H["hermes -z<br/>full tool loop"]
    A -- no --> F{"Files attached<br/>to this message?"}
    F -- yes --> NOWEB["No web search"]
    F -- no --> W{"web = auto?"}
    W -- yes --> C["Router: Cerebras gpt-oss-120b<br/>~0.3s, keyword fallback"]
    C --> S{"needs live info?"}
    S -- yes --> EXA["Exa search → results with dates"]
    C --> P{"about Jacob?"}
    P -- summary --> DG["Portfolio digest"]
    P -- "deep / 'ask my portfolio'" --> NB["Live NotebookLM lookup"]
    NOWEB --> I{"Images in the conversation?"}
    EXA --> I
    S -- no --> I
    DG --> I
    NB --> I
    I -- "yes, model can't see" --> V["Vision chain"]
    I -- no --> M["Chosen model, then fallback chain"]
```

| Chain | Order (benchmarked 2026-10-14) |
|---|---|
| **Vision** (screenshots, images, scanned PDFs) | Cerebras `qwen-3.8-27b` (0.5s) → Gemini `gemini-3.5-flash-lite` (3.2s) → NVIDIA `llama-3.2-90b-vision-instruct` (3.9s). All three read a test screenshot correctly |
| **Fallback** (chosen model busy/down before its first word) | Cerebras `gpt-oss-120b` → Gemini `gemini-3.5-flash-lite` → OpenRouter `nvidia/nemotron-3.5-lightning:free` |
| **Router / ghost text** | Cerebras `gpt-oss-120b` (low reasoning, ~0.3s) → Nous `upstage/solar-mini4:free` (~1s) → Mistral `ministral-8b-latest` |
| **Builds** | the chosen model (Step 5 when the Hermes agent is selected). Cerebras `gpt-oss-120b` builds a small app in under 2s |

### Fallback logic

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    START["Chosen model"] --> IMG{"Images in the message?"}
    IMG -- no --> C1["Chain: chosen model, then<br/>Cerebras gpt-oss-120b → Gemini 3.5 Flash-Lite → OpenRouter Nemotron Lightning"]
    IMG -- yes --> VIS{"Chosen model can see images?"}
    VIS -- yes --> C2["Chain: chosen model, then the vision chain"]
    VIS -- no --> C3["Chain: the vision chain only<br/>Cerebras qwen-3.8-27b → Gemini → NVIDIA llama-3.2-90b-vision"]
    C1 & C2 & C3 --> TRY["Try the next model that has a key"]
    TRY --> R{"What happens?"}
    R -- "first word arrives" --> OK["Stream the whole reply from this model"]
    R -- "fails before any text" --> MORE{"Another model in the chain?"}
    MORE -- yes --> TRY
    MORE -- no --> E1["Show the last error"]
    R -- "fails after text started" --> E2["Show the error<br/>never splice two models together"]
```

The default chat model is **StepFun Step 5 Preview** on Nous Portal. It's strong, with the best briefings, but slow on long prompts (about 50s for an Oracle briefing) and occasionally "at capacity". The fallback chain covers it when it's busy.

## Persona

Every request gets:
- AgentOS's persona: warm, FRIDAY-to-JARVIS, aware that it has live web search.
- Today's date.
- Accurate facts about Hermes, such as `/learn` for skills.
- Your memory notes.
- Spoken replies add a conversational style guide: contractions, short sentences, no lists or URLs, under about 70 words.

## Ghost text

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    T["You type"] --> L{"Local match?<br/>history · commands · model names · sites"}
    L -- yes --> G["Gray suggestion<br/>instantly"]
    L -- no --> P["Pause 380 ms"] --> R["/api/suggest<br/>Cerebras ~0.3s"] --> G
    G --> K{"Tab / →"}
    K --> ACC["Accept all / one word"]
    D["Reply finished"] --> NP["Predict next message"] --> G
```

Ghost text runs on every input: the Home voice bar, the Chat composer, the Browser address bar, the page assistant, Team Hermes dispatch, Builds, Memory and the portfolio question box.
