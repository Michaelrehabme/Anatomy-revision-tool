"""render_landmarks.py — batch renders skeletal landmarks from Z-Anatomy.

    blender Z-Anatomy.blend --background --python render_landmarks.py -- \
        --mapping ta2-mapping-landmarks.resolved.json --out ./renders

Landmarks come in two kinds (see ta2-mapping-landmarks.resolved.json):
  "solid" - a real bone/structure with fillable geometry (Talus, Calcaneus,
            L4 vertebra, menisci, glenoid labrum...). Rendered exactly like a
            muscle isolated portrait: renders/isolated/<id>.png. Entries that
            also carry a "contextObjects" list (a hand-picked set of real
            neighbor bones) get a second render at
            renders/landmark-context/<id>.png: the target bone highlighted
            in a distinct color among its (muted-color) neighbors, one side
            only, so it reads in situ instead of as an isolated cutout.
  "pin"   - Z-Anatomy's own 2-vertex label-pin markers (facets, notches,
            processes...) with no surface to render on their own. Its direct
            parent (a ".s" surface patch object) is itself parented to the
            actual bone - Trochlear notch.i -> Trochlear notch.s -> Ulna.l.
            For these: render the parent bone as a context plate
            (renders/landmark-context/<bone>.png), then project the pin's
            world centroid through that same camera into normalised 0-1
            image coordinates and record it in landmark-pins.json. The quiz
            UI draws the pin on top of the context image at render time -
            same "reveal the answer with a pin" idea the original README
            describes for muscle origin/insertion points.

Uses the same world-space-bake technique as render_muscles.py and for the
same reason: these objects sit in a parent chain that Blender's renderer
fails to evaluate correctly once isolated into a render-only scene.
"""
import bpy, json, sys, os, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mapping", default="ta2-mapping-landmarks.resolved.json")
ap.add_argument("--out", default="./renders")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--engine", default="BLENDER_EEVEE")
ap.add_argument("--only", default=None, help="comma-separated landmark ids to restrict processing to")
a = ap.parse_args(argv)

mapping = json.load(open(a.mapping, encoding="utf-8"))["mapping"]
entries = [m for m in mapping if m.get("blenderObjects")]
if a.only:
    wanted = set(a.only.split(","))
    entries = [m for m in entries if m["id"] in wanted]

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
sun.rotation_euler = (0.9, 0.3, 0.6)


def isolated_material(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.5
    return mat


bone_mat = isolated_material("bone_context", (0.88, 0.85, 0.76, 1.0))
solid_mat = isolated_material("landmark_solid", (0.88, 0.85, 0.76, 1.0))
highlight_mat = isolated_material("landmark_highlight", (0.85, 0.45, 0.15, 1.0))


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


def approx_world_centroid(object_names):
    """Best-effort world position for a pin marker.

    These ".i" marker objects are parented through a ".s" FONT (text-label)
    object whose matrix_world never evaluates correctly in --background mode
    (identity matrix - almost certainly because Z-Anatomy's own init script,
    which the "scripts disabled" log line refers to, normally repositions
    these and never runs headless). Walking matrix_local up the parent chain
    doesn't help either - it composes to the same broken result.

    What does work, approximately: each marker's own delta_location is close
    to its true world position with the X axis mirrored (bones on the left
    side, e.g. "Hip bone.l", use delta_location AS their real matrix_world
    translation directly, no flip - but the pins' delta_location consistently
    needs its X negated to land in the right place). Verified visually against
    3 scapula landmarks: 2 of 3 (coracoid process, glenoid fossa) landed
    correctly, 1 (acromion) landed noticeably outside the bone. Ship as an
    approximation - every pin is flagged "approximate": true downstream so
    this isn't presented as precise.
    """
    src = bpy.data.objects.get(object_names[0])
    if not src:
        return None
    dl = src.delta_location
    if dl.length < 0.01:
        # delta_location was never authored for this marker (stayed at the
        # default (0,0,0)) - there's no usable position data at all, so
        # don't project a fake one; the caller falls back to frame-center.
        return None
    return mathutils.Vector((-dl.x, dl.y, dl.z))


def frame_camera(bbox_min, bbox_max, margin=1.2):
    center = mathutils.Vector(((bbox_min[0] + bbox_max[0]) / 2,
                                (bbox_min[1] + bbox_max[1]) / 2,
                                (bbox_min[2] + bbox_max[2]) / 2))
    size = max(bbox_max[0] - bbox_min[0], bbox_max[1] - bbox_min[1], bbox_max[2] - bbox_min[2])
    dist = size * 4 + 0.5
    loc = center + mathutils.Vector((0, -dist, 0))
    cam.location = loc
    cam.rotation_euler = (center - loc).to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = size * margin
    return center, size


def clear_render_objects():
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun):
            scene.collection.objects.unlink(ob)


def render_to(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[timing] {time.time() - t0:.1f}s -> {path}", flush=True)


def mesh_bbox(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def find_parent_bone(object_names):
    bones = set()
    for n in object_names:
        ob = bpy.data.objects.get(n)
        if ob and ob.parent and ob.parent.parent:
            bones.add(ob.parent.parent.name)
    return sorted(bones)[0] if bones else None


solids, pins = [], []
for e in entries:
    mesh = bake_world_mesh(e["blenderObjects"], f"lm_{e['id']}")
    if len(mesh.polygons) > 0:
        solids.append((e, mesh))
    else:
        bpy.data.meshes.remove(mesh)
        bone = find_parent_bone(e["blenderObjects"])
        if not bone:
            print(f"[warn] {e['id']}: pin landmark with no resolvable parent bone, skipping")
            continue
        centroid = approx_world_centroid(e["blenderObjects"])
        pins.append((e, bone, centroid))

print(f"[survey] {len(solids)} solid landmarks, {len(pins)} pin landmarks "
      f"across {len({b for _, b, _ in pins})} parent bones")

# --- solid landmarks: isolated portraits, same technique as muscles ---
for e, mesh in solids:
    clear_render_objects()
    ob = bpy.data.objects.new(f"solid_{e['id']}", mesh)
    ob.data.materials.clear()
    ob.data.materials.append(solid_mat)
    for p in ob.data.polygons:
        p.material_index = 0
    scene.collection.objects.link(ob)
    bmin, bmax = mesh_bbox(mesh)
    frame_camera(bmin, bmax, margin=1.15)
    render_to(os.path.join(a.out, "isolated", f"{e['id']}.png"))
    scene.collection.objects.unlink(ob)

# --- solid landmarks with contextObjects: target bone highlighted among its
# real neighbors, same idea as the pin-landmark context plates below but for
# landmarks that are themselves a whole bone rather than a marker on one.
# Renders one side only (".l", or unsided objects like vertebrae) - matching
# both sides would double the bbox and shrink everything to match the old
# isolated renders' problem of two tiny bones with dead space between them.
for e, _mesh in solids:
    ctx = e.get("contextObjects")
    if not ctx:
        continue
    target_names = [n for n in e["blenderObjects"] if not n.endswith(".r")] or e["blenderObjects"][:1]
    target_mesh = bake_world_mesh(target_names, f"ctxtarget_{e['id']}")
    if len(target_mesh.polygons) == 0:
        print(f"[warn] {e['id']}: context target mesh empty, skipping context render")
        bpy.data.meshes.remove(target_mesh)
        continue
    neighbor_mesh = bake_world_mesh(ctx, f"ctxneighbors_{e['id']}")

    clear_render_objects()
    t_ob = bpy.data.objects.new(f"ctxtarget_{e['id']}", target_mesh)
    t_ob.data.materials.clear()
    t_ob.data.materials.append(highlight_mat)
    for p in t_ob.data.polygons:
        p.material_index = 0
    scene.collection.objects.link(t_ob)
    bmin, bmax = mesh_bbox(target_mesh)

    if len(neighbor_mesh.vertices) > 0:
        n_ob = bpy.data.objects.new(f"ctxneighbors_{e['id']}", neighbor_mesh)
        n_ob.data.materials.clear()
        n_ob.data.materials.append(bone_mat)
        for p in n_ob.data.polygons:
            p.material_index = 0
        scene.collection.objects.link(n_ob)
    else:
        print(f"[warn] {e['id']}: none of contextObjects resolved, rendering target only")

    # Frame on the TARGET's own bbox, not the combined one - a neighbor that's
    # a full long bone (femur, humerus, tibia+fibula) would otherwise dominate
    # the shot and shrink the target to a speck. The wide margin still pulls
    # in nearby neighbor geometry as visible context; distal ends of long
    # bones simply run off-frame instead of setting the zoom level.
    frame_camera(bmin, bmax, margin=2.4)
    render_to(os.path.join(a.out, "landmark-context", f"{e['id']}.png"))

# --- pin landmarks: render each unique parent bone once, project pins onto it ---
pins_by_bone = {}
for e, bone, centroid in pins:
    pins_by_bone.setdefault(bone, []).append((e, centroid))

landmark_pins = {}
for bone, items in pins_by_bone.items():
    bone_mesh = bake_world_mesh([bone], f"bone_{bone}")
    if len(bone_mesh.vertices) == 0:
        print(f"[warn] parent bone not found/empty: {bone}, skipping {len(items)} pins on it")
        continue
    clear_render_objects()
    ob = bpy.data.objects.new(f"bonectx_{bone}", bone_mesh)
    ob.data.materials.clear()
    ob.data.materials.append(bone_mat)
    for p in ob.data.polygons:
        p.material_index = 0
    scene.collection.objects.link(ob)
    bmin, bmax = mesh_bbox(bone_mesh)
    frame_camera(bmin, bmax, margin=1.3)
    safe_name = bone.replace(" ", "-").replace(".", "-").lower()
    img_path = os.path.join(a.out, "landmark-context", f"{safe_name}.png")
    render_to(img_path)
    scene.collection.objects.unlink(ob)

    for e, centroid in items:
        if centroid is None:
            # No usable delta_location for this marker at all (see
            # approx_world_centroid) - skip rather than show a meaningless
            # pin. Downstream, a landmark with no pin entry and no isolated
            # render just doesn't get a "kind" and drops out of the quiz.
            print(f"[warn] {e['id']}: no position data, dropping pin")
            continue
        # Manual ortho projection: camera looks down local -Z with +Y as up
        # (see to_track_quat('-Z', 'Y') in frame_camera), and the render is
        # square, so ortho_scale applies equally to both axes.
        local = cam.matrix_world.inverted() @ centroid
        nx = 0.5 + local.x / cam_data.ortho_scale
        ny = 0.5 + local.y / cam_data.ortho_scale
        # Defensive clamp: the approximation can occasionally miss badly:
        # better a pin pinned to the edge of a plausible bone image than one
        # rendered hundreds of percent off-screen.
        nx = max(0.03, min(0.97, nx))
        ny = max(0.03, min(0.97, ny))
        landmark_pins[e["id"]] = {
            "contextImage": os.path.relpath(img_path, ".").replace("\\", "/"),
            "x": round(nx, 5),
            "y": round(1.0 - ny, 5),  # flip to top-left-origin image convention
            "parentBone": bone,
            "approximate": True,
        }

os.makedirs(a.out, exist_ok=True)
out_path = "landmark-pins.json"
json.dump({
    "schemaVersion": 1,
    "note": ("Pin (x, y) coordinates are APPROXIMATE. Z-Anatomy's marker objects sit in a "
             "parent chain that fails to evaluate in headless Blender, so positions are "
             "reconstructed from each marker's delta_location with an empirically-found X-axis "
             "correction. Visually verified against 3 landmarks: 2 landed correctly, 1 "
             "(acromion) landed visibly outside its bone. Treat every pin here as a best-effort "
             "placement, not a verified one - see render_landmarks.py's approx_world_centroid()."),
    "pins": landmark_pins,
}, open(out_path, "w", encoding="utf-8"), indent=2)
context_count = len([e for e, _mesh in solids if e.get("contextObjects")])
print(f"[render_landmarks] {len(solids)} solid renders, {context_count} solid-context renders, "
      f"{len(landmark_pins)} pins -> {out_path}")
