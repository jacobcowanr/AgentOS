# Changelog

All dates 2026-10-14 (AgentOS was built in a single day on top of the existing Team Hermes + AI Factory setup).

## Documentation
- Complete docs with diagrams: architecture, voice, models & routing, knowledge, crew, security, operations; screenshots of every page.
- Builds page opens the newest build instead of an empty preview.

## Files: drag and drop (`6d694f4`)
- Drop anywhere, paste with ⌘V or use 📎 on Home and Chat. Accepts screenshots and images, PDFs (text or scanned) and text/code files.
- Images route automatically to a vision model (Cerebras Qwen 3.8 → Gemini Flash-Lite → Llama 3.2 Vision).
- Any model that is busy or down before its first word falls back to another free model.
- No auto web search for questions about an attached file.

## NotebookLM portfolio + listening patience (`6d9c706`)
- "Jacob's Career Portfolio" synced into a local profile for instant answers about you. "Ask my portfolio …" does a live lookup.
- Memory page knowledge-source card. AgentOS never calls `setup_auth`.
- Voice turns end after your chosen pause (1.5 / 2.5 / 4s) instead of Chrome's ~1s.

## Live web access by default (`67cff67`)
- **Auto** mode: a ~0.3s router decides per question whether to search, and rewrites the query.
- If a reply still claims "no live access", AgentOS searches and asks again.

## Natural female voice (`e504430`)
- Microsoft neural voices via edge-tts, streamed with prefetch. Ava by default, 9 voices, 3 paces.
- The orb follows real speech loudness. Warmer, more conversational spoken style.

## App launcher (`9afc0e0`)
- `/Applications/AgentOS.app` with a purple-crystal icon; `bin/build-app.sh`.

## Apollo parity (`b471898`)
- Wake word, daily/weekly briefings, Memory, voice-built apps (Builds), real-Chrome control, floating reactor, Oracle *Draft this*.

## AgentOS 1.0 (`1017b1f`)
- Voice home screen, Chat, Browser (Exa + reader), Hermes Oracle, live free-model catalog with custom providers, Team Hermes + AI Factory in one app, Claude-style ghost text.
- Team Hermes and AI Factory retired as standalone apps; their repos (`Team-Hermes`, `ai-factory`) hold the final state.
