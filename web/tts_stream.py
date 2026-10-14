"""Stream neural speech (MP3) to stdout. Run with AgentOS's own venv: .venv/bin/python -I tts_stream.py TEXT VOICE RATE PITCH"""
import asyncio, sys
import edge_tts


async def main():
    text, voice, rate, pitch = sys.argv[1:5]
    out = sys.stdout.buffer
    async for chunk in edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).stream():
        if chunk["type"] == "audio":
            out.write(chunk["data"]); out.flush()

asyncio.run(main())
