"""Renders the plates and masks a bone locate question needs, one set per region.

WHY BONES WERE THE EASIEST CATEGORY LEFT. All 30 already carry
eligibility.locate: true and every one of them is solid geometry — unlike a
landmark, which is a point, or a joint, which is a gap. They had no locate
question for one reason only: no hotspot anywhere in the app described a bone.
The region plates are muscle plates, and their hotspots are muscles.

So this is the muscle-region pipeline with bones as the subject. For each
region it renders the skeleton framed on that region's bones, then one mask per
bone with every OTHER bone held out, so a bone hidden behind another does not
claim pixels a student cannot see. bonePlateHotspots.ts traces the masks.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderBonePlates.py -- \
      --mapping ta2-mapping-skeletal.resolved.json --out renders/bones

FRAMED ON THE REGION, NOT THE BONE. Every bone in a region shares one camera,
because they share one image: a student is shown the forearm and hand and asked
for the radius. Framing per bone would need 30 images and would also answer the
question, since the named bone would be the one in the middle.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mapping", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--region", default=None, help="omit to render every region")
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--margin", type=float, default=1.25, help="camera slack around the region")
a = ap.parse_args(argv)

mapping = [m for m in json.load(open(a.mapping))["mapping"]
           if m.get("category") == "bone" and m.get("blenderObjects")]
regions = [a.region] if a.region else sorted({m["region"] for m in mapping})
views = [int(v) for v in a.views.split(",")]

scene = bpy.data.scenes.new("BoneScene")
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

scene.world = bpy.data.worlds.new("BoneWorld")
scene.world.use_nodes = True
_bg = scene.world.node_tree.nodes.get("Background")
if _bg:
    _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    _bg.inputs[1].default_value = 0.55

cam_data = bpy.data.cameras.new("bonecam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("bonecam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun = bpy.data.objects.new("bonesun", bpy.data.lights.new("bonesun", type="SUN"))
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
    """Emission: a mask must be a hard silhouette with no shading to threshold."""
    mat = bpy.data.materials.new("bone_mask")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (1, 1, 1, 1)
    em.inputs[1].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


BONE_MAT = principled("bone_plate", (0.90, 0.88, 0.83, 1), 0.6)
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
skeleton_mesh = bake(skeleton_names, "bone_skeleton")

t0 = time.time()
count = 0
for region in regions:
    entries = [m for m in mapping if m["region"] == region]
    if not entries:
        continue

    baked = {}
    occluders = {}
    for m in entries:
        mesh = bake(m["blenderObjects"], f"bone_{m['id']}")
        if not mesh.vertices:
            print(f"[warn] {m['id']}: empty bake", flush=True)
            continue
        baked[m["id"]] = mesh
        # Everything except this bone, baked ONCE per bone rather than once per
        # view: the skeleton is 1,244 meshes and baking it per view would spend
        # most of an hour on work that does not change when the camera moves.
        own = set(m["blenderObjects"])
        occluders[m["id"]] = bake([n for n in skeleton_names if n not in own], f"occ_{m['id']}")

    region_mesh = bake([n for m in entries for n in m["blenderObjects"]], f"region_{region}")
    lo, hi = mesh_bbox(region_mesh)
    print(f"[region] {region}: {len(baked)} bones", flush=True)

    for frame in views:
        frame_camera(lo, hi, frame * 15, a.margin)

        # The plate: the whole skeleton, plainly lit and nothing picked out.
        clear()
        link(skeleton_mesh, f"plate_{region}", BONE_MAT)
        render_to(os.path.join(a.out, region, f"view-{frame:02d}.png"))
        count += 1

        # One mask per bone, every other bone holding it out, so a bone behind
        # another does not claim pixels the student cannot see.
        for bid, mesh in baked.items():
            clear()
            link(occluders[bid], f"occ_{bid}", BONE_MAT, holdout=True)
            link(mesh, f"mask_{bid}", MASK_MAT)
            render_to(os.path.join(a.out, region, "masks", bid, f"view-{frame:02d}.png"))
            count += 1

        print(f"[masks] {region} view-{frame:02d}: {len(baked)} masks "
              f"({count} renders, {time.time() - t0:.0f}s)", flush=True)

    for mesh in baked.values():
        bpy.data.meshes.remove(mesh)
    for mesh in occluders.values():
        bpy.data.meshes.remove(mesh)
    bpy.data.meshes.remove(region_mesh)

print(f"[complete] {count} renders -> {a.out}", flush=True)
