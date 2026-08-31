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
ap.add_argument("--frames", type=int, default=24)
ap.add_argument("--res", type=int, default=900)
ap.add_argument("--margin", type=float, default=2.4, help="camera framing slack around the muscle")
ap.add_argument("--samples", type=int, default=32)
a = ap.parse_args(argv)

mapping = {m["id"]: m for m in json.load(open(a.mapping))["mapping"]}
wanted = a.muscles.split(",")
views = [int(v) for v in a.views.split(",")]

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


# Blue picked to match the highlight the retired AI panels used.
highlight_mat = principled("panel_highlight", (0.22, 0.45, 0.72, 1.0), roughness=0.45)
bone_mat = principled("panel_bone", (0.90, 0.88, 0.82, 1.0), roughness=0.6)


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


def frame_camera(bbox_min, bbox_max, angle_deg, margin):
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
bone_names = [o.name for o in skel.all_objects if o.type == "MESH"]
print(f"[bones] baking {len(bone_names)} meshes...", flush=True)
bone_mesh = bake_world_mesh(bone_names, "panel_bones")
print(f"[bones] {len(bone_mesh.vertices)} verts", flush=True)

t0 = time.time()
count = 0
for mid in wanted:
    entry = mapping.get(mid)
    if not entry or not entry.get("blenderObjects"):
        print(f"[warn] no mapping for {mid}, skipping", flush=True)
        continue

    mesh = bake_world_mesh(entry["blenderObjects"], f"panel_{mid}")
    if len(mesh.vertices) == 0:
        print(f"[warn] {mid}: empty bake, skipping", flush=True)
        continue

    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    bmin = (min(xs), min(ys), min(zs))
    bmax = (max(xs), max(ys), max(zs))

    for frame in views:
        frame_camera(bmin, bmax, frame * 360.0 / a.frames, a.margin)
        clear_objects()
        link(bone_mesh, "panel_skeleton", bone_mat)
        link(mesh, f"panel_{mid}_hi", highlight_mat)
        path = os.path.abspath(os.path.join(a.out, mid, f"view-{frame:02d}.png"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        count += 1

    bpy.data.meshes.remove(mesh)
    print(f"[panel] {mid} ({count} renders, {time.time() - t0:.0f}s)", flush=True)

print(f"[complete] {count} renders in {time.time() - t0:.0f}s -> {a.out}", flush=True)
