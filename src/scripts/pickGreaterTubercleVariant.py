"""Switch the greater tubercle hitbox between the variants in
greater-tubercle-variants.json (16 Nov 2026): writes the variant's rule into
landmark-regions.rules.json and its three lines into the landmark hotspot seed.
The pictures are the same in every variant; only the tap area changes.

    python src/scripts/pickGreaterTubercleVariant.py A
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
pick = sys.argv[1] if len(sys.argv) > 1 else ""
variants = json.loads((ROOT / "greater-tubercle-variants.json").read_text(encoding="utf8"))
if pick not in variants or pick.startswith("_"):
    sys.exit(f"usage: pickGreaterTubercleVariant.py {'|'.join(k for k in variants if not k.startswith('_'))}")
v = variants[pick]

rules_path = ROOT / "landmark-regions.rules.json"
text = rules_path.read_text(encoding="utf8")
start = text.index(' "greater-tubercle-humerus": {')
end = text.index('\n },\n', start) + len('\n },\n')
block = json.dumps({"greater-tubercle-humerus": v["rule"]}, indent=1, ensure_ascii=False)[2:-2] + ",\n"
rules_path.write_text(text[:start] + block + text[end:], encoding="utf8", newline="\n")
json.loads(rules_path.read_text(encoding="utf8"))  # still valid

seed_path = ROOT / "src/features/anatomy-revision/data/seed/hotspots.landmarks.generated.ts"
lines = seed_path.read_text(encoding="utf8").split("\n")
for i, line in enumerate(lines):
    m = re.match(r"\s*'([^']+)':", line)
    if m and m.group(1) in v["seed"]:
        lines[i] = v["seed"][m.group(1)]
seed_path.write_text("\n".join(lines), encoding="utf8", newline="\n")
print(f"greater tubercle hitbox: variant {pick}")
