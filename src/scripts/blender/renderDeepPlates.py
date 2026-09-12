"""Renders a deep-muscle layer per region: the plate, and one mask per muscle.

WHY A SECOND LAYER. 48 muscles have no locate hotspot, and they are all the same
kind: subscapularis under the scapula, the deep hip rotators, the deep spinal
series, the plantar and palmar intrinsics, the diaphragm. On the region plates
they sit behind something, the depth subtraction removes what is covered, and
what is left falls under the visibility threshold. They are not missing from the
data — they are missing from the picture.

So this draws the layer underneath: bones plus only those muscles. Nothing is in
front of them because nothing in front of them is rendered.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderDeepPlates.py -- \
      --mapping deep-muscles.mapping.json --out renders/deep

WHICH MUSCLES IS DATA, NOT JUDGEMENT. The set is exactly those with no hotspot,
which avoids depending on the superficial/deep classification in
generateMusclePanels.ts — that list is 12 names and an assumption, and several
of the muscles it calls deep are not.

NO OCCLUSION ORDER NEEDED. Each mask is rendered with the skeleton and every
OTHER muscle on the plate held out, so the masks are already mutually exclusive
in 3D. masksToHotspots.ts subtracts in 2D using a hand-authored order per view
(occlusionOrder.ts) because its masks are not; these do not need one.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mapping", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--region", default=None)
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--margin", type=float, default=1.6, help="camera slack around the region")
a = ap.parse_args(argv)

mapping = [m for m in json.load(open(a.mapping))["mapping"] if m.get("blenderObjects")]
regions = [a.region] if a.region else sorted({m["region"] for m in mapping})
views = [int(v) for v in a.views.split(",")]

scene = bpy.data.scenes.new("DeepScene")
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

scene.world = bpy.data.worlds.new("DeepWorld")
scene.world.use_nodes = True
_bg = scene.world.node_tree.nodes.get("Background")
if _bg:
    _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    _bg.inputs[1].default_value = 0.55

cam_data = bpy.data.cameras.new("deepcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("deepcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun = bpy.data.objects.new("deepsun", bpy.data.lights.new("deepsun", type="SUN"))
sun.data.energy = 3.0
scene.collection.objects.link(sun)


def principled(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def flat_white():
    mat = bpy.data.materials.new("deep_mask")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (1, 1, 1, 1)
    em.inputs[1].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


# The same muscle red the panels and region plates use.
FLESH_MAT = principled("deep_flesh", (0.76, 0.27, 0.25, 1), 0.5)
BONE_MAT = principled("deep_bone", (0.90, 0.88, 0.83, 1), 0.6)
MASK_MAT = flat_white()


def bake(names, mesh_name):
    bm = bmesh.new()
    for n in names:
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


def mesh_bbox(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def frame_camera(lo, hi, angle_deg, margin):
    centre = mathutils.Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
    size = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    dist = size * 4 + 0.5
    theta = math.radians(angle_deg)
    offset = mathutils.Vector((-dist * math.sin(theta), -dist * math.cos(theta), 0))
    cam.location = centre + offset
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = size * margin
    sun.rotation_euler = mathutils.Euler((0.9, 0.3, 0.6 + theta), "XYZ")


def clear():
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun):
            scene.collection.objects.unlink(ob)


def link(mesh, name, material, holdout=False):
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.clear()
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.material_index = 0
    ob.is_holdout = holdout
    scene.collection.objects.link(ob)
    return ob


def render_to(path):
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# The collection's own title is a mesh inside it — see the other renderers.
skel = bpy.data.collections.get("1: Skeletal system")
skeleton_names = [o.name for o in skel.all_objects if o.type == "MESH" and not o.name.endswith(".g")]
print(f"[bones] baking {len(skeleton_names)} meshes...", flush=True)
skeleton_mesh = bake(skeleton_names, "deep_skeleton")

t0 = time.time()
count = 0
for region in regions:
    entries = [m for m in mapping if m["region"] == region]
    if not entries:
        continue

    baked = {}
    for m in entries:
        mesh = bake(m["blenderObjects"], f"deep_{m['id']}")
        if mesh.vertices:
            baked[m["id"]] = mesh
        else:
            print(f"[warn] {m['id']}: empty bake", flush=True)

    region_mesh = bake([n for m in entries for n in m["blenderObjects"]], f"deepregion_{region}")
    lo, hi = mesh_bbox(region_mesh)
    print(f"[region] {region}: {len(baked)} deep muscles", flush=True)

    for frame in views:
        frame_camera(lo, hi, frame * 15, a.margin)

        # The plate: bones, and these muscles on them. Nothing superficial, so
        # nothing is hidden.
        clear()
        link(skeleton_mesh, f"plate_bones_{region}", BONE_MAT)
        for mid, mesh in baked.items():
            link(mesh, f"plate_{mid}", FLESH_MAT)
        render_to(os.path.join(a.out, region, f"view-{frame:02d}.png"))
        count += 1

        # One mask each, with the skeleton and every other muscle on this plate
        # held out. No re-baking: the skeleton is one mesh already and the other
        # muscles are already baked, so the occluders are linked, not rebuilt.
        for mid, mesh in baked.items():
            clear()
            link(skeleton_mesh, f"occ_bones_{mid}", BONE_MAT, holdout=True)
            for other, omesh in baked.items():
                if other != mid:
                    link(omesh, f"occ_{other}", BONE_MAT, holdout=True)
            link(mesh, f"mask_{mid}", MASK_MAT)
            render_to(os.path.join(a.out, region, "masks", mid, f"view-{frame:02d}.png"))
            count += 1

        print(f"[masks] {region} view-{frame:02d}: {len(baked)} masks "
              f"({count} renders, {time.time() - t0:.0f}s)", flush=True)

    for mesh in baked.values():
        bpy.data.meshes.remove(mesh)
    bpy.data.meshes.remove(region_mesh)

print(f"[complete] {count} renders -> {a.out}", flush=True)
