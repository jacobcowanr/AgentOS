# AgentOS

A local, voice-first operating system for a [Hermes Agent](https://hermes-agent.nousresearch.com) crew. It puts Team Hermes and the AI Factory under one roof, with a JARVIS-style voice home screen, a live free-model catalog, a web browser and the Hermes Oracle AI-news feed.

Runs on `127.0.0.1:9120` only. Python standard library plus PyYAML on the server. Vanilla JS and three.js r128 (vendored) in the browser.

## Pages

| Page | What it does |
|---|---|
| **Home** | Voice orb. Talk with Space or the mic. Hands-free mode keeps the conversation going. Modes: Chat, Web (search-grounded) and Agent (full Hermes tool loop). Understands commands such as "open the oracle", "search the web for …", "tell the crew to …", "switch model to …" and "what's new in AI?" |
| **Chat** | Multi-session chat with any free model, optional web grounding and spoken replies |
| **Browser** | Exa web search plus a server-side reader view, with a page assistant that summarizes and answers questions about the open page |
| **Hermes Oracle** | Live AI news from 9 feeds, Hugging Face trending and new free models. *Consult the Oracle* writes a briefing; *Hear the brief* reads it aloud |
| **Models** | Live catalog from Nous Portal, OpenRouter, Hugging Face, Cerebras, Gemini, Mistral, NVIDIA and Groq, plus any OpenAI-compatible provider you add. Free-tier filter, one-click test, NEW flags and auto-refresh every 30 minutes |
| **Builds** | "Build me a snake game." A model writes one self-contained HTML app, saves it to `~/Projects/AgentOS-Builds/` and runs it in a sandbox. Built apps are served with a CSP `sandbox` header, so they can never call the AgentOS API |
| **Memory** | "Remember that…", "What do you remember about…?", "Forget…". Notes are injected into every model as context. Stored in `data/memory.json` (mode 600, gitignored) |
| **Team Hermes** | 3D crew constellation, Kanban board, and catalog-routed dispatch (`bin/agentos-dispatch`) |
| **AI Factory** | Curator state, skill matrix galaxy and forge ledger |

**Apollo-style voice:**
- **Wake word**, off by default: say "Hey AgentOS" (or "Hey Jarvis") and then your request.
- **Daily or weekly briefing:** say "brief me", "good morning" or press ☀. It covers the crew board, the AI Factory, top headlines and new free models.
- **Real-browser control:** "open github in Chrome", "play lofi on YouTube".
- **Floating reactor:** a corner orb you can talk to from any page.

**Ghost text:** inline suggestions in every input. Tab accepts the whole suggestion; → accepts one word. Suggestions come from history and commands first, then a fast free model (Cerebras gpt-oss-120b, about 0.3s). After each reply it predicts your next message.

## Run

```bash
agentos            # start the server and open the app window (Chrome --app)
agentos --stop     # stop it
agentos "task"     # dispatch a task to the crew from the terminal
```

Keys are read from `~/.hermes/.env`: `NOUS_API_KEY`, `OPENROUTER_API_KEY`, `HF_TOKEN`, `CEREBRAS_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, `NVIDIA_API_KEY`, `GROQ_API_KEY` and `EXA_AI_API_KEY`. Keys pasted into the UI are saved to `data/providers.json` with mode 600. That file is gitignored and never sent to the browser.

Voice uses Chrome's Web Speech API, so speech recognition needs Chrome and an internet connection. Replies are spoken with the macOS system voices.
