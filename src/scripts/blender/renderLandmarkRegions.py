"""Renders each landmark's grown region in red, to be checked against a textbook.

    blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderLandmarkRegions.py -- \
      --out renders/landmark-regions

This is a PROOFING renderer, not a pipeline stage. It frames the whole parent
bone and paints the selected faces red, deliberately imitating the way an atlas
plate marks a feature, so the rules in landmarkRegions.py can be judged against
a reference picture rather than against a description of one. The masks that
become hotspots are rendered by the landmark renderer, through the same camera
as the panel they belong to — a region traced from a differently framed render
would not land on the picture.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh
import numpy as np
from mathutils import kdtree

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from landmarkRegions import select_faces  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--spec", default="landmark-markers.spec.json")
ap.add_argument("--rules", default="landmark-regions.rules.json")
ap.add_argument("--out", required=True)
ap.add_argument("--only", default="")
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--res", type=int, default=900)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--margin", type=float, default=1.15)
ap.add_argument("--context", type=int, default=1,
                help="draw the surrounding skeleton behind the subject bone")
ap.add_argument("--masks", type=int, default=1,
                help="also render a flat black/white mask per view, for tracing")
ap.add_argument("--subdivide", type=int, default=2,
                help="times to cut every triangle before selecting; the grain the region "
                     "boundary can follow")
ap.add_argument("--region-frame", type=float, default=0.0,
                help="frame on the REGION's own extent times this, instead of the whole bone; "
                     "a small feature is unjudgeable at whole-bone framing")
a = ap.parse_args(argv)

spec = json.load(open(a.spec))
by_id = {l["id"]: l for l in spec["landmarks"]}
RULES = json.load(open(a.rules))
wanted = set(filter(None, a.only.split(","))) or set(RULES.keys())
views = [int(v) for v in a.views.split(",")]

scene = bpy.data.scenes.new("RegionScene")
bpy.context.window.scene = scene
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = a.samples
scene.render.resolution_x = scene.render.resolution_y = a.res
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"

scene.world = bpy.data.worlds.new("RegionWorld")
scene.world.use_nodes = True
_bg = scene.world.node_tree.nodes.get("Background")
if _bg:
    _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    _bg.inputs[1].default_value = 0.75

cam_data = bpy.data.cameras.new("regioncam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("regioncam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun = bpy.data.objects.new("regionsun", bpy.data.lights.new("regionsun", type="SUN"))
sun.data.energy = 3.0
scene.collection.objects.link(sun)


def bake(object_names, mesh_name):
    """One mesh in world space from many, so the neighbouring skeleton costs a
    single object in the scene rather than twelve hundred."""
    bm = bmesh.new()
    for n in object_names:
        src = bpy.data.objects.get(n)
        if not src or src.type != "MESH":
            continue
        tmp = src.data.copy()
        mat = src.matrix_world
        for v in tmp.vertices:
            v.co = mat @ v.co
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    mesh = bpy.data.meshes.new(mesh_name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def principled(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


BONE_MAT = principled("region_bone", (0.90, 0.88, 0.83, 1), 0.6)
MARK_MAT = principled("region_mark", (0.86, 0.10, 0.12, 1), 0.4)
# The bones AROUND the one being marked, a shade cooler so the subject still
# reads first. Without them a landmark is a red patch on an anonymous white
# shape, and the reviewer cannot tell a radial head from a fibular one.
CONTEXT_MAT = principled("region_context", (0.84, 0.84, 0.86, 1), 0.65)


def emission(name, colour):
    """Flat, unlit colour — a mask must not be shaded, or thresholding it turns
    the lighting into part of the shape."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = colour
    em.inputs[1].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


MASK_OFF = emission("region_mask_off", (0, 0, 0, 1))
MASK_ON = emission("region_mask_on", (1, 1, 1, 1))


def world_points(name):
    ob = bpy.data.objects.get(name)
    if not ob or ob.type != "MESH" or not ob.data.vertices:
        return []
    return [ob.matrix_world @ v.co for v in ob.data.vertices]


def centre_of(pts):
    return sum(pts, mathutils.Vector()) / len(pts)


def place_camera(target, angle_deg, frame_size):
    theta = math.radians(angle_deg)
    dist = frame_size * 6 + 0.5
    offset = mathutils.Vector((-dist * math.sin(theta), -dist * math.cos(theta), 0))
    cam.location = target + offset
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = frame_size
    sun.rotation_euler = mathutils.Euler((0.9, 0.3, 0.6 + theta), "XYZ")


def clear():
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun):
            scene.collection.objects.unlink(ob)


def render_to(path):
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# The whole skeleton, baked once and left in the scene for every landmark: the
# joints above and below are what make a region checkable against a textbook.
# The subject bone is drawn twice — plainly here, and again as the marked
# region lifted a fraction of a millimetre proud of it.
skel = bpy.data.collections.get("1: Skeletal system")
context_ob = None
if skel and a.context:
    names = [o.name for o in skel.all_objects if o.type == "MESH" and not o.name.endswith(".g")]
    print(f"[context] baking {len(names)} meshes for surroundings...", flush=True)
    context_mesh = bake(names, "region_context_mesh")
    context_mesh.materials.append(CONTEXT_MAT)
    context_ob = bpy.data.objects.new("region_context_ob", context_mesh)

report = {}

for lid in sorted(wanted):
    lm = by_id.get(lid)
    rule = RULES.get(lid)
    if not lm or not rule:
        print(f"[skip] {lid}: no spec entry or no rule", flush=True)
        continue

    pts = []
    for n in lm["anchors"]:
        pts = world_points(n)
        if pts:
            break
    if not pts:
        print(f"[skip] {lid}: no anchor vertices", flush=True)
        continue
    anchor = centre_of(pts)

    # The parent mesh nearest the anchor: the same side the landmark renderer
    # picks, so left and right do not disagree.
    best = None
    for n in lm["parentObjects"]:
        ob = bpy.data.objects.get(n)
        if not ob or ob.type != "MESH" or not ob.data.vertices:
            continue
        verts = [ob.matrix_world @ v.co for v in ob.data.vertices]
        d = (centre_of(verts) - anchor).length
        if best is None or d < best[0]:
            best = (d, n, ob)
    if best is None:
        print(f"[skip] {lid}: parent bone has no geometry", flush=True)
        continue
    _, bone_name, bone_ob = best

    # Bake to world space once; every rule and the camera work in world units.
    bm = bmesh.new()
    tmp = bone_ob.data.copy()
    for v in tmp.vertices:
        v.co = bone_ob.matrix_world @ v.co
    bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    # Mirrored (left-side) bones carry inverted normals; make them consistent
    # and outward before any facing test or normal-offset relies on them. The
    # pubis, the one landmark whose nearest parent is the LEFT hip bone, came
    # out invisible from the front until this: "anterior-facing" had selected
    # the inner surface and the lift along the normal pushed it inside the bone.
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # SUBDIVIDE BEFORE SELECTING. A region is chosen face by face, so on a
    # coarse bone (the hip bone ships with 1,894 vertices) the boundary can only
    # ever be a sawtooth of triangle edges — which reads as a jagged geometric
    # shape rather than a line following the crest. Cutting each triangle down
    # first lets the same distance threshold land on a smooth curve. It does not
    # change the bone's silhouette, only the grain the region is drawn at.
    for _ in range(a.subdivide):
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
    bm.faces.ensure_lookup_table()
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()

    bone_verts = [v.co.copy() for v in bm.verts]
    vert_normals = [v.normal.copy() for v in bm.verts]
    faces = list(bm.faces)
    centres = [f.calc_center_median() for f in faces]
    normals = [f.normal.copy() for f in faces]

    # Edge-linked neighbours, for the smoothing and island passes.
    index = {f: i for i, f in enumerate(faces)}
    adjacency = [[] for _ in faces]
    for i, f in enumerate(faces):
        for e in f.edges:
            for other in e.link_faces:
                if other is not f:
                    adjacency[i].append(index[other])

    # Every `.j` the rule mentions, however deeply nested in a point spec.
    def anchor_names(node, into):
        if isinstance(node, str):
            if node.endswith(".j"):
                into.add(node)
        elif isinstance(node, dict):
            for v in node.values():
                anchor_names(v, into)
        elif isinstance(node, list):
            for v in node:
                anchor_names(v, into)
        return into

    named = {}
    missing = []
    for n in anchor_names(rule, set()):
        p = world_points(n)
        if p:
            named[n] = centre_of(p)
        else:
            missing.append(n)
    if missing:
        print(f"[skip] {lid}: rule names anchors that do not exist — {', '.join(missing)}", flush=True)
        bm.free()
        continue
    named.setdefault(lm["anchors"][0], anchor)

    try:
        mask, _seeds = select_faces(bone_verts, vert_normals, centres, normals, rule, named, adjacency)
    except Exception as exc:  # a bad rule should name itself, not kill the run
        print(f"[skip] {lid}: rule failed — {exc}", flush=True)
        bm.free()
        continue

    picked = int(mask.sum())
    if picked == 0:
        print(f"[warn] {lid}: rule selected NO faces", flush=True)

    # Keep only the marked faces and lift them a fraction of a millimetre along
    # their normals, so they draw in front of the same bone in the context bake
    # instead of fighting it for the same pixels.
    bmesh.ops.delete(bm, geom=[f for i, f in enumerate(faces) if not mask[i]], context="FACES")
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        v.co = v.co + v.normal * 0.0004

    mesh = bpy.data.meshes.new(f"region_{lid}")
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(MARK_MAT)

    clear()
    ob = bpy.data.objects.new(f"region_ob_{lid}", mesh)
    scene.collection.objects.link(ob)
    if context_ob is not None:
        scene.collection.objects.link(context_ob)

    A = np.array([v[:] for v in bone_verts])
    lo, hi = A.min(axis=0), A.max(axis=0)
    target = mathutils.Vector((lo + hi) / 2)
    frame_size = float(max(hi - lo)) * a.margin

    if a.region_frame > 0 and picked:
        R = np.array([centres[i][:] for i in range(len(faces)) if mask[i]])
        rlo, rhi = R.min(axis=0), R.max(axis=0)
        target = mathutils.Vector((rlo + rhi) / 2)
        # Floored, so a hairline ridge does not zoom until the bone around it
        # is unrecognisable and the picture says nothing about where it sits.
        frame_size = max(float(max(rhi - rlo)) * a.region_frame, 0.05)

    for frame in views:
        place_camera(target, frame * 15, frame_size)
        bpy.context.view_layer.update()
        render_to(os.path.join(a.out, lid, f"view-{frame:02d}.png"))

        # The same camera, the region flat white and everything else flat
        # black: the mask that gets traced into the hotspot polygon. Rendering
        # it here rather than deriving it from the lit picture is what keeps
        # the traced outline in register with what the student sees.
        if a.masks:
            # Assign INTO the existing slots. Clearing the material list resets
            # every polygon's material_index to 0, which silently unpaints the
            # region — from the next render on, the lit picture comes back as a
            # plain bone with nothing marked.
            mesh.materials[0] = MASK_ON
            if context_ob is not None:
                context_ob.data.materials[0] = MASK_OFF
            if _bg:
                _bg.inputs[1].default_value = 0.0
            render_to(os.path.join(a.out, lid, f"mask-{frame:02d}.png"))
            mesh.materials[0] = MARK_MAT
            if context_ob is not None:
                context_ob.data.materials[0] = CONTEXT_MAT
            if _bg:
                _bg.inputs[1].default_value = 0.75

    share = picked / max(1, len(faces))
    report[lid] = {"bone": bone_name, "faces": len(faces), "picked": picked,
                   "share": round(share, 4), "kind": rule["kind"]}
    if picked:
        R = np.array([centres[i][:] for i in range(len(faces)) if mask[i]])
        N = np.array([normals[i][:] for i in range(len(faces)) if mask[i]])
        report[lid]["regionCentroid"] = [round(float(x), 4) for x in R.mean(axis=0)]
        report[lid]["regionSize"] = [round(float(x), 4) for x in (R.max(axis=0) - R.min(axis=0))]
        # Which way the patch faces on average: a region that should be on the
        # front of a bone and reports a posterior mean normal is on the wrong side.
        report[lid]["meanNormal"] = [round(float(x), 3) for x in N.mean(axis=0)]
    print(f"[region] {lid}: {picked}/{len(faces)} faces ({share:.1%}) on {bone_name}", flush=True)

with open(os.path.join(os.path.abspath(a.out), "report.json"), "w") as f:
    json.dump(report, f, indent=1)
print(f"[complete] {len(report)} region(s) -> {a.out}", flush=True)
