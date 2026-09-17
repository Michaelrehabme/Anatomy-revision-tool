"""Renders single-muscle panel images: one muscle highlighted on the skeleton.

Replaces the 255px AI-generated panel crops, which are visibly soft on a modern
phone. The important property to preserve is CONTEXT: the old crops showed the
muscle picked out in blue against a skeleton, from several angles, so you could
tell *where* it sits. The 1400px Z-Anatomy isolated renders are sharper but show
the muscle floating alone against white, which is strictly worse for learning a
muscle's location — so this renders the muscle in place on the skeleton instead.

Camera frames the MUSCLE's bounding box with a generous margin so surrounding
bone stays in shot. That is deliberately unlike renderRegionsWithBones.py, whose
framing must stay pinned to the region bbox because hotspots depend on it. These
panels carry no hotspots (mode: 'single-structure'), so the camera is free.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderMusclePanels.py -- \
      --mapping ta2-mapping.resolved.json --out renders/panels \
      --muscles deltoid,trapezius --views 0,6,12
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mapping", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--muscles", required=True, help="comma-separated structure ids")
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--elevations", default="0",
                help="camera heights in degrees, comma-separated; negative looks up from below")
ap.add_argument("--frames", type=int, default=24)
# 1400 matches the region plates, and gives a phone at 2x device pixel ratio
# real headroom to zoom into rather than up-scaling immediately.
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--margin", type=float, default=2.4, help="camera framing slack around the muscle")
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--one-side", default="",
                help="comma-separated ids to frame on one side regardless of SIDE_FRAMING_RATIO")
ap.add_argument("--frame-on", default="",
                help="comma-separated Blender object names to frame every render on, instead of each "
                     "subject's own bbox — for a hand or a foot, where the SUBJECT is not the thing "
                     "that has to be recognisable")
ap.add_argument("--backdrop", default="",
                help="comma-separated Blender object names to draw the subject on, instead of the whole "
                     "skeleton. A frame wide enough to hold a forearm also holds the femur beside it, "
                     "and the composite trims to whatever is opaque, so the far bone survives into the "
                     "panel. Naming the backdrop is the only way to be sure what is in the picture.")
ap.add_argument("--highlight", default="0.76,0.27,0.25",
                help="RGB of the highlighted structure, 0-1. Muscle red by default; the bone panels "
                     "shipped are highlight blue (0.22,0.45,0.72) and stay that way until they are "
                     "all re-rendered together")
a = ap.parse_args(argv)

mapping = {m["id"]: m for m in json.load(open(a.mapping))["mapping"]}
wanted = a.muscles.split(",")
views = [int(v) for v in a.views.split(",")]
elevations = [float(e) for e in a.elevations.split(",")]
force_one_side = set(filter(None, a.one_side.split(",")))
frame_on = [n for n in a.frame_on.split(",") if n]
backdrop_only = [n for n in a.backdrop.split(",") if n]
# Which side --frame-on names, when it names one. A pure string question, so
# it is settled here rather than beside the bbox that also needs it — the
# skeleton is baked before that, and it needs the answer first.
_one_side = [n for n in frame_on if n.endswith(".l")] or [n for n in frame_on if n.endswith(".r")]
framed_side = _one_side[0][-2:] if _one_side and len(_one_side) < len(frame_on) else None
highlight_rgb = tuple(float(v) for v in a.highlight.split(",")) + (1.0,)

scene = bpy.data.scenes.new("PanelScene")
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

scene.world = bpy.data.worlds.new("PanelWorld")
scene.world.use_nodes = True
# Ambient fill. With only the sun, the lateral view falls into shadow and reads
# much darker than the anterior and posterior ones sitting beside it in the
# composited strip.
_bg = scene.world.node_tree.nodes.get("Background")
if _bg:
    _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    _bg.inputs[1].default_value = 0.55

cam_data = bpy.data.cameras.new("panelcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("panelcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun_data = bpy.data.lights.new("panelsun", type="SUN")
sun_data.energy = 3.0
sun = bpy.data.objects.new("panelsun", sun_data)
scene.collection.objects.link(sun)


def principled(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


# Muscle red, the same value renderRegionsWithBones.py gives its subject
# muscles, so a muscle looks like the same tissue whichever image it appears in.
#
# It replaces the blue the retired AI panels used. Blue reads as a highlight
# rather than as anatomy, and at low saturation it sat too close to both the
# cream bone and the near-white ground: the thinner structures — the plantar
# intrinsics, the deep spinal series — were hard to pick out at all. Red is
# what the tissue actually is, and it separates cleanly from bone.
highlight_mat = principled("panel_highlight", highlight_rgb, roughness=0.45)
bone_mat = principled("panel_bone", (0.90, 0.88, 0.83, 1.0), roughness=0.6)


def bake_world_mesh(object_names, mesh_name):
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


# How much tighter one side must be before the union is judged to be measuring
# the gap between a pair rather than the muscle. 3x clears the hand and foot
# intrinsics without touching the thigh and shoulder muscles, whose two halves
# sit about their own width apart.
SIDE_FRAMING_RATIO = 3.0


def mesh_bbox(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def bbox_size(bbox_min, bbox_max):
    return max(bbox_max[0] - bbox_min[0], bbox_max[1] - bbox_min[1], bbox_max[2] - bbox_min[2])


def frame_camera(bbox_min, bbox_max, angle_deg, margin, elevation_deg=0.0):
    """Place the camera at `angle_deg` around the body and `elevation_deg` above it.

    Elevation was fixed at zero until flexor-hallucis-brevis showed why that is
    not enough. It is a plantar muscle and the worst-lit panel in the set, 0.30%
    of its own subject visible across the three shipped views.

    Measuring it properly separates two faults. The three shipped angles (0, 90,
    180 degrees) are simply unlucky for this muscle: sampling twelve azimuths at
    the same height finds 4.52%, already above the 3.06% median. Dropping the
    camera to -45 degrees then reaches 9.74%. So the axis is worth having, but
    choosing better angles on the existing one is worth having first.

    The useful elevation belongs to the structure, not to the renderer:
    supraspinatus sits in the supraspinous fossa and reads best at +30, looking
    down. Negative elevation looks up from underneath, positive looks down.
    """
    center = mathutils.Vector(((bbox_min[0] + bbox_max[0]) / 2,
                               (bbox_min[1] + bbox_max[1]) / 2,
                               (bbox_min[2] + bbox_max[2]) / 2))
    size = bbox_size(bbox_min, bbox_max)
    dist = size * 4 + 0.5
    theta = math.radians(angle_deg)
    phi = math.radians(elevation_deg)
    offset = mathutils.Vector((-dist * math.sin(theta) * math.cos(phi),
                               -dist * math.cos(theta) * math.cos(phi),
                               dist * math.sin(phi)))
    loc = center + offset
    cam.location = loc
    cam.rotation_euler = (center - loc).to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = size * margin
    # Keep the key light off the camera axis at any elevation, or a view from
    # directly below renders flat and unreadable.
    sun.rotation_euler = mathutils.Euler((0.9 - phi * 0.5, 0.3, 0.6 + theta), 'XYZ')


def clear_objects():
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun):
            scene.collection.objects.unlink(ob)


def link(mesh, name, material):
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.clear()
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.material_index = 0
    scene.collection.objects.link(ob)


skel = bpy.data.collections.get("1: Skeletal system")
# Z-Anatomy titles each top-level collection with a text mesh — "Skeletal
# system.g", "Muscular system.g", "Joints.g" — and it lives INSIDE the
# collection it names, so baking every mesh in "1: Skeletal system" bakes its
# title too. It sits beside the body and only enters frame on a wide shot, which
# is why it went unnoticed: "SYSTEM" is printed at both edges of every panel
# framed on the whole body, mirrored on the right, and has been in production
# on brachioradialis, flexor-digitorum-profundus, interspinales, multifidus and
# rotatores. `.g` is only ever a label, never anatomy.
bone_names = [o.name for o in skel.all_objects if o.type == "MESH" and not o.name.endswith(".g")]
# THE FAR LIMB IS NOT CONTEXT. A plantar view of one foot is taken from far
# enough below the body that the other foot walks into the edge of frame, and
# the trim that crops the finished panel then keeps it: the subject ends up
# off-centre next to half a stranger. A panel framed on one side shows that
# side. The axial skeleton carries no suffix and is unaffected.
if framed_side:
    other = ".r" if framed_side == ".l" else ".l"
    bone_names = [n for n in bone_names if not n.endswith(other)]
# An explicit backdrop wins outright. Dropping the far side is enough for a
# hand, whose frame is barely wider than it is; a forearm needs a frame deep
# enough to reach the elbow, and at that size the near femur stands beside the
# hand and the trim keeps it. Saying which bones may appear settles it.
if backdrop_only:
    bone_names = backdrop_only
print(f"[bones] baking {len(bone_names)} meshes...", flush=True)
bone_mesh = bake_world_mesh(bone_names, "panel_bones")
print(f"[bones] {len(bone_mesh.vertices)} verts", flush=True)

# FRAME ON THE HAND, NOT ON THE MUSCLE INSIDE IT.
#
# Every panel frames its own subject, which is right for a deltoid and wrong
# for opponens digiti minimi: the shot comes out as three strips of bone with
# a red thread in them, and nothing in it says whether you are looking at the
# palm or the back of the hand. The answer to "which structure is shown" is
# unanswerable if you cannot tell which side of the hand you are on, and the
# fix is not a better angle, it is a wider one — the whole hand in shot, from
# a side that is named.
#
# Computed once: it is the same box for every subject in the run, which is the
# point of it.
shared_box = None
if frame_on:
    frame_mesh = bake_world_mesh(frame_on, "panel_frame_on")
    if len(frame_mesh.vertices) == 0:
        print(f"[error] --frame-on matched no geometry", flush=True)
        sys.exit(1)
    # One side, always. The two hands hang the width of the body apart, so their
    # union frames the torso between them — the very failure this exists to fix.
    one = _one_side
    if framed_side:
        side_mesh = bake_world_mesh(one, "panel_frame_on_side")
        if len(side_mesh.vertices) > 0:
            bpy.data.meshes.remove(frame_mesh)
            frame_mesh = side_mesh
        else:
            bpy.data.meshes.remove(side_mesh)
    shared_box = mesh_bbox(frame_mesh)
    bpy.data.meshes.remove(frame_mesh)
    print(f"[frame] framing every render on {len(frame_on)} objects", flush=True)

t0 = time.time()
count = 0
for mid in wanted:
    entry = mapping.get(mid)
    if not entry or not entry.get("blenderObjects"):
        print(f"[warn] no mapping for {mid}, skipping", flush=True)
        continue

    objects = entry["blenderObjects"]
    # Highlight only the side that is in shot. The two feet sit close enough
    # that a plantar view framed on one has the other at the edge of frame, and
    # a red sliver of a muscle that is not the subject is worse than no sliver.
    if framed_side:
        objects = [o for o in objects if o.endswith(framed_side)] or objects
    mesh = bake_world_mesh(objects, f"panel_{mid}")
    if len(mesh.vertices) == 0:
        print(f"[warn] {mid}: empty bake, skipping", flush=True)
        continue

    bmin, bmax = shared_box if shared_box else mesh_bbox(mesh)

    # FRAME ONE SIDE WHEN THE PAIR IS WHAT IS WIDE, NOT THE MUSCLE.
    #
    # Nearly every muscle here is a .l/.r pair, and framing their union means
    # framing the gap between them. For a thigh or a shoulder that gap is
    # roughly the muscle's own size and the shot is fine. For the hand
    # intrinsics it is the entire width of the body: opponens pollicis came
    # out as a full skeleton with two invisible specks in it, and eight
    # panels were unusable for exactly this reason.
    #
    # So: if one side alone is dramatically tighter than the union, the union
    # is measuring the pose rather than the anatomy — frame the side instead.
    # Both sides still render highlighted; only the camera changes. The
    # threshold is deliberately loose so muscles that genuinely read better
    # as a symmetric pair keep their existing framing.
    side = [o for o in objects if o.endswith(".l")] or [o for o in objects if o.endswith(".r")]
    if shared_box is None and side and len(side) < len(objects):
        side_mesh = bake_world_mesh(side, f"frame_{mid}")
        if len(side_mesh.vertices) > 0:
            smin, smax = mesh_bbox(side_mesh)
            # The ratio test misses the forearm: the two forearms hang about a
            # forearm's length apart, so the pair measures roughly twice one
            # side, under the 3x threshold — and framing the pair means framing
            # the whole body. flexor-pollicis-longus came out as a full skeleton
            # with a red line down each arm. Forcing it per muscle, rather than
            # lowering the ratio, leaves every thigh and shoulder panel as it is.
            if (mid in force_one_side
                    or bbox_size(bmin, bmax) > bbox_size(smin, smax) * SIDE_FRAMING_RATIO):
                bmin, bmax = smin, smax
                print(f"[frame] {mid}: framed on one side", flush=True)
        bpy.data.meshes.remove(side_mesh)

    for elev in elevations:
        for frame in views:
            frame_camera(bmin, bmax, frame * 360.0 / a.frames, a.margin, elev)
            clear_objects()
            link(bone_mesh, "panel_skeleton", bone_mat)
            link(mesh, f"panel_{mid}_hi", highlight_mat)
            # Elevation 0 keeps the flat <mid>/view-NN.png layout the compositor
            # and the existing 130 panels already use; anything else gets its own
            # subdirectory, so adding the axis cannot disturb what is shipped.
            leaf = f"view-{frame:02d}.png"
            parts = [a.out, mid] if elev == 0 else [a.out, mid, f"elev{elev:+03.0f}"]
            path = os.path.abspath(os.path.join(*parts, leaf))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            count += 1

    bpy.data.meshes.remove(mesh)
    print(f"[panel] {mid} ({count} renders, {time.time() - t0:.0f}s)", flush=True)

print(f"[complete] {count} renders in {time.time() - t0:.0f}s -> {a.out}", flush=True)
