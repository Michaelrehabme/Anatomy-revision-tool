"""
dump_objects.py — run inside Blender against the Z-Anatomy template.

    blender Z-Anatomy.blend --background --python dump_objects.py -- --out objects.json

Z-Anatomy names its objects from TA2, but with suffixes (.L/.R, .001) and
occasional wording drift. This dumps the ground truth so reconcile.py can
check ta2-mapping.json against what is actually in the file, rather than
trusting my name matching blind.
"""
import bpy, json, sys, re, collections

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_path = argv[argv.index("--out") + 1] if "--out" in argv else "objects.json"

SIDE_SUFFIX = re.compile(r"\.(L|R)$", re.I)
DUP_SUFFIX = re.compile(r"\.\d{3}$")

def base_name(n):
    n = DUP_SUFFIX.sub("", n)
    return SIDE_SUFFIX.sub("", n).strip()

objects = []
for ob in bpy.data.objects:
    if ob.type != "MESH":
        continue
    m = SIDE_SUFFIX.search(DUP_SUFFIX.sub("", ob.name))
    objects.append({
        "name": ob.name,
        "base": base_name(ob.name),
        "side": m.group(1).upper() if m else None,
        "collections": [c.name for c in ob.users_collection],
        "verts": len(ob.data.vertices),
    })

by_base = collections.defaultdict(list)
for o in objects:
    by_base[o["base"]].append(o["name"])

json.dump({"meshCount": len(objects),
           "uniqueBaseNames": len(by_base),
           "objects": sorted(objects, key=lambda o: o["name"]),
           "byBaseName": {k: sorted(v) for k, v in sorted(by_base.items())}},
          open(out_path, "w"), indent=2, ensure_ascii=False)

print(f"[dump_objects] {len(objects)} meshes, {len(by_base)} unique base names -> {out_path}")
