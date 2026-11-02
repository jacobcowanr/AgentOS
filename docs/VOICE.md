# Voice

Home is a voice interface. You speak through Chrome's speech recognition. She answers with a natural female neural voice (Microsoft, via `edge-tts`), streamed sentence by sentence, while the orb follows the real loudness of both voices.

## The voice stack

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    MIC["Microphone"] --> SR["Chrome speech recognition<br/>audio goes to Google"]
    SR --> APP["app.js<br/>patience timer · intents"]
    APP <--> SRV["server.py /api/chat<br/>streamed reply"]
    APP --> Q["Speech queue"]
    Q --> TTS["/api/tts then edge-tts<br/>text goes to Microsoft"]
    TTS --> AUD["Audio element"]
    AUD --> SPK["Speakers"]
    AUD -- "analyser level" --> HUD["Orb pulses with her voice"]
    MIC -- "level meter" --> HUD
```

## States

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
stateDiagram-v2
    [*] --> Idle
    Idle --> Listening: Space · mic · floating reactor
    Idle --> WakeWatch: wake word on
    WakeWatch --> Listening: "Hey AgentOS" (or "Hey Jarvis")
    WakeWatch --> Thinking: "Hey AgentOS, <request>"
    Listening --> Listening: still talking (patience timer re-armed)
    Listening --> Thinking: silence longer than patience
    Listening --> Idle: nothing heard
    Thinking --> Speaking: first sentence ready
    Thinking --> Idle: speech off
    Speaking --> Speaking: next sentence (prefetched)
    Speaking --> Listening: hands-free on
    Speaking --> WakeWatch: wake word on
    Speaking --> Idle: done
    Thinking --> Idle: Esc / "stop"
    Speaking --> Idle: Esc / "stop" / mic tapped
```

The orb's color follows the state: **purple** idle, **blue** listening, **violet** thinking (spins faster), **lavender** speaking (pulses with her voice).

## From your voice to her voice

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
sequenceDiagram
    autonumber
    participant You
    participant SR as Chrome speech recognition
    participant App as app.js
    participant Srv as server.py
    participant TTS as /api/tts (edge-tts)
    You->>SR: speak
    SR-->>App: interim + final words (continuous)
    App->>App: wait for your pause (1.5 / 2.5 / 4s)
    App->>App: match an intent (open, build, remember, brief, dispatch…)
    alt intent matched
        App->>Srv: the matching action
    else conversation
        App->>Srv: POST /api/chat (voice=true, web=auto)
        Srv-->>App: streamed text
        loop each sentence or pair of sentences
            App->>TTS: GET /api/tts?text=…&voice=Ava (starts loading immediately)
            TTS-->>App: MP3 bytes as they are synthesized
            App->>You: play in order while the next one loads
        end
    end
```

- **Speed:** the first sentence goes out on its own so she starts talking quickly (about 1.2s to first audio). Later sentences are paired for a more natural flow. Replays come from a 60-item cache.
- **Fallback:** if the neural voice can't be reached, the rest of the reply uses a female macOS system voice (Samantha, Karen, Moira…), never a male one.

## How she understands you

Every utterance, spoken or typed, is checked against a short list of intents in this order. The first match wins. Anything else is a normal conversation.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart LR
    U["Final transcript or typed text"] --> H["Saved to voice history"] --> M{"First matching intent"}
    M --> I1["stop · cancel · never mind<br/>stop everything"]
    M --> I2["open or show a page<br/>navigate"]
    M --> I3["open a web address<br/>Browser"]
    M --> I4["ask my portfolio ...<br/>deep NotebookLM lookup"]
    M --> I5["search the web for ...<br/>search, then answer"]
    M --> I6["remember · what do you remember · forget<br/>Memory"]
    M --> I7["what's new in AI · consult the oracle<br/>Oracle briefing"]
    M --> I8["brief me · good morning<br/>daily or weekly briefing"]
    M --> I9["build me a ... game, app, tool<br/>Builds"]
    M --> I10["play ... on YouTube · open ... in Chrome<br/>your real Chrome"]
    M --> I11["tell the crew to ...<br/>dispatch to Team Hermes"]
    M --> I12["switch model · hands-free · refresh the catalog<br/>controls"]
    M -- "no match" --> CONV["converse()<br/>chat in Auto, Web or Agent mode"]
```

### One conversational turn

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    A["converse(text)"] --> B["Cancel any reply in progress, stop speaking"]
    B --> C["Add to history (last 20 turns) with any attachments"]
    C --> D["POST /api/chat with voice on<br/>web = auto, true or agent mode"]
    D --> E["Stream events: status · route · sources · delta"]
    E --> F{"Spoken replies on?"}
    F -- yes --> G["Feed each delta to the speech queue"]
    F -- no --> H["Show the text only"]
    E --> I{"Reply claims it has no live access<br/>and no search ran?"}
    I -- yes --> J["Drop that turn and retry once with web on"]
    J --> D
    I -- no --> K["Keep the reply, predict the next message<br/>then back to idle, hands-free or wake word"]
```

## How she speaks

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    D["Streamed text delta"] --> BUF["Sentence buffer"]
    BUF --> S1{"First sentence of this reply?"}
    S1 -- yes --> SEND1["Send at once<br/>fast first word"]
    S1 -- no --> SH{"Sentence under 120 characters?"}
    SH -- yes --> PAIR["Wait for the next one, send the pair"]
    SH -- no --> SEND2["Send alone"]
    SEND1 & PAIR & SEND2 --> CK{"Neural voice on?"}
    CK -- yes --> AUD["new Audio pointing at /api/tts<br/>starts loading immediately"]
    CK -- "no, or System voice chosen" --> SYS["Browser speech synthesis"]
    AUD & SYS --> Q["Playback queue, strictly in order"]
    Q --> P{"Next item"}
    P -- "audio error" --> FB["Neural off for this reply<br/>remaining text re-queued as system voice<br/>toast: Neural voice unavailable"]
    P -- "queue empty" --> DONE["speechDone()<br/>hands-free listens · wake word re-arms · else idle"]
```

On the server, `/api/tts` validates, checks the cache, then streams audio as it is synthesised.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#efe9ff','primaryTextColor':'#1b1533','primaryBorderColor':'#8b6cef','lineColor':'#6b5bd6','secondaryColor':'#e4eaff','tertiaryColor':'#f7f5ff','edgeLabelBackground':'#ffffff','fontFamily':'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif','fontSize':'14px','noteBkgColor':'#fff6dc','noteTextColor':'#3a2f00','actorBkg':'#efe9ff','actorBorder':'#8b6cef','actorTextColor':'#1b1533','signalColor':'#4a3fb0','signalTextColor':'#1b1533'}}}%%
flowchart TD
    R["GET /api/tts?text&voice&rate&pitch"] --> V{"Valid?<br/>text 1 to 1,200 characters<br/>voice, rate and pitch match strict patterns"}
    V -- no --> E400["400"]
    V -- yes --> N{"Neural voice installed?<br/>(the .venv exists)"}
    N -- no --> E503["503<br/>browser falls back to the system voice"]
    N -- yes --> C{"In the 60-clip cache?"}
    C -- yes --> HIT["Send the cached MP3"]
    C -- no --> SP["Spawn .venv python -I tts_stream.py<br/>argument list, no shell · 45 s kill timer"]
    SP --> FIRST{"Any audio bytes?"}
    FIRST -- no --> E502["502 no audio returned"]
    FIRST -- yes --> STR["Stream MP3 chunks as they arrive"]
    STR --> OK{"Exited cleanly?"}
    OK -- yes --> STORE["Cache it, oldest evicted past 60"]
    OK -- no --> SKIP["Not cached"]
```

## Settings (♪ in the sidebar)

| Setting | Options | Default |
|---|---|---|
| Voice | Ava, Emma, Jenny, Aria, Michelle (US) · Sonia, Libby (UK) · Natasha (AU) · Emily (IE) · System | Ava |
| Pace | Relaxed (−8%) · Natural · Brisk (+8%) | Natural |
| Wait for me | Quick 1.5s · Normal 2.5s · Patient 4s of silence ends your turn | Normal |

**Voice bar buttons:** 🎤 talk · 📎 attach · **Auto / Web / Agent** · ☀ briefing · 👂 wake word · ∞ hands-free · 🔊 spoken replies.

## Things you can say

| Say | What happens |
|---|---|
| "Open the oracle / models / team hermes / builds…" | Navigates |
| "Search the web for …" | Answers from live results; the results also open in Browser |
| "What's new in AI?" · "Consult the oracle" | Spoken AI-news briefing |
| "Brief me" · "Good morning" · "Give me my weekly briefing" | Daily/weekly briefing: crew board, AI Factory, headlines, new free models, next step |
| "Remember that …" · "What do you remember about …?" · "Forget …" | Memory |
| "Ask my portfolio …" | Live NotebookLM lookup on your portfolio (~30s) |
| "Build me a snake game" | Writes and opens an app on the Builds page |
| "Tell the crew to …" | Dispatches to Team Hermes |
| "Switch model to step five" | Picks the best-matching free model |
| "Open github in Chrome" · "Play lofi on YouTube" | Opens your real Chrome |
| "Hands-free on/off" · "Refresh the catalog" · "Stop" | Controls |

Anything else is a normal conversation in **Auto** mode. AgentOS decides whether the question needs the web or your portfolio. If a reply still claims she has "no live access", it searches and asks again automatically.

**Ghost text:** gray suggestions appear in the voice bar as you type. Press **Tab** to accept, or **→** for one word. After she replies, the empty bar shows a guess at your next question.

## Privacy

- **Speech recognition** sends microphone audio to Google, as all Chrome speech recognition does. With the wake word on, audio streams continuously while it listens.
- **Spoken replies** send the reply text to Microsoft's speech service.

See [SECURITY.md](SECURITY.md) for everything that leaves the machine.
