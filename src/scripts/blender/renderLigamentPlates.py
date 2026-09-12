"""Renders a joint framed on one ligament, for locate and identify questions.

A ligament plate is not a muscle plate. A muscle is laid ON the skeleton and
read against it; a ligament is usually BETWEEN two bones, and at any framing
wide enough to show a whole bone it is a few pixels of nothing. So the camera
frames the ligament itself and lets the bones run out of shot, which is how an
atlas draws one too.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderLigamentPlates.py -- \
      --spec ligament-preview.spec.json --out renders/ligaments

THREE RENDERS PER LIGAMENT, because the two question types need different
pictures from the same camera:

  context   the joint as it looks, ligament in its own pearly white — what a
            locate question shows before the student clicks
  highlight the same frame with the ligament picked out — the identify
            question's stimulus, and the locate question's answer
  mask      the ligament alone in white on transparent, to trace the hotspot

CUTAWAY. Some ligaments are behind a bone from every angle: the cruciates
behind the femoral condyles, the interosseous ligaments between carpal bones by
definition. checkLigamentVisibility.py says which. The fix is the same holdout
trick the plates already use, aimed the other way — instead of holding a bone
out of the MASK, drop it from the picture entirely, which is what a dissection
photograph does. A spec entry names the bones — or ligaments — to drop.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--spec", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1600)
ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--margin", type=float, default=2.6,
                help="how much bone to keep around the ligament; a ligament with "
                     "no context is unanswerable, so this is deliberately loose")
ap.add_argument("--min-frame", type=float, default=0.10,
                help="smallest frame in metres. A multiple of the ligament alone is "
                     "not enough: the anterior talofibular is 11mm, and 11mm of "
                     "context is a featureless crop of the talus with no ankle in "
                     "it. The frame has to hold the JOINT, whose size does not "
                     "shrink with the ligament's.")
a = ap.parse_args(argv)

spec = json.load(open(a.spec))

scene = bpy.data.scenes.new("LigScene")
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

scene.world = bpy.data.worlds.new("LigWorld")
scene.world.use_nodes = True
_bg = scene.world.node_tree.nodes.get("Background")
if _bg:
    _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    _bg.inputs[1].default_value = 0.55

cam_data = bpy.data.cameras.new("ligcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("ligcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun = bpy.data.objects.new("ligsun", bpy.data.lights.new("ligsun", type="SUN"))
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
    mat = bpy.data.materials.new("lig_mask")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (1, 1, 1, 1)
    em.inputs[1].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


BONE_MAT = principled("lig_bone", (0.90, 0.88, 0.83, 1), 0.6)
# A ligament in a dissection is pearly white with a cool cast, so the resting
# colour says "ligament, not bone" without answering the question. It has to
# differ from bone: every ligament of the joint is drawn in it, and the student
# has to be able to tell the straps from the bones to pick between them.
LIG_MAT = principled("lig_rest", (0.80, 0.86, 0.90, 1), 0.2)


def highlight_mat():
    """The answer colour, and it has to survive the lighting.

    The first pass used a teal base colour and it came out of the render as a
    pale grey-green — the white world light that keeps the bone readable
    washes a mid-saturation colour to nothing. So the highlight is a deep
    saturated blue-teal AND glows a little on its own, which the light cannot
    dilute. Muscles own the red; a plain blue was the colour that vanished
    into bone and background on the muscle panels; this is neither.
    """
    mat = principled("lig_hilite", (0.0, 0.36, 0.50, 1), 0.3)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    try:
        bsdf.inputs["Emission Color"].default_value = (0.0, 0.55, 0.72, 1)
        bsdf.inputs["Emission Strength"].default_value = 0.35
    except KeyError:
        pass
    return mat


HILITE_MAT = highlight_mat()
MASK_MAT = flat_white()


def ghost_mat():
    """A bone you can see through, for the ligaments no cutaway can reach.

    Dropping whole bones is too blunt for an intracapsular ligament. The ACL
    sits behind the femoral condyles, and "remove the femur" is not an option —
    the femur is half the answer to what the ACL attaches to. Removing the
    patella and fibula, which is everything else in front, still leaves a
    sliver: the condyles do the hiding.

    Ghosting is what an atlas does instead. The femur stays, keeps its shape
    and its relationship to the ligament, and the student sees through it.
    """
    mat = principled("lig_ghost", (0.90, 0.88, 0.83, 1), 0.4)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Alpha"].default_value = 0.22
    try:
        mat.blend_method = "BLEND"
    except (AttributeError, TypeError):
        pass
    try:
        mat.show_transparent_back = False
    except AttributeError:
        pass
    return mat


GHOST_MAT = ghost_mat()


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


def frame_camera(lo, hi, angle_deg, elevation_deg, margin, min_frame):
    centre = mathutils.Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
    span = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    # The frame is the wider of "a bit more than the ligament" and "enough to
    # hold the joint" — see --min-frame.
    size = max(span * margin, min_frame)
    dist = size * 8 + 0.5
    theta = math.radians(angle_deg)
    phi = math.radians(elevation_deg)
    offset = mathutils.Vector((-dist * math.sin(theta) * math.cos(phi),
                               -dist * math.cos(theta) * math.cos(phi),
                               dist * math.sin(phi)))
    cam.location = centre + offset
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = size
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

# THE OTHER LIGAMENTS OF THE JOINT GO IN THE PICTURE. The first preview drew
# the target alone, and the flaw was obvious on the page: a locate question
# with one pale strap on it is answered by finding the strap. A real plate
# has every ligament of the joint on it, so the student has to know which one
# the anterior talofibular is. So the frame is swept for the other straps and
# they are drawn in the resting colour.
STRAP = ("ligament", "retinaculum", "labrum", "meniscus", "membrane")
NOT_STRAP = ("capsule", "cavity", "synovial", "bursa", "cartilage")
joints = bpy.data.collections.get("3: Joints")
strap_objects = [
    o for o in (joints.all_objects if joints else [])
    if o.type == "MESH" and not o.name.endswith((".i", ".j", ".g")) and o.data.vertices
    and any(w in o.name.lower() for w in STRAP) and not any(w in o.name.lower() for w in NOT_STRAP)
]


def straps_in_frame(centre, size, exclude):
    """Every other strap whose bounding box overlaps the camera's cube."""
    half = size / 2
    found = []
    for o in strap_objects:
        if o.name in exclude:
            continue
        mat = o.matrix_world
        pts = [mat @ mathutils.Vector(c) for c in o.bound_box]
        lo = [min(p[i] for p in pts) for i in range(3)]
        hi = [max(p[i] for p in pts) for i in range(3)]
        if all(lo[i] <= centre[i] + half and hi[i] >= centre[i] - half for i in range(3)):
            found.append(o.name)
    return found

t0 = time.time()
count = 0
for entry in spec["ligaments"]:
    key = entry["key"]
    lig_names = entry["objects"]
    drop = set(entry.get("cutaway", []))
    ghost = set(entry.get("ghost", []))

    lig_mesh = bake(lig_names, "lig_" + key)
    if not lig_mesh.vertices:
        print("[warn] " + key + ": empty bake, skipped", flush=True)
        continue
    lo, hi = mesh_bbox(lig_mesh)

    # The bones, minus anything the spec cuts away. The ligament itself is baked
    # separately so it can be recoloured between the three renders.
    solid_names = [n for n in skeleton_names
                   if n not in drop and n not in ghost and n not in lig_names]
    bones = bake(solid_names, "ligbones_" + key)
    ghost_mesh = bake([n for n in ghost if n not in lig_names], "ligghost_" + key) if ghost else None

    centre = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
    span = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    frame = max(span * entry.get("margin", a.margin), entry.get("frame", a.min_frame))
    # A cutaway or ghost list can name ligaments too — the patellar ligament is
    # as much in front of the ACL as the patella is.
    others = [n for n in straps_in_frame(centre, frame, set(lig_names) | drop | ghost)]
    other_mesh = bake(others, "ligothers_" + key) if others else None
    if others:
        print("[straps] " + key + ": " + ", ".join(sorted(others)), flush=True)

    frame_camera(lo, hi, entry["angle"], entry.get("elevation", 0),
                 entry.get("margin", a.margin), entry.get("frame", a.min_frame))

    span_mm = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1000
    note = (", cutaway " + str(len(drop)) + " bone(s)") if drop else ""
    note += (", ghosting " + str(len(ghost)) + " bone(s)") if ghost else ""
    print("[lig] " + key + ": " + format(span_mm, ".0f") + "mm across, angle "
          + str(entry["angle"]) + note, flush=True)

    clear()
    link(bones, "ctx_bones_" + key, BONE_MAT)
    link(lig_mesh, "ctx_lig_" + key, LIG_MAT)
    if other_mesh:
        link(other_mesh, "ctx_others_" + key, LIG_MAT)
    if ghost_mesh:
        link(ghost_mesh, "ctx_ghost_" + key, GHOST_MAT)
    render_to(os.path.join(a.out, key, "context.png"))

    clear()
    link(bones, "hl_bones_" + key, BONE_MAT)
    link(lig_mesh, "hl_lig_" + key, HILITE_MAT)
    if other_mesh:
        link(other_mesh, "hl_others_" + key, LIG_MAT)
    if ghost_mesh:
        link(ghost_mesh, "hl_ghost_" + key, GHOST_MAT)
    render_to(os.path.join(a.out, key, "highlight.png"))

    # The mask holds the bones out rather than hiding them, so a ligament that
    # disappears behind a condyle is missing from the hotspot too — the target
    # can only ever be the part a student can actually see and click.
    # A GHOSTED BONE IS DELIBERATELY NOT A HOLDOUT. Only the solid bones hide
    # the ligament, so only they cut the hotspot. A student can see the ACL
    # through a ghosted femur, so they must be able to click it there too — if
    # the femur held the mask out, the picture would show a target the hit test
    # would then reject.
    clear()
    link(bones, "msk_bones_" + key, BONE_MAT, holdout=True)
    if other_mesh:
        link(other_mesh, "msk_others_" + key, BONE_MAT, holdout=True)
    link(lig_mesh, "msk_lig_" + key, MASK_MAT)
    render_to(os.path.join(a.out, key, "mask.png"))

    count += 3
    bpy.data.meshes.remove(lig_mesh)
    bpy.data.meshes.remove(bones)
    if ghost_mesh:
        bpy.data.meshes.remove(ghost_mesh)
    if other_mesh:
        bpy.data.meshes.remove(other_mesh)

print("[complete] " + str(count) + " renders -> " + a.out
      + " (" + format(time.time() - t0, ".0f") + "s)", flush=True)
