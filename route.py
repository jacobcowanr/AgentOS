#!/usr/bin/env python3
"""AgentOS router: task text (+ optional explicit bots) -> JSON dispatch plan.

Usage: route.py <catalog.yaml> <task> [bot,bot,...]
Invariants (spawn-storm rules): only needed bots; librarian never auto;
orchestrator only for 2+ specialists or synthesis; no-match -> orchestrator alone.
"""
import json, re, sys, yaml

cat = yaml.safe_load(open(sys.argv[1]))["bots"]
task = sys.argv[2].lower()
explicit = [b.strip() for b in (sys.argv[3] if len(sys.argv) > 3 else "").split(",") if b.strip()]

def hit(trigs):
    return any(re.search(r"\b" + re.escape(t.lower()), task) for t in trigs)

if explicit:
    bad = [b for b in explicit if b not in cat]
    if bad:
        sys.exit(f"unknown bot(s): {bad}; valid: {list(cat)}")
    bots = explicit
else:
    bots = [b for b, c in cat.items() if b != "orchestrator" and hit(c.get("triggers", []))]
    # auditor verifies whatever the paired bots produce
    if "auditor" in cat:
        pair = cat["auditor"].get("always_pair_with", [])
        if any(p in bots for p in pair) and "auditor" not in bots:
            bots.append("auditor")
    specialists = [b for b in bots if b not in ("orchestrator", "auditor")]
    orch_trig = hit(cat.get("orchestrator", {}).get("triggers", []))
    if len(specialists) >= 2 or orch_trig or not bots:
        bots.insert(0, "orchestrator")
    # one specialist (+ its auditor) needs no orchestrator; a lone orchestrator trigger is handled above
    order = list(cat)
    bots = sorted(dict.fromkeys(bots), key=order.index)

# plan shape
workers = [b for b in bots if b not in ("orchestrator", "auditor", "writer")]
verifier = "auditor" if "auditor" in bots else None
synth = None
if "writer" in bots and workers:
    synth = "writer"
elif "writer" in bots:
    workers = ["writer"]
    synth = "orchestrator"
elif "orchestrator" in bots:
    synth = "orchestrator"
if len(bots) == 1 or (len(bots) == 2 and "orchestrator" in bots and not workers and not verifier):
    shape = "single"
elif verifier:
    shape = "swarm"
else:
    shape = "fanin"
if shape == "swarm" and not workers:       # e.g. auditor + orchestrator only
    shape = "single"; bots = [b for b in bots if b != "orchestrator"] or bots
if shape in ("swarm", "fanin") and not synth:
    synth = "orchestrator"
if shape in ("swarm", "fanin") and synth not in bots:
    bots.insert(0, synth)
print(json.dumps({"bots": bots, "shape": shape, "workers": workers, "verifier": verifier, "synth": synth}))
