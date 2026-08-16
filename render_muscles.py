"""render_muscles.py — batch renders from Z-Anatomy inside Blender.

    blender Z-Anatomy.blend --background --python render_muscles.py -- \
        --mapping ta2-mapping.resolved.json --out ./renders --region shoulder-arm

Produces three things per region:
  base/<region>.png        all muscles of the region visible — the hotspot plate
  masks/<region>/<id>.png  that muscle in flat white on black, SAME camera
  isolated/<id>.png        the muscle alone, transparent background

The masks and the base plate share a camera, so a mask traced to SVG overlays
the base plate exactly. That is what makes "tap the supraspinatus" work.

Start with one region. Confirm the camera angle reads well before batching all five.

Implementation note: objects are never rendered in place. Z-Anatomy's muscle
objects depend on a parent-transform chain (grouping empties like "Deltoid
muscle.g") that Blender's EEVEE/Cycles fails to evaluate correctly once the
object is isolated into a render-only scene (or even with hide_render/hide_set
juggled in the original scene) - the render silently succeeds with a fully
blank/transparent image, no error. Bones with no parent (e.g. Talus) render
fine the naive way; muscles do not. The fix that actually works: bake each
object's world-space vertex positions into a brand-new standalone mesh (no
parent, no dependency chain) and render that instead.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mapping", default="ta2-mapping.resolved.json")
ap.add_argument("--out", default="./renders")
ap.add_argument("--region", default=None, help="omit to render every region")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--engine", default="BLENDER_EEVEE",
                 help="BLENDER_EEVEE (fast, rasterized - default) or CYCLES "
                      "(path-traced, much slower on CPU; only worth it for final polish)")
ap.add_argument("--view-axis", default="-Y", choices=["-Y", "+Y"],
                 help="camera side: -Y front (default) or +Y back/posterior")
a = ap.parse_args(argv)

mapping = json.load(open(a.mapping))["mapping"]
regions = [a.region] if a.region else sorted({m["region"] for m in mapping})

# --- render scene, independent of Z-Anatomy's own broken "Scene" ---
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
# base light direction (front-view tuning); for the posterior pass, mirror
# it across the Y axis so the flipped camera isn't shooting into backlight
_base_light_dir = mathutils.Euler((0.9, 0.3, 0.6), 'XYZ').to_quaternion() @ mathutils.Vector((0, 0, -1))
if a.view_axis == "-Y":
    _light_dir = _base_light_dir
else:
    _light_dir = mathutils.Vector((_base_light_dir.x, -_base_light_dir.y, _base_light_dir.z))
sun.rotation_euler = _light_dir.to_track_quat('-Z', 'Y').to_euler()


def flat_white():
    """Emission shader so masks come out as clean silhouettes, not shaded."""
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
iso_mat = isolated_material()


def bake_world_mesh(object_names, mesh_name):
    """Merge one or more source objects' geometry into a single standalone
    mesh with vertex coordinates baked to world space (no parent, no modifier
    dependency - see module docstring for why that matters here)."""
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


def frame_camera(bbox_min, bbox_max, view_axis="-Y", margin=1.3):
    """Auto-frame an orthographic camera around a world-space bounding box.
    view_axis is the horizontal direction the camera sits on: "-Y" (front,
    camera at -Y looking toward +Y) or "+Y" (back)."""
    center = mathutils.Vector(((bbox_min[0] + bbox_max[0]) / 2,
                                (bbox_min[1] + bbox_max[1]) / 2,
                                (bbox_min[2] + bbox_max[2]) / 2))
    size = max(bbox_max[0] - bbox_min[0], bbox_max[1] - bbox_min[1], bbox_max[2] - bbox_min[2])
    dist = size * 4 + 0.5
    offset = mathutils.Vector((0, -dist, 0)) if view_axis == "-Y" else mathutils.Vector((0, dist, 0))
    loc = center + offset
    cam.location = loc
    cam.rotation_euler = (center - loc).to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = size * margin
    return center, size


def render_to(path):
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
    baked = {}  # muscle id -> (mesh, world_bbox_min, world_bbox_max)
    region_min = [math.inf, math.inf, math.inf]
    region_max = [-math.inf, -math.inf, -math.inf]
    for e in entries:
        mesh = bake_world_mesh(e["blenderObjects"], f"baked_{e['id']}")
        if len(mesh.vertices) == 0:
            print(f"[warn] {e['id']}: baked mesh is empty, skipping")
            continue
        xs = [v.co.x for v in mesh.vertices]
        ys = [v.co.y for v in mesh.vertices]
        zs = [v.co.z for v in mesh.vertices]
        bmin = (min(xs), min(ys), min(zs))
        bmax = (max(xs), max(ys), max(zs))
        baked[e["id"]] = (mesh, bmin, bmax)
        for i in range(3):
            region_min[i] = min(region_min[i], bmin[i])
            region_max[i] = max(region_max[i], bmax[i])

    if not baked:
        print(f"[skip] {region}: all bakes empty")
        continue

    frame_camera(region_min, region_max, view_axis=a.view_axis)

    # 1. regional base plate - every muscle in the region, one shared material
    clear_render_objects()
    plate_objs = []
    for mid, (mesh, _, _) in baked.items():
        ob = bpy.data.objects.new(f"plate_{mid}", mesh)
        ob.data.materials.clear()
        ob.data.materials.append(plate_mat)
        for p in ob.data.polygons:
            p.material_index = 0
        scene.collection.objects.link(ob)
        plate_objs.append(ob)
    render_to(os.path.join(a.out, "base", f"{region}.png"))
    for ob in plate_objs:
        scene.collection.objects.unlink(ob)

    # 2. per-muscle masks, identical camera to the base plate
    for mid, (mesh, _, _) in baked.items():
        clear_render_objects()
        ob = bpy.data.objects.new(f"mask_{mid}", mesh)
        ob.data.materials.clear()
        ob.data.materials.append(mask_mat)
        for p in ob.data.polygons:
            p.material_index = 0
        scene.collection.objects.link(ob)
        render_to(os.path.join(a.out, "masks", region, f"{mid}.png"))
        scene.collection.objects.unlink(ob)

    # 3. isolated portraits - single side only (the region-wide bake includes
    # both left and right, which frames as two tiny disconnected blobs) with
    # its own tight framing per muscle
    for e in entries:
        mid = e["id"]
        if mid not in baked:
            continue
        one_side = [n for n in e["blenderObjects"] if n.endswith(".r")] or e["blenderObjects"]
        iso_mesh = bake_world_mesh(one_side, f"iso_src_{mid}")
        if len(iso_mesh.vertices) == 0:
            print(f"[warn] {mid}: isolated bake is empty, skipping")
            continue
        xs = [v.co.x for v in iso_mesh.vertices]
        ys = [v.co.y for v in iso_mesh.vertices]
        zs = [v.co.z for v in iso_mesh.vertices]
        bmin, bmax = (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))

        clear_render_objects()
        ob = bpy.data.objects.new(f"iso_{mid}", iso_mesh)
        ob.data.materials.clear()
        ob.data.materials.append(iso_mat)
        for p in ob.data.polygons:
            p.material_index = 0
        scene.collection.objects.link(ob)
        frame_camera(bmin, bmax, view_axis=a.view_axis, margin=1.15)
        render_to(os.path.join(a.out, "isolated", f"{mid}.png"))
        scene.collection.objects.unlink(ob)

    # restore region framing in case --region is omitted and we loop again
    print(f"[done] {region}: {len(baked)} muscles")

print("[render_muscles] complete ->", a.out)
