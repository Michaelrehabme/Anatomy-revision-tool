"""
reconcile.py — check ta2-mapping.json against the real object list.

    python3 reconcile.py --objects objects.json --mapping ta2-mapping.json

Writes ta2-mapping.resolved.json with a concrete `blenderObjects` list per
muscle, and prints anything it could not resolve. Run this before rendering:
it is much cheaper to fix names here than to discover a blank render later.
"""
import json, argparse, difflib, re, unicodedata, collections

def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    for w in (" muscles", " muscle", "musculus ", "musculi "):
        s = s.replace(w, " ")
    return re.sub(r"\s+", " ", s).strip()

ap = argparse.ArgumentParser()
ap.add_argument("--objects", default="objects.json")
ap.add_argument("--mapping", default="ta2-mapping.json")
ap.add_argument("--out", default="ta2-mapping.resolved.json")
ap.add_argument("--threshold", type=float, default=0.90)
ap.add_argument("--collection", default="4: Muscular system",
                 help="only match objects belonging to this collection - Z-Anatomy also "
                      "ships tiny label-pin/insertion-marker objects (name suffixes like "
                      ".j/.el/.er/.ol/.or, a handful of verts) under the same base names, "
                      "which byBaseName can't tell apart from the real mesh")
ap.add_argument("--min-verts", type=int, default=50,
                 help="also drop low-vertex objects even inside --collection - Z-Anatomy's "
                      "single-object '<name>.j' whole-muscle pick-proxies (2 verts) live "
                      "in the muscular system collection right alongside the real mesh")
a = ap.parse_args()

objs = json.load(open(a.objects))
mp = json.load(open(a.mapping))
real_by_base = collections.defaultdict(list)
for o in objs["objects"]:
    if a.collection in o.get("collections", []) and o.get("verts", 0) >= a.min_verts:
        real_by_base[o["base"]].append(o["name"])
bases = {norm(b): sorted(names) for b, names in real_by_base.items()}

resolved, unresolved = [], []
for e in mp["mapping"]:
    targets = [norm(e["ta2_english"]), norm(e["ta2_latin"])]
    hit, how, conf = None, None, 0.0
    for t in targets:
        if t in bases:
            hit, how, conf = bases[t], "exact", 1.0
            break
    if not hit:
        best, bestscore = None, 0.0
        for cand in bases:
            s = max(difflib.SequenceMatcher(None, t, cand).ratio() for t in targets)
            if s > bestscore:
                best, bestscore = cand, s
        if bestscore >= a.threshold:
            hit, how, conf = bases[best], "fuzzy", round(bestscore, 3)

    e = dict(e)
    e["blenderObjects"] = hit or []
    e["resolution"] = how
    e["resolutionConfidence"] = conf
    (resolved if hit else unresolved).append(e)

# pull in extraParts (e.g. the two gemelli) by their own TA2 ids
by_ta2 = {x["ta2id"]: x for x in mp["mapping"]}
for e in resolved:
    for extra in e.get("extraParts", []):
        other = by_ta2.get(extra)
        if other:
            for t in (norm(other["ta2_english"]), norm(other["ta2_latin"])):
                if t in bases:
                    e["blenderObjects"] = sorted(set(e["blenderObjects"]) | set(bases[t]))
                    break

out = resolved + unresolved
json.dump({"schemaVersion": 1,
           "counts": {"total": len(out), "resolved": len(resolved), "unresolved": len(unresolved)},
           "mapping": sorted(out, key=lambda e: (e["region"], e["name"]))},
          open(a.out, "w"), indent=2, ensure_ascii=False)

print(f"resolved {len(resolved)}/{len(out)} -> {a.out}")
if unresolved:
    print("\nUNRESOLVED — fix these by hand in the mapping file:")
    for e in unresolved:
        print(f"  {e['id']:38s} looked for: {e['ta2_english']}")
