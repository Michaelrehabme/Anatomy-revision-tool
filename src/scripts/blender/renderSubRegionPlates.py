"""Renders a plate per sub-region, close enough that its small structures are targets.

WHY. The region plates and the skeleton plates frame a whole limb. At that scale
the lumbricals, the interossei, the scaphoid and the atlas come out a few
hundred pixels across and get dropped rather than traced, because a target a
finger cannot hit is not a question. Nothing is wrong with those structures —
the camera is in the wrong place for them. A hand drawn at forearm scale cannot
give the lumbricals a target; at hand scale it can.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderSubRegionPlates.py -- \
      --spec subregion-plates.spec.json --out renders/subregions

BONES AND MUSCLES ON ONE PLATE. A student looking at a hand should be asked for
the scaphoid and for opponens pollicis from the same picture, which is how a
textbook plate works too. They differ only in how they are drawn: a muscle is
laid ON the skeleton, while a bone IS the skeleton, so a bone's mask needs the
rest of the skeleton held out around it.

THE EXPENSIVE BAKE HAPPENS ONCE PER PLATE, NOT ONCE PER SUBJECT. The occluder
for any subject is "everything else": the skeleton minus every bone subject on
this plate, plus the other subjects. Baking the first part once per plate and
linking the already-baked subjects around it turns roughly fifty full-skeleton
bakes into five.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--spec", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--only", default="", help="comma-separated plate keys")
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--margin", type=float, default=1.35, help="camera slack around the subjects")
ap.add_argument("--elevations", default="0",
                help="camera heights in degrees; negative looks up from below. Needs = syntax "
                     "for negatives, since argparse reads a leading minus as a flag.")
a = ap.parse_args(argv)

spec = json.load(open(a.spec))
wanted = set(filter(None, a.only.split(","))) or {p["key"] for p in spec["plates"]}
views = [int(v) for v in a.views.split(",")]
elevations = [float(e) for e in a.elevations.split(",")]

scene = bpy.data.scenes.new("SubScene")
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

scene.world = bpy.data.worlds.new("SubWorld")
scene.world.use_nodes = True
_bg = scene.world.node_tree.nodes.get("Background")
if _bg:
    _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    _bg.inputs[1].default_value = 0.55

cam_data = bpy.data.cameras.new("subcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("subcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun = bpy.data.objects.new("subsun", bpy.data.lights.new("subsun", type="SUN"))
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
    mat = bpy.data.materials.new("sub_mask")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (1, 1, 1, 1)
    em.inputs[1].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


FLESH_MAT = principled("sub_flesh", (0.76, 0.27, 0.25, 1), 0.5)
BONE_MAT = principled("sub_bone", (0.90, 0.88, 0.83, 1), 0.6)
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


def side_of(names):
    for suffix in (".l", ".r"):
        if any(n.endswith(suffix) for n in names):
            return suffix
    return None


def frame_camera(lo, hi, angle_deg, margin, elevation_deg=0.0):
    """Spinning alone never shows the sole of a foot.

    The plantar muscles — quadratus plantae, flexor hallucis brevis, the plantar
    interossei — are under the foot bones from every angle on the vertical axis,
    which is why they survived a close plate and still had no target. Elevation
    is the axis that reaches them, the same one renderMusclePanels.py needed.
    """
    centre = mathutils.Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
    size = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    dist = size * 6 + 0.5
    theta = math.radians(angle_deg)
    phi = math.radians(elevation_deg)
    offset = mathutils.Vector((-dist * math.sin(theta) * math.cos(phi),
                               -dist * math.cos(theta) * math.cos(phi),
                               dist * math.sin(phi)))
    cam.location = centre + offset
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = size * margin
    # Keep the key light off the camera axis at any elevation, or a view from
    # directly below renders flat.
    sun.rotation_euler = mathutils.Euler((0.9 - phi * 0.5, 0.3, 0.6 + theta), "XYZ")


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


skel = bpy.data.collections.get("1: Skeletal system")
skeleton_names = [o.name for o in skel.all_objects if o.type == "MESH" and not o.name.endswith(".g")]

t0 = time.time()
count = 0
for plate in spec["plates"]:
    key = plate["key"]
    if key not in wanted:
        continue

    # ONE SIDE ONLY. These subjects are paired — a hand, a foot — and framing
    # both frames the gap between them, which is the whole body. The camera
    # would be metres back for a structure a centimetre across.
    all_objects = [n for s in plate["subjects"] for n in s["objects"]]
    suffix = side_of(all_objects)

    def restrict(names):
        if suffix is None:
            return names
        kept = [n for n in names if n.endswith(suffix) or not (n.endswith(".l") or n.endswith(".r"))]
        return kept or names

    subjects = []
    for s in plate["subjects"]:
        mesh = bake(restrict(s["objects"]), f"sub_{s['id']}")
        if mesh.vertices:
            subjects.append((s["id"], s["kind"], mesh))
        else:
            print(f"[warn] {s['id']}: empty bake", flush=True)
    if not subjects:
        continue

    frame_mesh = bake([n for s in plate["subjects"] for n in restrict(s["objects"])], f"frame_{key}")
    lo, hi = mesh_bbox(frame_mesh)

    # The skeleton minus every bone subject here, baked once: that is the part
    # of "everything else" that does not change from subject to subject.
    own = {n for sid, kind, _ in subjects for s in plate["subjects"] if s["id"] == sid and kind == "bone" for n in restrict(s["objects"])}
    backdrop = bake([n for n in skeleton_names if n not in own], f"backdrop_{key}")

    bone_count = sum(1 for _, k, _ in subjects if k == "bone")
    print(f"[plate] {key}: {len(subjects)} subjects ({bone_count} bone), "
          f"frame {max(hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]):.3f}", flush=True)

    for elev in elevations:
      for frame in views:
        frame_camera(lo, hi, frame * 15, a.margin, elev)

        # Elevation 0 keeps the plain view-NN name the other families use; any
        # other height gets its own leaf so both can ship side by side.
        leaf = f"view-{frame:02d}" if elev == 0 else f"view-{frame:02d}-e{elev:+03.0f}"

        # The plate: the skeleton as it is, with the subject muscles laid on it.
        clear()
        link(backdrop, f"plate_backdrop_{key}", BONE_MAT)
        for sid, kind, mesh in subjects:
            link(mesh, f"plate_{sid}", BONE_MAT if kind == "bone" else FLESH_MAT)
        render_to(os.path.join(a.out, key, f"{leaf}.png"))
        count += 1

        # One mask each, with the backdrop and every other subject held out.
        for sid, kind, mesh in subjects:
            clear()
            link(backdrop, f"occ_backdrop_{sid}", BONE_MAT, holdout=True)
            for other, okind, omesh in subjects:
                if other != sid:
                    link(omesh, f"occ_{other}", BONE_MAT, holdout=True)
            link(mesh, f"mask_{sid}", MASK_MAT)
            render_to(os.path.join(a.out, key, "masks", sid, f"{leaf}.png"))
            count += 1

        print(f"[masks] {key} {leaf}: {len(subjects)} masks "
              f"({count} renders, {time.time() - t0:.0f}s)", flush=True)

    for _, _, mesh in subjects:
        bpy.data.meshes.remove(mesh)
    bpy.data.meshes.remove(frame_mesh)
    bpy.data.meshes.remove(backdrop)

print(f"[complete] {count} renders -> {a.out}", flush=True)
