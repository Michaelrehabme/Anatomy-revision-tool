"""reconcile_landmarks.py - same idea as reconcile.py, but matches landmarks.json's
plain-English "name" field straight against real skeletal-system objects (no TA2
CSV involved - landmarks.json was authored directly against Z-Anatomy's own
naming from the debug dumps, so this is closer to reconcile.py's exact-match path
than its TA2 fuzzy path).

    python3 reconcile_landmarks.py --objects objects.json --landmarks landmarks.json

Writes ta2-mapping-landmarks.resolved.json shaped like ta2-mapping.resolved.json
(id, name, region, blenderObjects, resolution, resolutionConfidence) so
render_structures.py can treat muscles and landmarks identically.
"""
import json, argparse, difflib, re, unicodedata, collections


def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


ap = argparse.ArgumentParser()
ap.add_argument("--objects", default="objects.json")
ap.add_argument("--landmarks", default="landmarks.json")
ap.add_argument("--out", default="ta2-mapping-landmarks.resolved.json")
ap.add_argument("--threshold", type=float, default=0.90)
ap.add_argument("--collection", default="1: Skeletal system")
ap.add_argument("--min-verts", type=int, default=20)
a = ap.parse_args()

objs = json.load(open(a.objects, encoding="utf-8"))
lm = json.load(open(a.landmarks, encoding="utf-8"))

real_by_base = collections.defaultdict(list)
for o in objs["objects"]:
    if a.collection in o.get("collections", []) and o.get("verts", 0) >= a.min_verts:
        real_by_base[o["base"]].append(o["name"])
bases = {norm(b): sorted(names) for b, names in real_by_base.items()}

resolved, unresolved = [], []
for e in lm["landmarks"]:
    target = norm(e["name"])
    hit, how, conf = None, None, 0.0
    if target in bases:
        hit, how, conf = bases[target], "exact", 1.0
    else:
        best, bestscore = None, 0.0
        for cand in bases:
            s = difflib.SequenceMatcher(None, target, cand).ratio()
            if s > bestscore:
                best, bestscore = cand, s
        if bestscore >= a.threshold:
            hit, how, conf = bases[best], "fuzzy", round(bestscore, 3)

    out_e = {"id": e["id"], "name": e["name"], "region": e["region"],
              "blenderObjects": hit or [], "resolution": how, "resolutionConfidence": conf}
    (resolved if hit else unresolved).append(out_e)

out = resolved + unresolved
json.dump({"schemaVersion": 1,
           "counts": {"total": len(out), "resolved": len(resolved), "unresolved": len(unresolved)},
           "mapping": sorted(out, key=lambda e: (e["region"], e["name"]))},
          open(a.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

print(f"resolved {len(resolved)}/{len(out)} -> {a.out}")
if unresolved:
    print("\nUNRESOLVED - these need a hand-picked blenderObjects list (multi-part landmark, "
          "or the atlas names it differently than landmarks.json's 'name' field):")
    for e in unresolved:
        print(f"  {e['id']:32s} looked for: {e['name']}")
