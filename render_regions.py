"""render_regions.py — batch renders regional muscle turntables from Z-Anatomy.

    blender Z-Anatomy.blend --background --python render_regions.py -- \
        --mapping ta2-mapping.resolved.json --out ./renders/regions --region shoulder-arm --frames 24

Generalizes render_muscles.py's two fixed shots (--view-axis -Y front / +Y
back) into a full azimuth sweep, the same technique render_joints.py uses for
joints. angle=0 is anterior (matches the existing front-view convention),
angle=180 is posterior, so this ALSO retires the separate posterior render
pass (render_muscles.py --view-axis +Y, apply_posterior.py,
posterior_classification.json) - every muscle's back view is just frame
frameCount/2 of this same rotation now, not a hand-classified second pass.

Produces per region, per frame:
  regions/<region>/frame-NN.png              every muscle in the region, one shared material - the base plate
  regions/<region>/masks/<id>/frame-NN.png    that muscle in flat white on black, SAME camera

Does NOT touch renders/isolated/<id>.png (the plain flashcard portraits) -
those stay the single fixed shot render_muscles.py already produced; this
script is only for the highlighted-in-context view.

Start with one region (--region) and look at it before batching all five, per
the existing pipeline's own philosophy - a full region at 24 frames renders a
base plate + up to ~30 muscle masks per frame, so it's a real batch job.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mapping", default="ta2-mapping.resolved.json")
ap.add_argument("--out", default="./renders/regions")
ap.add_argument("--region", default=None, help="omit to render every region")
ap.add_argument("--frames", type=int, default=24)
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--engine", default="BLENDER_EEVEE")
a = ap.parse_args(argv)

mapping = json.load(open(a.mapping))["mapping"]
regions = [a.region] if a.region else sorted({m["region"] for m in mapping})

scene = bpy.data.scenes.new("RenderScene")
bpy.context.window.scene = scene
scene.render.engine = a.engine
if a.engine == "CYCLES":
    scene.cycles.samples = a.samples
    scene.cycles.device = "CPU"
else:
    scene.eevee.taa_render_samples = a.samples
scene.render.resolution_x = scene.render.resolution_y = a.res
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

world = bpy.data.worlds.new("RenderWorld")
world.use_nodes = True
scene.world = world

cam_data = bpy.data.cameras.new("rendercam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("rendercam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun_data = bpy.data.lights.new("rendersun", type="SUN")
sun_data.energy = 3.0
sun = bpy.data.objects.new("rendersun", sun_data)
scene.collection.objects.link(sun)


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


def isolated_material():
    mat = bpy.data.materials.new("isolated_flesh")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.72, 0.32, 0.30, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.5
    return mat


mask_mat = flat_white()
plate_mat = isolated_material()


def bake_world_mesh(object_names, mesh_name):
    bm = bmesh.new()
    for n in object_names:
        src = bpy.data.objects.get(n)
        if not src:
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
    """Same azimuth-orbit technique as render_joints.py's function of the
    same name - angle 0 = anterior (-Y), 180 = posterior (+Y)."""
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
    return center, size


def render_to(path):
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[timing] {time.time() - t0:.1f}s -> {path}", flush=True)


def clear_render_objects():
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun):
            scene.collection.objects.unlink(ob)


for region in regions:
    entries = [m for m in mapping if m["region"] == region and m.get("blenderObjects")]
    if not entries:
        print(f"[skip] {region}: nothing resolved")
        continue

    print(f"[region] {region}: baking {len(entries)} muscles...")
    baked = {}
    region_min = [math.inf, math.inf, math.inf]
    region_max = [-math.inf, -math.inf, -math.inf]
    for e in entries:
        mesh = bake_world_mesh(e["blenderObjects"], f"baked_{e['id']}")
        if len(mesh.vertices) == 0:
            print(f"[warn] {e['id']}: baked mesh is empty, skipping")
            bpy.data.meshes.remove(mesh)
            continue
        xs = [v.co.x for v in mesh.vertices]
        ys = [v.co.y for v in mesh.vertices]
        zs = [v.co.z for v in mesh.vertices]
        bmin = (min(xs), min(ys), min(zs))
        bmax = (max(xs), max(ys), max(zs))
        baked[e["id"]] = mesh
        for i in range(3):
            region_min[i] = min(region_min[i], bmin[i])
            region_max[i] = max(region_max[i], bmax[i])

    if not baked:
        print(f"[skip] {region}: all bakes empty")
        continue

    print(f"[region] {region}: {len(baked)} muscles resolved, rendering {a.frames} frames")

    for i in range(a.frames):
        angle = i * 360.0 / a.frames
        frame_camera_azimuth(tuple(region_min), tuple(region_max), angle)

        # 1. regional base plate - every muscle, one shared material
        clear_render_objects()
        plate_objs = []
        for mid, mesh in baked.items():
            ob = bpy.data.objects.new(f"plate_{mid}", mesh)
            ob.data.materials.clear()
            ob.data.materials.append(plate_mat)
            for p in ob.data.polygons:
                p.material_index = 0
            scene.collection.objects.link(ob)
            plate_objs.append(ob)
        render_to(os.path.join(a.out, region, f"frame-{i:02d}.png"))
        for ob in plate_objs:
            scene.collection.objects.unlink(ob)

        # 2. per-muscle masks, identical camera
        for mid, mesh in baked.items():
            clear_render_objects()
            ob = bpy.data.objects.new(f"mask_{mid}", mesh)
            ob.data.materials.clear()
            ob.data.materials.append(mask_mat)
            for p in ob.data.polygons:
                p.material_index = 0
            scene.collection.objects.link(ob)
            render_to(os.path.join(a.out, region, "masks", mid, f"frame-{i:02d}.png"))
            scene.collection.objects.unlink(ob)

    for mesh in baked.values():
        bpy.data.meshes.remove(mesh)
    print(f"[done] {region}: {len(baked)} muscles x {a.frames} frames")

print("[render_regions] complete ->", a.out)
