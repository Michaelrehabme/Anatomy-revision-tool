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
ap.add_argument("--fibres", action="store_true",
                help="draw straps with the striped fibre texture. Off by default: at "
                     "plate size its 2.6mm bands alias into moire and the user read "
                     "every ligament as a striped ribbon. Kept for comparison.")
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
sun.data.energy = 2.6
# A sun with some angular size casts soft-edged shadows, which is most of
# what separates a rendered bone from a painted one.
sun.data.angle = 0.35
scene.collection.objects.link(sun)

# A weaker fill from the other side, so the shadowed face of a bone is a
# darker ivory rather than a hole. The reference illustration is lit this way.
fill = bpy.data.objects.new("ligfill", bpy.data.lights.new("ligfill", type="SUN"))
fill.data.energy = 0.9
fill.data.angle = 0.6
scene.collection.objects.link(fill)

# Contact shadow where a strap meets bone, which is what makes it sit ON the
# bone rather than float. EEVEE has renamed this between versions; set
# whichever exists.
for attr, val in (("use_gtao", True), ("gtao_distance", 0.02), ("use_shadows", True),
                  ("use_fast_gi", True), ("fast_gi_distance", 0.03)):
    try:
        setattr(scene.eevee, attr, val)
    except (AttributeError, TypeError):
        pass

# OUTLINES, ON THE STRAPS ONLY. A flat-shaded strap lying on a flat-shaded
# bone has no edge where the two meet, so even in a different colour its
# shape is hard to read — the user asked for an outline. Freestyle draws
# silhouette lines, and restricting it to a collection means the bones stay
# clean and only the ligaments get an edge. It is switched off for the mask
# render, where a line would widen the hotspot.
outline_coll = bpy.data.collections.new("lig_outlined")
scene.collection.children.link(outline_coll)
bone_coll = bpy.data.collections.new("lig_bones")
scene.collection.children.link(bone_coll)
scene.render.use_freestyle = True
scene.render.line_thickness_mode = "ABSOLUTE"
scene.render.line_thickness = 1.8
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
_ls.linestyle.color = (0.10, 0.12, 0.28)
_ls.linestyle.thickness = 1.8

# A SECOND LINESET, FOR THE BONES. Flat ivory carpals sitting against flat
# ivory carpals read as one lump — the user could not tell one from the next,
# and on a wrist plate that is most of the picture. Shading alone cannot fix
# it, because the boundary between two touching bones of the same colour is
# not a shading event; it is an edge. Freestyle knows where those edges are.
#
# Deliberately quieter than the straps: thinner, and a warm grey rather than
# the straps' near-black, so the bones gain definition without competing with
# the ligaments that are the actual subject. `select_border` is what draws the
# seam where one bone overlaps another.
_bl = _fs.linesets.new("bones")
_bl.select_silhouette = True
_bl.select_border = True
_bl.select_contour = True
_bl.select_crease = True
_bl.select_by_collection = True
_bl.collection = bone_coll
_bl.linestyle.color = (0.42, 0.36, 0.28)
_bl.linestyle.thickness = 1.1


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


def bone_mat():
    """Warm ivory with a faint grain, instead of flat grey.

    The grey came from a neutral colour under a white world light and read
    as plastic. Real bone in an illustration is a warm ivory with a slightly
    mottled surface; a low-strength noise bump gives the light something to
    catch without turning into texture.
    """
    mat = principled("lig_bone", (0.93, 0.87, 0.74, 1), 0.55)
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 900.0
    noise.inputs["Detail"].default_value = 3.0
    noise.inputs["Roughness"].default_value = 0.6
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    bump.inputs["Distance"].default_value = 0.001
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    # A touch of colour variation so a large flat facet is not one tone.
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.88, 0.81, 0.66, 1)
    ramp.color_ramp.elements[1].color = (0.96, 0.92, 0.82, 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


BONE_MAT = bone_mat()
# The two ligament colours. Each strap gets its own material instance built
# from these, because the fibre texture has to be aligned to that strap's own
# long axis — see fibre_mat.
# The reference illustration draws ligaments as pale lavender-blue fibre
# bundles with dark lines and a white sheen, on ivory bone. The pale fill
# is readable there because of the lines, the outline and the ivory behind
# it, not because it is dark — so this is lighter than the last pass and
# leans on relief and lines instead.
REST_FILL, REST_LINE = (0.56, 0.62, 0.86, 1), (0.14, 0.18, 0.42, 1)
HILITE_FILL, HILITE_LINE = (0.0, 0.72, 0.95, 1), (0.0, 0.30, 0.48, 1)
HILITE_GLOW = ((0.0, 0.85, 1.0, 1), 0.8)
# THE OTHER STRAPS ON A HIGHLIGHT PLATE. Every strap used to be the same
# lavender-blue with the target only a slightly brighter teal, so on a busy
# wrist the answer barely stood out. On the highlight render only, the
# neighbours drop to a quiet grey-lavender; the context render keeps them all
# alike, because a locate question must not give the target away.
REST_MUTED_FILL, REST_MUTED_LINE = (0.78, 0.78, 0.84, 1), (0.45, 0.46, 0.55, 1)


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


def flat_strap_mat(name, fill, glow=None):
    """A strap in one colour with a soft sheen, no stripes.

    The fibre texture below was meant to read as a bundle of fibres, and at
    1600px on a desktop it does. Shown at phone size its 2.6mm bands fall
    below a pixel, alias into moire, and every ligament became a striped
    ribbon whose shape was hard to read. The outline (Freestyle, on the strap
    collection) carries the shape; the fill only has to say which strap is
    which.
    """
    mat = principled(name, fill, 0.6)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    try:
        bsdf.inputs["Coat Weight"].default_value = 0.2
        bsdf.inputs["Coat Roughness"].default_value = 0.35
    except KeyError:
        pass
    if glow:
        colour, strength = glow
        try:
            bsdf.inputs["Emission Color"].default_value = colour
            bsdf.inputs["Emission Strength"].default_value = strength
        except KeyError:
            pass
    return mat


def strap_mat(name, fill, line, axes, glow=None):
    """The strap material this run draws with: flat unless --fibres."""
    return fibre_mat(name, fill, line, axes, glow) if a.fibres else flat_strap_mat(name, fill, glow)


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
    bsdf.inputs["Roughness"].default_value = 0.42

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

    # The same bands as relief, so the fibres catch the light as ridges and
    # the strap stops being a flat decal. This is the single biggest step
    # towards the painted look.
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.45
    bump.inputs["Distance"].default_value = 0.0008
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    # A glossy coat gives the white sheen the illustration paints along
    # every bundle.
    try:
        bsdf.inputs["Coat Weight"].default_value = 0.35
        bsdf.inputs["Coat Roughness"].default_value = 0.25
    except KeyError:
        pass

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
    mat = principled("lig_ghost", (0.93, 0.87, 0.74, 1), 0.4)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    # 0.45, not 0.22: at 0.22 a ghosted femur behind the ACL read as a bone
    # that had failed to render. It is linked into the bone collection too,
    # so it gets the bones' outline and keeps its shape.
    bsdf.inputs["Alpha"].default_value = 0.45
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


def smooth(mesh):
    for poly in mesh.polygons:
        poly.use_smooth = True
    return mesh


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


def frame_size(span, margin, min_frame, max_frame=None):
    """The wider of "a bit more than the ligament" and "enough to hold the
    joint" (see --min-frame), no wider than max_frame when one is given.

    Without a ceiling every ligament of an area was framed at the area's full
    size, so an 11mm acromioclavicular ligament was a sliver on a 240mm
    shoulder. With a spec that gives both, a small ligament is framed at
    minFrame (still enough to orient) and a long one grows up to frame.
    """
    size = max(span * margin, min_frame)
    return min(size, max_frame) if max_frame else size


def frame_camera(lo, hi, angle_deg, elevation_deg, margin, min_frame, max_frame=None):
    centre = mathutils.Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
    span = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    size = frame_size(span, margin, min_frame, max_frame)
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
    fill.rotation_euler = mathutils.Euler((1.1, -0.4, theta - 1.8), "XYZ")


def id_colour(i):
    """Index 1..255 as a flat colour, decodable from the PNG.

    Red carries the low four bits and green the high four, each at sixteen
    evenly spaced LINEAR levels. The Standard view transform writes them
    through the plain sRGB curve, so the packer inverts that curve and rounds
    to the nearest level. Anti-aliased edge pixels land between levels and
    decode to a neighbour's index; the tracer's minimum-component filter
    drops those specks.
    """
    return ((i % 16) / 15.0, (i // 16) / 15.0, 0.0, 1.0)


def flat_emission(name, colour):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = colour
    em.inputs[1].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


BLACK_MAT = flat_emission("lig_id_black", (0, 0, 0, 1))


def render_ids(path, bones_mesh, parts):
    """One render where every strap is its own colour, so a click on the
    wrong ligament can be named. parts: list of (index, mesh)."""
    clear()
    link(bones_mesh, "id_bones", BLACK_MAT)
    for idx, m in parts:
        link(m, "id_%d" % idx, flat_emission("lig_id_%d" % idx, id_colour(idx)), soften=True)
    saved = (scene.view_settings.view_transform, scene.view_settings.look,
             scene.eevee.taa_render_samples, scene.render.dither_intensity, _bg.inputs[1].default_value if _bg else None)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.eevee.taa_render_samples = 1
    scene.render.dither_intensity = 0.0
    if _bg:
        _bg.inputs[1].default_value = 0.0
    try:
        render_to(path, outlines=False)
    finally:
        scene.view_settings.view_transform, scene.view_settings.look = saved[0], saved[1]
        scene.eevee.taa_render_samples = saved[2]
        scene.render.dither_intensity = saved[3]
        if _bg and saved[4] is not None:
            _bg.inputs[1].default_value = saved[4]


def clear():
    for coll in (scene.collection, outline_coll, bone_coll):
        for ob in list(coll.objects):
            if ob not in (cam, sun):
                coll.objects.unlink(ob)


def link(mesh, name, material, holdout=False, outlined=False, soften=False, boned=False):
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.clear()
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.material_index = 0
    ob.is_holdout = holdout
    if soften:
        soften_strap(ob)
    (outline_coll if outlined else bone_coll if boned else scene.collection).objects.link(ob)
    return ob


def soften_strap(ob):
    """Makes a Z-Anatomy ligament look like a band rather than a cut-out.

    The atlas models every ligament as a thin, low-polygon sheet: a handful
    of flat facets with hard corners, which the user read as "geometric". On
    a strap that is not a modelling choice, it is a budget. Three modifiers
    undo it without touching the source: smooth shading so the facets stop
    catching the light one at a time, a little solidify so the sheet has an
    edge to round, and two levels of subdivision so the corners of the
    outline and the edge itself go soft. The mask render uses the same
    object, so the hotspot is traced from the softened shape it shows.
    """
    for poly in ob.data.polygons:
        poly.use_smooth = True
    solid = ob.modifiers.new("thickness", "SOLIDIFY")
    solid.thickness = 0.0009
    solid.offset = 0.0
    sub = ob.modifiers.new("soften", "SUBSURF")
    # One level, not two: two on a 0.9mm solidified sheet rippled the edge.
    sub.levels = 1
    sub.render_levels = 1


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
    # KEEP IS THE INVERSE OF CUTAWAY, and it exists because the frames got
    # wider. Framing a wrist tightly enough to hide the rest of the body was
    # the thing that made it unreadable — the user could not tell which side
    # of the wrist they were looking at. Framed wide enough to orient, the arm
    # hangs beside the hip and the femur walks into shot. Naming the twenty
    # bones of a hand to keep is shorter and far more stable than naming the
    # two hundred to drop.
    keep = expand(entry.get("keep", [])) if entry.get("keep") else None
    # A keep pattern that names nothing drops those bones with no error —
    # "Sternum*" matched nothing for a whole tranche, because the atlas names
    # them "Manubrium of sternum" and "Body of sternum". Say so.
    if entry.get("keep"):
        import fnmatch
        for pat in entry["keep"]:
            if not any(fnmatch.fnmatch(n, pat) for n in skeleton_names):
                print("[warn] " + key + ": keep pattern '" + pat + "' matches no bone", flush=True)

    lig_mesh = bake(lig_names, "lig_" + key)
    if not lig_mesh.vertices:
        print("[warn] " + key + ": empty bake, skipped", flush=True)
        continue
    lo, hi = mesh_bbox(lig_mesh)

    # The bones, minus anything the spec cuts away. The ligament itself is baked
    # separately so it can be recoloured between the three renders.
    solid_names = [n for n in skeleton_names
                   if n not in drop and n not in ghost and n not in lig_names
                   and (keep is None or n in keep)]
    bones = smooth(bake(solid_names, "ligbones_" + key))
    ghost_mesh = smooth(bake([n for n in ghost if n not in lig_names], "ligghost_" + key)) if ghost else None

    centre = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
    span = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    # A spec with minFrame treats frame as the CEILING and minFrame as the
    # floor (ligamentFraming.ts); an older spec with frame alone keeps frame
    # as the floor, as it always was.
    floor_m = entry.get("minFrame", entry.get("frame", a.min_frame))
    ceiling_m = entry.get("frame") if "minFrame" in entry else None
    frame = frame_size(span, entry.get("margin", a.margin), floor_m, ceiling_m)
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
            axes = fibre_axes(m)
            strap_parts.append((n, m, strap_mat("rest_" + n, REST_FILL, REST_LINE, axes),
                                strap_mat("muted_" + n, REST_MUTED_FILL, REST_MUTED_LINE, axes)))
        else:
            bpy.data.meshes.remove(m)
    lig_axes = fibre_axes(lig_mesh)
    LIG_MAT = strap_mat("rest_" + key, REST_FILL, REST_LINE, lig_axes)
    HILITE_MAT = strap_mat("hilite_" + key, HILITE_FILL, HILITE_LINE, lig_axes, HILITE_GLOW)

    angles = entry.get("angles") or [entry["angle"]]
    for angle in angles:
      frame_camera(lo, hi, angle, entry.get("elevation", 0),
                   entry.get("margin", a.margin), floor_m, ceiling_m)
      # A single-angle entry keeps the flat layout the preview packer reads;
      # a rotation set gets one folder per angle underneath it.
      leaf_dir = os.path.join(a.out, key) if len(angles) == 1 else os.path.join(a.out, key, "a%03d" % angle)

      span_mm = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1000
      note = (", cutaway " + str(len(drop)) + " bone(s)") if drop else ""
      note += (", keeping " + str(len(solid_names)) + " bone(s)") if keep is not None else ""
      note += (", ghosting " + str(len(ghost)) + " bone(s)") if ghost else ""
      print("[lig] " + key + ": " + format(span_mm, ".0f") + "mm across, angle "
            + str(angle) + note, flush=True)

      clear()
      link(bones, "ctx_bones_" + key, BONE_MAT, boned=True)
      link(lig_mesh, "ctx_lig_" + key, LIG_MAT, outlined=True, soften=True)
      for n, m, mat, _muted in strap_parts:
          link(m, "ctx_" + n, mat, outlined=True, soften=True)
      if ghost_mesh:
          link(ghost_mesh, "ctx_ghost_" + key, GHOST_MAT, boned=True)
      render_to(os.path.join(leaf_dir, "context.png"))

      clear()
      link(bones, "hl_bones_" + key, BONE_MAT, boned=True)
      link(lig_mesh, "hl_lig_" + key, HILITE_MAT, outlined=True, soften=True)
      for n, m, _rest, muted in strap_parts:
          link(m, "hl_" + n, muted, outlined=True, soften=True)
      if ghost_mesh:
          link(ghost_mesh, "hl_ghost_" + key, GHOST_MAT, boned=True)
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
          link(other_mesh, "msk_others_" + key, BONE_MAT, holdout=True, soften=True)
      link(lig_mesh, "msk_lig_" + key, MASK_MAT, soften=True)
      render_to(os.path.join(leaf_dir, "mask.png"), outlines=False)

      # The ID pass, with a legend the packer reads back. The target is index
      # 1; the neighbours follow in the order they were baked.
      parts = [(1, lig_mesh)] + [(i + 2, m) for i, (n, m, _, _) in enumerate(strap_parts)]
      render_ids(os.path.join(leaf_dir, "ids.png"), bones, parts)
      with open(os.path.join(leaf_dir, "ids.json"), "w") as f:
          json.dump({"1": entry.get("name", key)} | {str(i + 2): n for i, (n, _, _, _) in enumerate(strap_parts)}, f)

      count += 4
    bpy.data.meshes.remove(lig_mesh)
    bpy.data.meshes.remove(bones)
    if ghost_mesh:
        bpy.data.meshes.remove(ghost_mesh)
    if other_mesh:
        bpy.data.meshes.remove(other_mesh)
    for _, m, _, _ in strap_parts:
        bpy.data.meshes.remove(m)

print("[complete] " + str(count) + " renders -> " + a.out
      + " (" + format(time.time() - t0, ".0f") + "s)", flush=True)
