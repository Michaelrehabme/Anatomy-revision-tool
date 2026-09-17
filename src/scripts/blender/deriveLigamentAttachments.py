"""Works out which bones each ligament attaches to, by looking at what it touches.

A ligament question needs three things: a picture to point at, a picture to name,
and the two bones it runs between. The first two are the plate pipeline again.
The third is content nobody has written — 245 ligaments' attachments — and
writing it by hand is where a ligament feature would stall.

It does not have to be written. A ligament is a strap between two bones, and the
model knows where it is: the bones it attaches to are the bones it TOUCHES. That
is the same nearest-point search the joint lines already use, pointed at a
different question.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/deriveLigamentAttachments.py -- \
      --out ligament-attachments.json [--only "Anterior cruciate ligament"]

WHAT THIS IS AND IS NOT. It reports what a ligament touches, ranked by how much
of it is in contact. That is evidence for an attachment, not a substitute for
knowing: a ligament passing over a bone touches it too. The output is a draft
for a human to confirm, and it says how confident it is so the doubtful ones can
be read first.
"""
import bpy, json, sys, os, math, argparse, bmesh
from mathutils import kdtree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--only", default="", help="comma-separated name fragments, case-insensitive")
ap.add_argument("--limit", type=int, default=0, help="stop after N ligaments, for a quick look")
ap.add_argument("--touch", type=float, default=0.004,
                help="how close counts as touching, in metres — the model is life-size")
a = ap.parse_args(argv)

LIGAMENT = ("ligament", "retinaculum", "membrane", "aponeurosis", "labrum", "meniscus")


def world_verts(ob):
    mat = ob.matrix_world
    return [mat @ v.co for v in ob.data.vertices]


def is_anchor(name):
    return name.endswith((".i", ".j", ".g"))


skel = bpy.data.collections.get("1: Skeletal system")
bones = {}
for ob in skel.all_objects:
    if ob.type != "MESH" or is_anchor(ob.name) or not ob.data.vertices:
        continue
    bones[ob.name] = world_verts(ob)
print(f"[bones] {len(bones)} bone meshes", flush=True)

# One tree per bone. Asking "what is near this ligament" against a single merged
# cloud would not tell us WHICH bone, which is the entire question.
trees = {}
boxes = {}
for name, verts in bones.items():
    t = kdtree.KDTree(len(verts))
    for i, v in enumerate(verts):
        t.insert(v, i)
    t.balance()
    trees[name] = t
    boxes[name] = (
        min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts),
        max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts),
    )


def near_bones(verts, slack):
    """The bones whose box overlaps this ligament's, so the search stays cheap.

    Every vertex against every bone is 2,000 x 1,200 tree queries per ligament,
    and there are 437 ligaments — a billion queries, which is a run nobody
    waits for. A ligament is centimetres long and most bones are nowhere near
    it, so a box test first leaves a handful of real candidates and costs
    nothing. It cannot lose an attachment: a bone touching the ligament must
    overlap its box.
    """
    lo = (min(v.x for v in verts) - slack, min(v.y for v in verts) - slack, min(v.z for v in verts) - slack)
    hi = (max(v.x for v in verts) + slack, max(v.y for v in verts) + slack, max(v.z for v in verts) + slack)
    return [n for n, b in boxes.items()
            if b[0] <= hi[0] and b[3] >= lo[0]
            and b[1] <= hi[1] and b[4] >= lo[1]
            and b[2] <= hi[2] and b[5] >= lo[2]]

wanted = {w.strip().lower() for w in a.only.split(",") if w.strip()}
ligaments = [
    ob for ob in bpy.data.objects
    if ob.type == "MESH" and not is_anchor(ob.name) and ob.data.vertices
    and any(w in ob.name.lower() for w in LIGAMENT)
    and (not wanted or any(w in ob.name.lower() for w in wanted))
]
print(f"[ligaments] {len(ligaments)} meshes", flush=True)

results = []
for n, ob in enumerate(ligaments):
    if a.limit and n >= a.limit:
        break
    verts = world_verts(ob)
    if not verts:
        continue

    candidates = near_bones(verts, a.touch)

    # Which bone is nearest to each vertex of the ligament, and how near.
    touching = {}
    for v in verts:
        best_name, best_dist = None, 1e9
        for name in candidates:
            _, _, d = trees[name].find(v)
            if d < best_dist:
                best_name, best_dist = name, d
        if best_dist <= a.touch:
            touching[best_name] = touching.get(best_name, 0) + 1

    total = len(verts)
    ranked = sorted(touching.items(), key=lambda kv: -kv[1])
    results.append({
        "ligament": ob.name,
        "vertices": total,
        "attachments": [
            {"bone": name, "share": round(count / total, 3)} for name, count in ranked[:6]
        ],
    })
    print(f"[lig] {ob.name}: " + ", ".join(f"{b['bone']} {b['share']:.0%}" for b in results[-1]["attachments"]), flush=True)

with open(os.path.abspath(a.out), "w") as f:
    json.dump({"schemaVersion": 1, "touchMetres": a.touch, "ligaments": results}, f, indent=1)
print(f"[complete] {len(results)} ligament(s) -> {a.out}", flush=True)
