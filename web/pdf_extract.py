"""Extract a PDF for AgentOS. Run with AgentOS's venv: .venv/bin/python -I pdf_extract.py IN.pdf OUT_DIR
Writes OUT_DIR/text.txt; if the PDF is mostly scanned (little text), renders the first pages to OUT_DIR/page-N.png.
Prints a JSON summary on stdout."""
import json, sys
from pathlib import Path
import pypdf, pypdfium2

src, out = Path(sys.argv[1]), Path(sys.argv[2])
MAX_RENDER = 6

reader = pypdf.PdfReader(str(src))
pages = len(reader.pages)
texts = []
for i, p in enumerate(reader.pages):
    try: t = p.extract_text() or ""
    except Exception: t = ""
    texts.append(f"--- page {i + 1} ---\n{t.strip()}")
text = "\n\n".join(texts)
(out / "text.txt").write_text(text)
chars = sum(len(t) for t in texts) - sum(len(f"--- page {i + 1} ---\n") for i in range(pages))

rendered = []
if chars < 200 * max(1, min(pages, MAX_RENDER)):          # scanned / image-only PDF: give the vision model page images
    pdf = pypdfium2.PdfDocument(str(src))
    for i in range(min(pages, MAX_RENDER)):
        img = pdf[i].render(scale=1.6).to_pil()
        f = out / f"page-{i + 1}.png"; img.save(f); rendered.append(f.name)

print(json.dumps({"pages": pages, "chars": max(0, chars), "rendered": rendered, "title": (reader.metadata or {}).get("/Title") or ""}))
