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

  context   the joint with every ligament of it in the resting blue — what a
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

# OUTLINES, ON THE STRAPS ONLY. A flat-shaded strap lying on a flat-shaded
# bone has no edge where the two meet, so even in a different colour its
# shape is hard to read — the user asked for an outline. Freestyle draws
# silhouette lines, and restricting it to a collection means the bones stay
# clean and only the ligaments get an edge. It is switched off for the mask
# render, where a line would widen the hotspot.
outline_coll = bpy.data.collections.new("lig_outlined")
scene.collection.children.link(outline_coll)
scene.render.use_freestyle = True
scene.render.line_thickness_mode = "ABSOLUTE"
scene.render.line_thickness = 2.2
_vl = scene.view_layers[0]
_vl.use_freestyle = True
_fs = _vl.freestyle_settings
_fs.use_culling = True
for _old in list(_fs.linesets):
    _fs.linesets.remove(_old)
_ls = _fs.linesets.new("straps")
_ls.select_silhouette = True
_ls.select_border = True
_ls.select_contour = True
_ls.select_crease = False
_ls.select_by_collection = True
_ls.collection = outline_coll
_ls.linestyle.color = (0.02, 0.05, 0.12)
_ls.linestyle.thickness = 2.2


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
# The two ligament colours. Each strap gets its own material instance built
# from these, because the fibre texture has to be aligned to that strap's own
# long axis — see fibre_mat.
REST_FILL, REST_LINE = (0.06, 0.24, 0.60, 1), (0.02, 0.08, 0.26, 1)
HILITE_FILL, HILITE_LINE = (0.0, 0.70, 0.95, 1), (0.0, 0.32, 0.50, 1)
HILITE_GLOW = ((0.0, 0.85, 1.0, 1), 0.5)


def fibre_axes(mesh):
    """The long, wide and thin directions of a strap, from its vertices.

    A ligament is drawn with lines running along it, and "along it" is not a
    world axis — the sacrotuberous runs diagonally, the annular ligament
    wraps a circle. Principal components of the vertex cloud give the strap's
    own frame: the first is its length, the second its width, the third its
    thickness. Stripes are then laid across the width, which makes them run
    along the length on the face a student is looking at.
    """
    import numpy as np
    pts = np.array([v.co[:] for v in mesh.vertices], dtype=float)
    if len(pts) < 3:
        return mathutils.Matrix.Identity(3)
    pts -= pts.mean(axis=0)
    _, _, vt = np.linalg.svd(pts, full_matrices=False)
    length, width = mathutils.Vector(vt[0]), mathutils.Vector(vt[1])
    thick = length.cross(width)
    # Rows of the mapping: texture X across the width, Y along the length, Z
    # through the thickness. Right-handed by construction.
    return mathutils.Matrix((width, length, thick))


def fibre_mat(name, fill, line, axes, glow=None):
    """Fill colour with fine darker lines running along the strap.

    The reference the user gave draws every ligament as a bundle of parallel
    fibres, and that is what makes it read as a ligament rather than a
    coloured patch. Blender's wave texture makes bands; a mapping node turns
    world coordinates into the strap's own frame so the bands lie across the
    width; a colour ramp sharpens them into lines; and a little distortion
    keeps them from looking ruled. The scale is in metres because the model
    is life-size, so 380 is a period of about 2.6 mm — about eight lines
    across a strap the width of the sacrotuberous, which is what the
    reference drawing has. Finer than that and they vanish at plate size.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.35

    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.vector_type = "POINT"
    mapping.inputs["Rotation"].default_value = axes.to_euler()

    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.wave_profile = "SIN"
    wave.inputs["Scale"].default_value = 380.0
    wave.inputs["Distortion"].default_value = 1.0
    wave.inputs["Detail"].default_value = 2.0
    wave.inputs["Detail Scale"].default_value = 2.0

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.36
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.64
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)

    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = line
    mix.inputs["B"].default_value = fill

    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])

    if glow:
        colour, strength = glow
        try:
            bsdf.inputs["Emission Color"].default_value = colour
            bsdf.inputs["Emission Strength"].default_value = strength
        except KeyError:
            pass
    return mat


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
    for coll in (scene.collection, outline_coll):
        for ob in list(coll.objects):
            if ob not in (cam, sun):
                coll.objects.unlink(ob)


def link(mesh, name, material, holdout=False, outlined=False):
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.clear()
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.material_index = 0
    ob.is_holdout = holdout
    (outline_coll if outlined else scene.collection).objects.link(ob)
    return ob


def render_to(path, outlines=True):
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    scene.render.use_freestyle = outlines
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


def expand(patterns):
    """Cutaway and ghost lists take wildcards, because "the hand" is thirty names.

    The sacrotuberous plate had the arm hanging through it — humerus, radius,
    ulna and every bone of the hand — and listing each one by name to remove
    it is how a spec becomes unreadable. "*of hand.l" and "*metacarpal*" say
    what was meant. Plain names still match exactly.
    """
    import fnmatch
    everything = [o.name for o in bpy.data.objects if o.type == "MESH"]
    out = set()
    for pat in patterns:
        if any(c in pat for c in "*?["):
            out.update(n for n in everything if fnmatch.fnmatch(n, pat))
        else:
            out.add(pat)
    return out


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
    drop = expand(entry.get("cutaway", []))
    ghost = expand(entry.get("ghost", []))

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

    # Each strap is its own object in the visible renders, because the fibre
    # lines have to follow that strap's own length. The combined bake above is
    # still what holds the mask out — one holdout is as good as twenty.
    strap_parts = []
    for n in others:
        m = bake([n], "strap_" + key + "_" + n)
        if m.vertices:
            strap_parts.append((n, m, fibre_mat("rest_" + n, REST_FILL, REST_LINE, fibre_axes(m))))
        else:
            bpy.data.meshes.remove(m)
    lig_axes = fibre_axes(lig_mesh)
    LIG_MAT = fibre_mat("rest_" + key, REST_FILL, REST_LINE, lig_axes)
    HILITE_MAT = fibre_mat("hilite_" + key, HILITE_FILL, HILITE_LINE, lig_axes, HILITE_GLOW)

    angles = entry.get("angles") or [entry["angle"]]
    for angle in angles:
      frame_camera(lo, hi, angle, entry.get("elevation", 0),
                   entry.get("margin", a.margin), entry.get("frame", a.min_frame))
      # A single-angle entry keeps the flat layout the preview packer reads;
      # a rotation set gets one folder per angle underneath it.
      leaf_dir = os.path.join(a.out, key) if len(angles) == 1 else os.path.join(a.out, key, "a%03d" % angle)

      span_mm = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1000
      note = (", cutaway " + str(len(drop)) + " bone(s)") if drop else ""
      note += (", ghosting " + str(len(ghost)) + " bone(s)") if ghost else ""
      print("[lig] " + key + ": " + format(span_mm, ".0f") + "mm across, angle "
            + str(angle) + note, flush=True)

      clear()
      link(bones, "ctx_bones_" + key, BONE_MAT)
      link(lig_mesh, "ctx_lig_" + key, LIG_MAT, outlined=True)
      for n, m, mat in strap_parts:
          link(m, "ctx_" + n, mat, outlined=True)
      if ghost_mesh:
          link(ghost_mesh, "ctx_ghost_" + key, GHOST_MAT)
      render_to(os.path.join(leaf_dir, "context.png"))

      clear()
      link(bones, "hl_bones_" + key, BONE_MAT)
      link(lig_mesh, "hl_lig_" + key, HILITE_MAT, outlined=True)
      for n, m, mat in strap_parts:
          link(m, "hl_" + n, mat, outlined=True)
      if ghost_mesh:
          link(ghost_mesh, "hl_ghost_" + key, GHOST_MAT)
      render_to(os.path.join(leaf_dir, "highlight.png"))

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
      render_to(os.path.join(leaf_dir, "mask.png"), outlines=False)

      count += 3
    bpy.data.meshes.remove(lig_mesh)
    bpy.data.meshes.remove(bones)
    if ghost_mesh:
        bpy.data.meshes.remove(ghost_mesh)
    if other_mesh:
        bpy.data.meshes.remove(other_mesh)
    for _, m, _ in strap_parts:
        bpy.data.meshes.remove(m)

print("[complete] " + str(count) + " renders -> " + a.out
      + " (" + format(time.time() - t0, ".0f") + "s)", flush=True)
