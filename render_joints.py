"""render_joints.py — batch renders joint-context turntables from Z-Anatomy.

    blender Z-Anatomy.blend --background --python render_joints.py -- \
        --joints-config joints.json --joint elbow --frames 24 --out ./renders/joints

For each joint (see joints.json): bakes its member bones into one context mesh
and rotates a camera through --frames evenly-spaced azimuth steps around it,
producing a shared turntable base plate: renders/joints/<joint>/frame-NN.png.
angle=0 is anterior (matches the existing -Y "front" convention already used
by render_muscles.py/render_landmarks.py), angle=180 is posterior (+Y), so a
static "Anterior/Posterior/Side" button in the UI is just a fixed frame index
into this same sequence - there's no separate static-view render pass.

Landmarks belonging to that joint (joints.json's "landmarks" list, resolved
against ta2-mapping-landmarks.resolved.json for which Blender objects they
are) get highlighted per frame:
  "pin"   (no fillable geometry, e.g. a notch/facet marker) - no extra render.
          Its world position (render_landmarks.py's approx_world_centroid
          technique, reused verbatim) is projected through EVERY frame's
          camera -> joint-pins.json. Cheap: pure math, no pixels rendered.
  "solid" (a real mesh, e.g. glenoid labrum) - a same-camera flat-white
          silhouette mask rendered at EVERY frame ->
          renders/joints/<joint>/masks/<landmark-id>/frame-NN.png, traced
          downstream by masks_to_svg.py's per-frame mode into joint-hotspots.json.

Same world-space-bake technique as render_muscles.py/render_landmarks.py, and
for the same reason: these objects sit in a parent chain Blender's renderer
fails to evaluate once isolated into a render-only scene.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--joints-config", default="joints.json")
ap.add_argument("--landmarks", default="landmarks.json")
ap.add_argument("--mapping", default="ta2-mapping-landmarks.resolved.json")
ap.add_argument("--joint", default=None, help="omit to render every joint")
ap.add_argument("--frames", type=int, default=24)
ap.add_argument("--out", default="./renders/joints")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--engine", default="BLENDER_EEVEE",
                 help="BLENDER_EEVEE (fast, rasterized - default) or CYCLES")
a = ap.parse_args(argv)

joints_cfg = json.load(open(a.joints_config, encoding="utf-8"))["joints"]
if a.joint:
    joints_cfg = [j for j in joints_cfg if j["id"] == a.joint]
    if not joints_cfg:
        raise SystemExit(f"no joint '{a.joint}' in {a.joints_config}")

landmarks_by_id = {lm["id"]: lm for lm in json.load(open(a.landmarks, encoding="utf-8"))["landmarks"]}
mapping_by_id = {m["id"]: m for m in json.load(open(a.mapping, encoding="utf-8"))["mapping"]}

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


def bone_material():
    mat = bpy.data.materials.new("bone_context")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.88, 0.85, 0.76, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.5
    return mat


mask_mat = flat_white()
plate_mat = bone_material()


def bake_world_mesh(object_names, mesh_name):
    """Merge one or more source objects' geometry into a single standalone
    mesh with vertex coordinates baked to world space (no parent, no modifier
    dependency)."""
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


def mesh_bbox(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def frame_camera_azimuth(bbox_min, bbox_max, angle_deg, margin=1.3):
    """Auto-frame an orthographic camera on a bbox, orbiting azimuth (degrees)
    around the vertical (Z) axis. angle=0 -> -Y (anterior, matches the
    existing front-view convention); angle=180 -> +Y (posterior, matches the
    existing back-view convention); angle=90/270 -> the two side views. Keeps
    the sun roughly "attached" to the camera as it orbits so no frame ends up
    backlit."""
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


def clear_render_objects():
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun):
            scene.collection.objects.unlink(ob)


def render_to(path):
    # Blender's render.filepath resolver mishandles a relative path that mixes
    # forward and back slashes (os.path.join on Windows appends native "\\" to
    # an already-forward-slash "./renders/..." prefix) - it silently writes to
    # the drive root instead of the intended folder. Always hand it an
    # absolute, OS-native path to sidestep that.
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[timing] {time.time() - t0:.1f}s -> {path}", flush=True)


def approx_world_centroid(object_names):
    """Best-effort world position for a pin marker - same technique and same
    caveats as render_landmarks.py's function of the same name."""
    src = bpy.data.objects.get(object_names[0])
    if not src:
        return None
    dl = src.delta_location
    if dl.length < 0.01:
        return None
    return mathutils.Vector((-dl.x, dl.y, dl.z))


joint_pins = {}
for joint in joints_cfg:
    jid = joint["id"]
    joint_mesh = bake_world_mesh(joint["bones"], f"joint_{jid}")
    if len(joint_mesh.vertices) == 0:
        print(f"[skip] {jid}: no bones resolved ({joint['bones']})")
        bpy.data.meshes.remove(joint_mesh)
        continue
    bmin, bmax = mesh_bbox(joint_mesh)

    solid_landmarks, pin_landmarks = [], []
    for lid in joint.get("landmarks", []):
        lm = landmarks_by_id.get(lid)
        m = mapping_by_id.get(lid)
        if not lm or not m or not m.get("blenderObjects"):
            print(f"[warn] {jid}/{lid}: no landmark/mapping entry (or unresolved), skipping highlight")
            continue
        mesh = bake_world_mesh(m["blenderObjects"], f"lm_{lid}")
        if len(mesh.polygons) > 0:
            solid_landmarks.append((lid, mesh))
        else:
            bpy.data.meshes.remove(mesh)
            centroid = approx_world_centroid(m["blenderObjects"])
            if centroid is None:
                print(f"[warn] {jid}/{lid}: no position data, dropping pin")
                continue
            pin_landmarks.append((lid, centroid))

    print(f"[joint] {jid}: {len(solid_landmarks)} solid, {len(pin_landmarks)} pin landmarks, {a.frames} frames")

    for i in range(a.frames):
        angle = i * 360.0 / a.frames
        frame_camera_azimuth(bmin, bmax, angle)

        # shared base plate - the joint's bones, neutral material
        clear_render_objects()
        ob = bpy.data.objects.new(f"plate_{jid}", joint_mesh)
        ob.data.materials.clear()
        ob.data.materials.append(plate_mat)
        for p in ob.data.polygons:
            p.material_index = 0
        scene.collection.objects.link(ob)
        render_to(os.path.join(a.out, jid, f"frame-{i:02d}.png"))
        scene.collection.objects.unlink(ob)

        # pin projections - identical camera, no extra render
        for lid, centroid in pin_landmarks:
            local = cam.matrix_world.inverted() @ centroid
            nx = 0.5 + local.x / cam_data.ortho_scale
            ny = 0.5 + local.y / cam_data.ortho_scale
            nx = max(0.03, min(0.97, nx))
            ny = max(0.03, min(0.97, ny))
            joint_pins.setdefault(jid, {}).setdefault(lid, {})[str(i)] = {
                "x": round(nx, 5), "y": round(1.0 - ny, 5),
            }

        # solid landmark silhouette masks - identical camera
        for lid, mesh in solid_landmarks:
            clear_render_objects()
            mob = bpy.data.objects.new(f"mask_{lid}", mesh)
            mob.data.materials.clear()
            mob.data.materials.append(mask_mat)
            for p in mob.data.polygons:
                p.material_index = 0
            scene.collection.objects.link(mob)
            render_to(os.path.join(a.out, jid, "masks", lid, f"frame-{i:02d}.png"))
            scene.collection.objects.unlink(mob)

    for _, mesh in solid_landmarks:
        bpy.data.meshes.remove(mesh)
    bpy.data.meshes.remove(joint_mesh)
    print(f"[done] {jid}")

os.makedirs(a.out, exist_ok=True)
out_path = "joint-pins.json"
# Merge with whatever's already on disk - running one joint at a time (the
# recommended "look before batching" workflow) would otherwise clobber every
# previously-rendered joint's pins each time this writes.
existing = {}
if os.path.exists(out_path):
    existing = json.load(open(out_path, encoding="utf-8")).get("pins", {})
existing.update(joint_pins)
json.dump({
    "schemaVersion": 1,
    "note": ("Pin (x, y) coordinates per frame index, top-left-origin, APPROXIMATE - "
             "see render_landmarks.py's approx_world_centroid() docstring for the "
             "projection technique and its known caveats (reused verbatim here)."),
    "frames": a.frames,
    "pins": existing,
}, open(out_path, "w", encoding="utf-8"), indent=2)
print(f"[render_joints] complete -> {a.out}, pins -> {out_path}")
