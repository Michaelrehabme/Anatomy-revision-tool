"""Renders landmark images: the skeleton framed on a landmark, and where it lands.

WHY LANDMARKS NEED THEIR OWN RENDERER. A landmark is not separable geometry.
The greater tubercle is a region of the humerus, not an object, so Z-Anatomy
models it as a label anchor — a `.j` mesh of a vertex or two sitting on the bone
surface. Anchors cannot be highlighted (there is nothing to fill), which is why
104 landmarks were left with only an AI-generated slide.

But a `.j` anchor carries a real position (see ANCHOR_SUFFIXES in
generateSkeletalMapping.ts), and a position is exactly what a landmark is. So
this renders the skeleton plainly, framed on the landmark, and records where the
anchor lands on screen. landmarkMarkers.ts then draws a ring there for identify
questions and emits a small circle for locate — the same way a textbook marks a
point on a bone, and the same shape the joint references use.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderLandmarkMarkers.py -- \
      --spec landmark-markers.spec.json --out renders/landmarks --views 0,6,12

A POINT ON THE FAR SIDE OF A BONE IS NOT VISIBLE. The ASIS seen from behind is
inside the pelvis. Each view casts a ray from the camera to the anchor, and if
anything is hit meaningfully before it, the view is recorded as hidden — a
marker drawn over the wrong face of a bone would teach the wrong surface.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh
from mathutils import kdtree
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--spec", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--only", default="", help="comma-separated landmark ids")
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--frame", type=float, default=0.9,
                help="frame width as a fraction of the parent bone's largest dimension")
ap.add_argument("--pull", type=float, default=0.5,
                help="where the camera aims, from the bone's centre (0) to the landmark (1)")
ap.add_argument("--zoom", type=float, default=25.0,
                help="frame width as a multiple of the landmark's radius")
ap.add_argument("--max-snap", type=float, default=0.5,
                help="reject an anchor further than this fraction of the bone from it")
a = ap.parse_args(argv)

spec = json.load(open(a.spec))
wanted = set(filter(None, a.only.split(","))) or {s["id"] for s in spec["landmarks"]}
views = [int(v) for v in a.views.split(",")]

scene = bpy.data.scenes.new("LandmarkScene")
bpy.context.window.scene = scene
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = a.samples
scene.render.resolution_x = scene.render.resolution_y = a.res
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

scene.world = bpy.data.worlds.new("LandmarkWorld")
scene.world.use_nodes = True
_bg = scene.world.node_tree.nodes.get("Background")
if _bg:
    _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    _bg.inputs[1].default_value = 0.55

cam_data = bpy.data.cameras.new("landmarkcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("landmarkcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun = bpy.data.objects.new("landmarksun", bpy.data.lights.new("landmarksun", type="SUN"))
sun.data.energy = 3.0
scene.collection.objects.link(sun)


def principled(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


BONE_MAT = principled("landmark_bone", (0.90, 0.88, 0.83, 1), 0.6)


def bake(object_names, mesh_name):
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


def world_points(name):
    """An anchor's position is its vertices in world space, not its origin.

    The `.j` anchors carry one or two vertices at the landmark; their object
    origin is not guaranteed to sit anywhere meaningful.
    """
    ob = bpy.data.objects.get(name)
    if not ob or ob.type != "MESH" or not ob.data.vertices:
        return []
    return [ob.matrix_world @ v.co for v in ob.data.vertices]


def bbox_of(points):
    xs = [p.x for p in points]; ys = [p.y for p in points]; zs = [p.z for p in points]
    return mathutils.Vector((min(xs), min(ys), min(zs))), mathutils.Vector((max(xs), max(ys), max(zs)))


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


# Same exclusion as the other renderers: the collection's own title is a mesh
# inside it, and baking the skeleton wholesale would bake "SYSTEM" in too.
skel = bpy.data.collections.get("1: Skeletal system")
skeleton_names = [o.name for o in skel.all_objects if o.type == "MESH" and not o.name.endswith(".g")]
print(f"[bones] baking {len(skeleton_names)} meshes...", flush=True)
skeleton_mesh = bake(skeleton_names, "landmark_skeleton")

# One linked object serves every view: the context render and the visibility
# ray cast both need the skeleton in the scene.
clear()
skeleton_ob = bpy.data.objects.new("landmark_skeleton_ob", skeleton_mesh)
skeleton_ob.data.materials.append(BONE_MAT)
scene.collection.objects.link(skeleton_ob)
depsgraph = bpy.context.evaluated_depsgraph_get()

done = 0
for lm in spec["landmarks"]:
    lid = lm["id"]
    if lid not in wanted:
        continue

    # Anchors come unsided in Z-Anatomy ("Greater trochanter.j"), and a paired
    # bone has two copies. Take the first anchor's vertices and frame on the
    # parent-bone mesh nearest to them, so the camera and the marker agree on
    # which side is meant.
    pts = []
    for name in lm["anchors"]:
        pts = world_points(name)
        if pts:
            break
    if not pts:
        print(f"[skip] {lid}: no anchor vertices", flush=True)
        continue
    anchor = sum(pts, mathutils.Vector()) / len(pts)

    parent_pts = []
    for name in lm["parentObjects"]:
        ob = bpy.data.objects.get(name)
        if ob and ob.type == "MESH":
            verts = [ob.matrix_world @ v.co for v in ob.data.vertices]
            if verts:
                lo, hi = bbox_of(verts)
                centre = (lo + hi) / 2
                parent_pts.append(((centre - anchor).length, lo, hi, verts))
    if not parent_pts:
        print(f"[skip] {lid}: parent bone has no geometry", flush=True)
        continue
    _, plo, phi, pverts = min(parent_pts, key=lambda t: t[0])
    parent_size = max(phi.x - plo.x, phi.y - plo.y, phi.z - plo.z)
    # ZOOM SO THE LANDMARK IS WORTH AIMING AT. The target a student taps is the
    # landmark's own size, and at whole-bone framing a 7mm spine is smaller than
    # a fingertip on a phone. Frame so the landmark spans at least a usable
    # share of the image, rather than inflating the target beyond its anatomy.
    # Clamped so a tiny feature does not zoom until the bone is unrecognisable.
    radius = lm.get("radius")
    if radius:
        frame_size = min(max(radius * a.zoom, parent_size * 0.35), parent_size * lm.get("frame", a.frame))
    else:
        frame_size = parent_size * lm.get("frame", a.frame)
    frame_size = max(frame_size, 0.05)

    # SNAP TO THE BONE. A `.j` anchor is where Z-Anatomy starts a label's leader
    # line, placed near the landmark for legibility rather than on it: the
    # greater trochanter's anchor sits in empty space lateral to the femur. The
    # landmark is the nearest point of the bone to that anchor.
    tree = kdtree.KDTree(len(pverts))
    for i, v in enumerate(pverts):
        tree.insert(v, i)
    tree.balance()
    raw_anchor = anchor
    anchor, _, snap_dist = tree.find(raw_anchor)
    anchor = mathutils.Vector(anchor)

    # A SNAP THAT TRAVELS TOO FAR IS THE WRONG BONE. Z-Anatomy names its anchors
    # without a level — there is one "Spinous process.j", not one per vertebra —
    # so an anchor found by name can belong to a different vertebra than the one
    # being framed, and snapping would put the marker on the nearest corner of
    # the wrong bone. Better to report it than to draw it.
    if snap_dist > parent_size * a.max_snap:
        print(f"[skip] {lid}: anchor is {snap_dist / parent_size:.0%} of the bone away "
              f"from {lm['parent']} — probably a different bone", flush=True)
        continue

    # AIM BETWEEN THE BONE AND THE LANDMARK. Aimed at the landmark itself, every
    # landmark lands dead centre, which answers a locate question before it is
    # asked. Aimed halfway, it falls where it naturally sits on the bone, off
    # centre, with most of the bone in view to say which bone it is.
    bone_centre = (plo + phi) / 2
    target = bone_centre.lerp(anchor, lm.get("pull", a.pull))

    # frameSize is recorded because the hotspot radius is worked out from the
    # landmark's real size in metres, and only the renderer knows how many
    # metres the frame covers.
    meta = {"id": lid, "anchor": list(anchor), "snapDistance": snap_dist,
            "snapFraction": snap_dist / parent_size, "parentSize": parent_size,
            "frameSize": frame_size, "radius": lm.get("radius"), "views": {}}
    for frame in views:
        place_camera(target, frame * 15, frame_size)
        bpy.context.view_layer.update()

        # Where the anchor lands in the image, 0-1 with the origin top-left to
        # match the hotspot convention.
        co = world_to_camera_view(scene, cam, anchor)
        u, v = co.x, 1.0 - co.y

        # Visible if the first thing the camera meets along this line is the
        # landmark itself. Measuring "is anything in front of the snapped point"
        # got the acromion wrong: the nearest bone vertex to its anchor lies on
        # the acromion's far face, so the ray met the near face of the same
        # process and called the landmark hidden behind itself. A landmark is a
        # region of bone, not a point; if the first hit lands within that region
        # the student is looking at it. A hit far away is a different bone or
        # the far side of this one — the ASIS seen from behind.
        direction = (anchor - cam.location).normalized()
        hit, loc, *_ = scene.ray_cast(depsgraph, cam.location, direction)
        region = parent_size * lm.get("region", 0.08)
        visible = (not hit) or ((loc - anchor).length <= region)
        inside = 0.02 <= u <= 0.98 and 0.02 <= v <= 0.98

        render_to(os.path.join(a.out, lid, f"view-{frame:02d}.png"))
        meta["views"][f"view-{frame:02d}"] = {"u": u, "v": v, "visible": bool(visible and inside)}

    with open(os.path.join(os.path.abspath(a.out), lid, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    shown = sum(1 for x in meta["views"].values() if x["visible"])
    print(f"[landmark] {lid}: {shown}/{len(views)} views show it, "
          f"snapped {snap_dist / parent_size:.1%} of the bone's size", flush=True)
    done += 1

print(f"[complete] {done} landmark(s) -> {a.out}", flush=True)
