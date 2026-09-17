"""Surveys the bones behind the landmarks that need a traced region.

    blender --background atlas/Z-Anatomy/Startup.blend \
      --python src/scripts/blender/probeLandmarkRegions.py -- --out landmark-region-probe.json

WHY THIS EXISTS. A landmark has no geometry of its own: 1,221 of the atlas's
1,228 `.j` objects carry two vertices or fewer (generateSkeletalMapping.ts), so
"the linea aspera" is a name for a region of the femur, not a mesh. To trace one
the region has to be GROWN on the parent bone, and every rule for growing it is
expressed in the bone's own frame — along the shaft, most posterior, above this
height. This prints that frame, so the rules can be written against measured
numbers instead of assumed ones.

Writes JSON. Changes nothing.
"""

import bpy, json, sys, argparse, mathutils
import numpy as np
from mathutils import kdtree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--spec", default="landmark-markers.spec.json")
ap.add_argument("--out", default="landmark-region-probe.json")
a = ap.parse_args(argv)

# The landmarks that need a region, plus the anchors that could bound one.
# An "endpoint" rule needs both of its anchors to exist, which is the main
# thing this probe is checking.
SUBJECTS = [
    "femoral-neck", "iliac-crest", "intertrochanteric-line", "intertubercular-sulcus",
    "linea-aspera", "median-sacral-crest", "tibial-crest", "vertebral-body",
    "tibial-plateau", "spine-of-scapula", "greater-trochanter",
]
EXTRA_ANCHORS = [
    "Anterior superior iliac spine.j", "Posterior superior iliac spine.j",
    "Greater trochanter.j", "Lesser trochanter.j",
    "Greater tubercle.j", "Lesser tubercle.j",
    "Medial condyle.j", "Lateral condyle.j", "Intercondylar eminence.j",
    "Acromion.j", "Medial border of scapula.j",
]


def world_points(name):
    ob = bpy.data.objects.get(name)
    if not ob or ob.type != "MESH" or not ob.data.vertices:
        return []
    return [ob.matrix_world @ v.co for v in ob.data.vertices]


def centre(pts):
    return sum(pts, mathutils.Vector()) / len(pts)


spec = json.load(open(a.spec))
by_id = {l["id"]: l for l in spec["landmarks"]}

# Which .j anchors actually carry a position, and how many vertices each has.
anchors = {}
for ob in bpy.data.objects:
    if ob.type == "MESH" and ob.name.strip().endswith(".j"):
        pts = world_points(ob.name)
        if pts:
            lo = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
            hi = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
            anchors[ob.name] = {"verts": len(pts), "centre": list(centre(pts)), "extent": (hi - lo).length}

out = {"anchorsFound": {}, "bones": {}, "landmarks": {}}
for name in EXTRA_ANCHORS:
    out["anchorsFound"][name] = anchors.get(name, None)

bones_done = {}

for lid in SUBJECTS:
    lm = by_id.get(lid)
    if not lm:
        out["landmarks"][lid] = {"error": "not in spec"}
        continue

    pts = []
    anchor_name = None
    for n in lm["anchors"]:
        pts = world_points(n)
        if pts:
            anchor_name = n
            break
    if not pts:
        out["landmarks"][lid] = {"error": "no anchor vertices", "anchors": lm["anchors"]}
        continue
    anchor = centre(pts)

    # The parent mesh nearest the anchor — the same side-picking rule the
    # renderer uses, so the numbers here describe the bone that gets rendered.
    best = None
    for n in lm["parentObjects"]:
        verts = world_points(n)
        if not verts:
            continue
        c = centre(verts)
        d = (c - anchor).length
        if best is None or d < best[0]:
            best = (d, n, verts)
    if best is None:
        out["landmarks"][lid] = {"error": "parent has no geometry", "parentObjects": lm["parentObjects"]}
        continue

    _, bone_name, verts = best
    A = np.array([v[:] for v in verts])
    lo, hi = A.min(axis=0), A.max(axis=0)
    mean = A.mean(axis=0)
    _, _, vt = np.linalg.svd(A - mean, full_matrices=False)
    long_axis = vt[0]

    # Snap the anchor to the bone, as the renderer does: a `.j` sits off the
    # surface, near the landmark rather than on it.
    tree = kdtree.KDTree(len(verts))
    for i, v in enumerate(verts):
        tree.insert(v, i)
    tree.balance()
    snapped, _, snap_dist = tree.find(anchor)
    snapped = mathutils.Vector(snapped)

    # Where the landmark sits along the bone's own long axis, 0 at one end and
    # 1 at the other — the range a "middle third of the shaft" rule needs.
    proj = (A - mean) @ long_axis
    s = float((np.array(snapped[:]) - mean) @ long_axis)
    frac = (s - proj.min()) / (proj.max() - proj.min()) if proj.max() > proj.min() else 0.0

    if bone_name not in bones_done:
        bones_done[bone_name] = True
        out["bones"][bone_name] = {
            "verts": len(verts),
            "bboxLo": [round(float(x), 4) for x in lo],
            "bboxHi": [round(float(x), 4) for x in hi],
            "size": [round(float(x), 4) for x in (hi - lo)],
            "centroid": [round(float(x), 4) for x in mean],
            "longAxis": [round(float(x), 4) for x in long_axis],
            "lengthAlongLongAxis": round(float(proj.max() - proj.min()), 4),
        }

    # How far the snapped point sits from the bone's axis in each anatomical
    # direction, which is what tells "most posterior" from "most anterior".
    rel = np.array(snapped[:]) - mean
    out["landmarks"][lid] = {
        "anchorObject": anchor_name,
        "anchorVerts": len(pts),
        "anchorExtentMm": round(anchors.get(anchor_name, {}).get("extent", 0.0) * 1000, 1),
        "bone": bone_name,
        "anchorRaw": [round(float(x), 4) for x in anchor],
        "snapped": [round(float(x), 4) for x in snapped],
        "snapDistMm": round(snap_dist * 1000, 1),
        "fractionAlongLongAxis": round(float(frac), 3),
        "offsetFromCentroid": [round(float(x), 4) for x in rel],
        "specRadiusMm": round(lm.get("radius", 0) * 1000, 1),
    }

with open(a.out, "w") as f:
    json.dump(out, f, indent=1)

print("[probe] anchors present:")
for n, v in out["anchorsFound"].items():
    print(f"   {'YES' if v else 'no '}  {n}" + (f"  ({v['verts']} verts)" if v else ""))
print(f"[probe] wrote {a.out}")
