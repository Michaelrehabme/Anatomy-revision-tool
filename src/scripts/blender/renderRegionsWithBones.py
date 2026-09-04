"""Re-renders the regional muscle views with the skeleton included, and
re-derives every per-muscle mask with bone as an occluder.

Why this exists
---------------
The original render_regions.py (recovered from commit a8fb5c1) rendered muscles
alone against a transparent background. That leaves the renders with holes
where bones should be, and it means the occlusion model has no concept of bone
at all: from the front, gastrocnemius and soleus are fully visible through the
gap where the tibia and fibula belong, and the intercostals read as floating
slats with no ribs between them. A student could tap a visibly bony area and be
graded as having hit the muscle behind it.

Camera framing is copied VERBATIM from render_regions.py, including the region
bounding box being computed from the region's MUSCLES ONLY. That is what keeps
these renders pixel-aligned with the ones already shipped -- verified at
IoU 1.000000 against the existing shoulder-arm posterior plate. Do not "tidy"
frame_camera_azimuth or the bbox loop; changing either silently invalidates
every stored hotspot polygon.

Usage:
  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderRegionsWithBones.py -- \
      --mapping ta2-mapping.resolved.json --out renders/regions-bones \
      [--region shoulder-arm] [--views 0,6,12]

Outputs, matching the layout masksToHotspots.ts already reads:
  <out>/<region>/frame-NN.png             muscles over skeleton -- the plate
  <out>/<region>/masks/<id>/frame-NN.png  that muscle, bone-occluded
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mapping", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--region", default=None, help="omit to render every region")
ap.add_argument("--views", default="0,6,12", help="turntable frame indices")
ap.add_argument("--frames", type=int, default=24, help="full turntable length; sets the angle step")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--skip-plate", action="store_true")
ap.add_argument("--plates-only", action="store_true",
                help="re-render just the base plates. Masks are emission + holdout, so lighting "
                     "changes cannot affect them and the stored hotspots stay valid.")
ap.add_argument("--ambient", type=float, default=0.45, help="world fill strength")
ap.add_argument("--fill-energy", type=float, default=1.2, help="opposing fill sun energy")
a = ap.parse_args(argv)

mapping = json.load(open(a.mapping))["mapping"]
regions = [a.region] if a.region else sorted({m["region"] for m in mapping})
views = [int(v) for v in a.views.split(",")]

scene = bpy.data.scenes.new("RenderScene")
bpy.context.window.scene = scene
# EEVEE was renamed BLENDER_EEVEE_NEXT in 4.2; the original script predates that.
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = a.samples
scene.render.resolution_x = scene.render.resolution_y = a.res
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

world = bpy.data.worlds.new("RenderWorld")
world.use_nodes = True
scene.world = world
# A fresh world defaults to a near-black background, which with a single sun
# left every surface facing away from it in deep shadow: whole muscle groups
# read as silhouettes and adjacent bellies became impossible to tell apart.
# White ambient lifts the shadow side so the form still reads there.
_bg = world.node_tree.nodes.get("Background")
if _bg:
    _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    _bg.inputs[1].default_value = a.ambient

cam_data = bpy.data.cameras.new("rendercam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("rendercam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun_data = bpy.data.lights.new("rendersun", type="SUN")
sun_data.energy = 3.0
sun = bpy.data.objects.new("rendersun", sun_data)
scene.collection.objects.link(sun)

# Fill light opposite the key, so the shading that separates one muscle belly
# from the next survives on the side the key does not reach. Ambient alone
# flattens the form; ambient plus a fill keeps the creases readable.
fill_data = bpy.data.lights.new("renderfill", type="SUN")
fill_data.energy = a.fill_energy
fill = bpy.data.objects.new("renderfill", fill_data)
scene.collection.objects.link(fill)


def flat_white():
    mat = bpy.data.materials.new("mask_white")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (1, 1, 1, 1)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


def principled(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


mask_mat = flat_white()
# Saturated a little beyond the original (0.72, 0.32, 0.30) to hold its colour
# under the white ambient fill, which otherwise washes the muscle out to a pale
# pink barely distinguishable from bone.
plate_mat = principled("isolated_flesh", (0.76, 0.27, 0.25, 1.0))
bone_mat = principled("bone", (0.90, 0.88, 0.83, 1.0), roughness=0.6)
# Muscles outside the region are drawn muted, so the composited plate reads as
# "this region, in a body" rather than one undifferentiated slab of muscle. At
# the same saturation as the subject the two layers are indistinguishable and
# the composite looks like a rendering error.
context_mat = principled("context_flesh", (0.78, 0.47, 0.45, 1.0), roughness=0.65)


def bake_world_mesh(object_names, mesh_name):
    """Flattens objects into one world-space mesh, as the original did."""
    bm = bmesh.new()
    for n in object_names:
        src = bpy.data.objects.get(n)
        if not src or src.type != "MESH":
            if src is None:
                print(f"[warn] blenderObject not found, skipping: {n}")
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


def frame_camera_azimuth(bbox_min, bbox_max, angle_deg, margin=1.3):
    """VERBATIM from render_regions.py. angle 0 = anterior (-Y), 180 = posterior."""
    center = mathutils.Vector(((bbox_min[0] + bbox_max[0]) / 2,
                               (bbox_min[1] + bbox_max[1]) / 2,
                               (bbox_min[2] + bbox_max[2]) / 2))
    size = max(bbox_max[0] - bbox_min[0], bbox_max[1] - bbox_min[1], bbox_max[2] - bbox_min[2])
    dist = size * 4 + 0.5
    theta = math.radians(angle_deg)
    offset = mathutils.Vector((-dist * math.sin(theta), -dist * math.cos(theta), 0))
    loc = center + offset
    cam.location = loc
    cam.rotation_euler = (center - loc).to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = size * margin
    sun.rotation_euler = mathutils.Euler((0.9, 0.3, 0.6 + theta), 'XYZ')
    # Roughly opposite the key in azimuth, and from below the horizon, to lift
    # the underside of each belly rather than re-lighting the same face.
    fill.rotation_euler = mathutils.Euler((-0.7, -0.2, 0.6 + theta + math.pi), 'XYZ')
    return center, size


def render_to(path):
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    return time.time() - t0


def clear_render_objects():
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun, fill):
            scene.collection.objects.unlink(ob)


def link(mesh, name, material, holdout=False):
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.clear()
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.material_index = 0
    # Holdout punches alpha to 0 wherever the bone is nearest the camera, so a
    # muscle behind bone drops out of its own mask. Depth still applies: a
    # muscle in FRONT of bone is unaffected.
    ob.is_holdout = holdout
    scene.collection.objects.link(ob)
    return ob


# Z-Anatomy files nasal, ear and laryngeal cartilage under the skeletal system.
# Rendered, they give the skull a nose and ears — a skeleton that could not
# exist, and the first thing anyone notices. Costal cartilage stays: it joins
# the ribs to the sternum and is drawn in every skeletal atlas.
SOFT_CARTILAGE = (
    "nasal septal cartilage",
    "nasal cartilages",
    "major alar cartilage",
    "cartilages of ear",
    "thyroid cartilage",
    "cricoid cartilage",
    "arytenoid cartilage",
    "corniculate cartilage",
    "laryngeal cartilages",
)


def is_soft_cartilage(name):
    lowered = name.lower()
    return any(k in lowered for k in SOFT_CARTILAGE)


skel = bpy.data.collections.get("1: Skeletal system")
if skel is None:
    print("[fatal] collection '1: Skeletal system' not found")
    sys.exit(1)
all_skel = [o.name for o in skel.all_objects if o.type == "MESH"]
bone_names = [n for n in all_skel if not is_soft_cartilage(n)]
print(f"[bones] baking {len(bone_names)} skeletal meshes "
      f"({len(all_skel) - len(bone_names)} soft cartilage excluded)...", flush=True)
bone_mesh = bake_world_mesh(bone_names, "baked_bones")
print(f"[bones] {len(bone_mesh.vertices)} verts", flush=True)

# Every muscle in the body, for the plate. The regional renders previously drew
# only their own region's muscles, which left the figure looking amputated and
# removed the surrounding landmarks that help you orient. Baked once and reused
# across regions.
all_muscle_entries = [m for m in mapping if m.get("blenderObjects")]
print(f"[muscles] baking all {len(all_muscle_entries)} muscles for the plate...", flush=True)
all_muscle_meshes = {}
for e in all_muscle_entries:
    mesh = bake_world_mesh(e["blenderObjects"], f"all_{e['id']}")
    if len(mesh.vertices) == 0:
        bpy.data.meshes.remove(mesh)
        continue
    all_muscle_meshes[e["id"]] = mesh
print(f"[muscles] {len(all_muscle_meshes)} baked", flush=True)

total_renders = 0
t_start = time.time()

for region in regions:
    entries = [m for m in mapping if m["region"] == region and m.get("blenderObjects")]
    if not entries:
        print(f"[skip] {region}: nothing resolved", flush=True)
        continue

    print(f"[region] {region}: baking {len(entries)} muscles...", flush=True)
    baked = {}
    # Bounding box from MUSCLES ONLY -- this is what fixes the camera. Including
    # bones here would reframe every view and invalidate the shipped hotspots.
    region_min = [math.inf] * 3
    region_max = [-math.inf] * 3
    for e in entries:
        mesh = bake_world_mesh(e["blenderObjects"], f"baked_{e['id']}")
        if len(mesh.vertices) == 0:
            print(f"[warn] {e['id']}: baked mesh is empty, skipping", flush=True)
            bpy.data.meshes.remove(mesh)
            continue
        xs = [v.co.x for v in mesh.vertices]
        ys = [v.co.y for v in mesh.vertices]
        zs = [v.co.z for v in mesh.vertices]
        baked[e["id"]] = mesh
        for i, (lo, hi) in enumerate(((min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs)))):
            region_min[i] = min(region_min[i], lo)
            region_max[i] = max(region_max[i], hi)

    if not baked:
        print(f"[skip] {region}: all bakes empty", flush=True)
        continue

    for frame in views:
        angle = frame * 360.0 / a.frames
        centre, size = frame_camera_azimuth(tuple(region_min), tuple(region_max), angle)
        print(f"[camera] {region} frame-{frame:02d} angle={angle:.0f} "
              f"ortho={cam_data.ortho_scale:.4f}", flush=True)

        if not a.skip_plate:
            # Two plates per view, composited later by compositeRegionPlates.ts.
            #
            # SUBJECT: bones + this region's muscles. Matches the masks exactly,
            # so it is the layer the hotspots describe.
            clear_render_objects()
            link(bone_mesh, "plate_bones", bone_mat)
            for mid, mesh in baked.items():
                link(mesh, f"plate_{mid}", plate_mat)
            dt = render_to(os.path.join(a.out, region, f"frame-{frame:02d}.png"))
            total_renders += 1

            # CONTEXT: bones + every muscle in the body, for the surrounding
            # figure. Drawn on its own because compositing the subject back over
            # it is what keeps the region's muscles visible: rendering all the
            # muscles together instead would bury the deep regions entirely —
            # back-core's erector spinae and intercostals disappear behind
            # latissimus dorsi and trapezius, taking their hotspots with them.
            clear_render_objects()
            link(bone_mesh, "context_bones", bone_mat)
            for mid, mesh in all_muscle_meshes.items():
                link(mesh, f"context_{mid}", context_mat)
            dtc = render_to(os.path.join(a.out, region, f"context-{frame:02d}.png"))
            total_renders += 1
            print(f"[plate] {region} frame-{frame:02d} subject {dt:.1f}s context {dtc:.1f}s", flush=True)

        if a.plates_only:
            continue

        for mid, mesh in baked.items():
            clear_render_objects()
            link(bone_mesh, "occluder_bones", bone_mat, holdout=True)
            link(mesh, f"mask_{mid}", mask_mat)
            render_to(os.path.join(a.out, region, "masks", mid, f"frame-{frame:02d}.png"))
            total_renders += 1

        print(f"[masks] {region} frame-{frame:02d}: {len(baked)} masks "
              f"({total_renders} renders, {time.time() - t_start:.0f}s elapsed)", flush=True)

    for mesh in baked.values():
        bpy.data.meshes.remove(mesh)
    print(f"[done] {region}", flush=True)

print(f"[complete] {total_renders} renders in {time.time() - t_start:.0f}s -> {a.out}", flush=True)
