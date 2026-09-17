"""Asks, for each ligament, whether any camera angle can actually see it.

Locate and identify both need the student to SEE the thing. A ligament is not
like a muscle: some are on the outside of a joint and plain to view, and some —
the cruciates most obviously — are inside the capsule with the femoral condyles
in front of them from every direction. Rendering those the way muscles are
rendered produces a picture of a bone with nothing to point at.

Which ligaments are which is not a judgement call, it is a measurement: fire a
ray from the camera at the ligament and see whether the ligament is the first
thing it hits.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/checkLigamentVisibility.py -- \
      --out ligament-visibility.json

Reported as the share of sampled points visible, per angle, so the answer is
"visible from the front and the side, hidden from behind" rather than a bare
yes or no — that is what a render spec needs anyway.
"""
import bpy, json, sys, os, math, argparse, mathutils

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--only", default="")
ap.add_argument("--views", type=int, default=12, help="angles around the vertical axis")
ap.add_argument("--samples", type=int, default=40, help="points tested per ligament")
a = ap.parse_args(argv)

LIGAMENT = ("ligament", "retinaculum", "membrane", "aponeurosis", "labrum", "meniscus")

deps = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene


def is_anchor(name):
    return name.endswith((".i", ".j", ".g"))


# Only the skeleton and the ligaments block the view. Muscles and viscera are
# not in the picture these renders would produce, so they must not be in the
# occlusion test either — a picture of a knee ligament is not going to have the
# gastrocnemius laid over it.
visible_world = set()
for coll_name in ("1: Skeletal system", "3: Joints"):
    coll = bpy.data.collections.get(coll_name)
    if coll:
        for ob in coll.all_objects:
            if ob.type == "MESH" and not is_anchor(ob.name):
                visible_world.add(ob.name)

for ob in bpy.data.objects:
    ob.hide_set(False)
    if ob.type == "MESH":
        ob.hide_viewport = ob.name not in visible_world

wanted = {w.strip().lower() for w in a.only.split(",") if w.strip()}
ligaments = [
    ob for ob in bpy.data.objects
    if ob.type == "MESH" and not is_anchor(ob.name) and ob.data.vertices
    and any(w in ob.name.lower() for w in LIGAMENT)
    and (not wanted or any(w in ob.name.lower() for w in wanted))
]
print(f"[ligaments] {len(ligaments)} meshes, {len(visible_world)} occluders", flush=True)

deps = bpy.context.evaluated_depsgraph_get()
results = []

for ob in ligaments:
    mat = ob.matrix_world
    verts = [mat @ v.co for v in ob.data.vertices]
    if not verts:
        continue
    step = max(1, len(verts) // a.samples)
    probes = verts[::step][:a.samples]
    centre = sum(probes, mathutils.Vector()) / len(probes)
    size = max((v - centre).length for v in verts) or 0.01

    per_view = {}
    for i in range(a.views):
        theta = math.radians(i * 360.0 / a.views)
        # Far enough out to be outside the body, so the ray crosses everything
        # that would really be in front of the ligament.
        eye = centre + mathutils.Vector((-math.sin(theta), -math.cos(theta), 0)) * max(size * 20, 1.2)
        seen = 0
        for p in probes:
            d = p - eye
            dist = d.length
            if dist == 0:
                continue
            hit, loc, _, _, obj, _ = scene.ray_cast(deps, eye, d.normalized(), distance=dist * 1.02)
            # The ligament itself counts as seen; anything else in front of it
            # means that point is hidden.
            if not hit or (obj and obj.name == ob.name):
                seen += 1
        per_view[i] = round(seen / len(probes), 3)

    best = max(per_view.values())
    results.append({
        "ligament": ob.name,
        "bestView": max(per_view, key=per_view.get),
        "bestShare": best,
        "views": per_view,
    })
    print(f"[vis] {ob.name}: best {best:.0%} at view {results[-1]['bestView']}", flush=True)

with open(os.path.abspath(a.out), "w") as f:
    json.dump({"schemaVersion": 1, "views": a.views, "ligaments": results}, f, indent=1)
print(f"[complete] {len(results)} -> {a.out}", flush=True)
