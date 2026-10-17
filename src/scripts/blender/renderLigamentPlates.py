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

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import boneLook  # noqa: E402

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
ap.add_argument("--atlas-shapes", action="store_true",
                help="draw every ligament as the atlas models it, ignoring ligament-bands.json")
ap.add_argument("--fibres", action="store_true",
                help="draw straps with the striped fibre texture. Off by default: at "
                     "plate size its 2.6mm bands alias into moire and the user read "
                     "every ligament as a striped ribbon. Kept for comparison.")
ap.add_argument("--look", default="studio", choices=["flat", "studio"],
                help="studio (default) is the landmark plates' look: a dim world, a key "
                     "light aimed from the camera, occlusion in the hollows and an inked "
                     "line pass. flat is the old evenly lit look.")
ap.add_argument("--skip-existing", action="store_true",
                help="skip an angle whose ids.json (the last file each angle writes) "
                     "already exists, so an interrupted run resumes where it stopped")
a = ap.parse_args(argv)

# The wrist and hand ligaments the atlas models as cut-outs, redrawn as bands
# bone to bone (ligament-bands.json; build_bands below). Read from the repo
# this script lives in, so a worktree renders its own table.
_BANDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "ligament-bands.json")
BAND_TABLE = {}
if not a.atlas_shapes and os.path.exists(_BANDS_FILE):
    with open(_BANDS_FILE, encoding="utf-8") as _f:
        BAND_TABLE = {k: v["bands"] for k, v in json.load(_f)["ligaments"].items()}
STUDIO = a.look == "studio"

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
    # THE AMBIENT LIGHT FLATTENED THE BONES, as it did on the landmark plates
    # before them: a white world at 0.55 lit every face from every side, so
    # the bones read as one pale grey. Relief comes from a dim world and a key
    # light raking across the surface. See renderLandmarkMarkers.py.
    _bg.inputs[1].default_value = 0.12 if STUDIO else 0.55

cam_data = bpy.data.cameras.new("ligcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("ligcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun = bpy.data.objects.new("ligsun", bpy.data.lights.new("ligsun", type="SUN"))
sun.data.energy = 4.0 if STUDIO else 2.6
# A sun with some angular size casts soft-edged shadows, which is most of
# what separates a rendered bone from a painted one.
sun.data.angle = 0.35
scene.collection.objects.link(sun)

# A weaker fill from the other side, so the shadowed face of a bone is a
# darker ivory rather than a hole. The reference illustration is lit this way.
fill = bpy.data.objects.new("ligfill", bpy.data.lights.new("ligfill", type="SUN"))
fill.data.energy = 0.6 if STUDIO else 0.9
fill.data.angle = 0.6
if STUDIO:
    fill.data.use_shadow = False
    sun.data.angle = math.radians(12)   # a soft-edged shadow, not a hard cut-out

# Where the light travels in the CAMERA's own axes (x right, y up, -z away from
# the lens): the key over the viewer's left shoulder, the convention of every
# anatomical plate, and a fill lifting the shadow side from the lower right.
# Fixed to the camera rather than the world, so every one of the eight angles
# is lit the same way instead of the back view being lit flat from the front.
KEY_DIR = (0.62, -0.62, -0.48)
FILL_DIR = (-0.75, 0.25, -0.6)


def aim_lights():
    q = cam.rotation_euler.to_quaternion()
    for ob, d in ((sun, KEY_DIR), (fill, FILL_DIR)):
        ob.rotation_euler = (q @ mathutils.Vector(d)).to_track_quat("-Z", "Y").to_euler()


if STUDIO:
    # AgX rolls highlights off, and a bone is nearly all highlight. Standard
    # keeps the light-to-shadow range the lights make.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    # THE LINE PASS, as on the landmark plates: Workbench, unlit and white,
    # draws only the silhouette, the step in depth where one bone passes in
    # front of another, and the creases. Multiplied over the lit render it
    # separates two pale bones that no lighting can.
    _sh = scene.display.shading
    _sh.light = "FLAT"
    _sh.color_type = "SINGLE"
    _sh.single_color = (1, 1, 1)
    _sh.show_cavity = True
    _sh.cavity_type = "BOTH"
    _sh.cavity_ridge_factor = 0.0
    _sh.cavity_valley_factor = 2.0
    _sh.curvature_ridge_factor = 0.0
    _sh.curvature_valley_factor = 1.6
    _sh.show_shadows = False
    _sh.show_object_outline = True
    _sh.object_outline_color = (0.16, 0.13, 0.11)
    scene.display.render_aa = "16"
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
# In the studio look the Workbench line pass inks the bones, the way the
# landmark plates do; this lineset on top of it drew stray ticks at every
# small crease of the now smooth-shaded mesh.
_bl.show_render = not STUDIO


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


def studio_bone_mat():
    """The landmark plates' bone: a pale warm ivory with ambient occlusion
    multiplied into its colour, which is what separates a fossa's rim from its
    floor and one carpal from the next."""
    mat = principled("lig_bone_studio", (0.90, 0.88, 0.83, 1), 0.5)
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 16
    ao.inputs["Distance"].default_value = 0.02
    ao.inputs["Color"].default_value = (0.80, 0.76, 0.68, 1)
    gamma = nt.nodes.new("ShaderNodeGamma")
    gamma.inputs["Gamma"].default_value = 3.0
    nt.links.new(ao.outputs["Color"], gamma.inputs["Color"])
    nt.links.new(gamma.outputs["Color"], bsdf.inputs["Base Color"])
    mat.diffuse_color = (0.90, 0.87, 0.80, 1)   # what Workbench draws
    return mat


BONE_MAT = studio_bone_mat() if STUDIO else bone_mat()
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


_ATTACH = None


def fibre_axes(mesh, name=None):
    """The fibre direction for a strap: along a drawn band ("uv"), from one
    bone attachment to the other for an atlas ligament that touches two, and
    the long axis of its vertices only when neither is known.

    The owner, 17 Oct 2026: "all ligaments & images need the fibres running in
    the correct direction". The long axis is right for a strap like the
    sacrotuberous but wrong for a short wide one, whose longest side runs
    ACROSS its fibres; a ligament's fibres run from bone to bone.
    """
    if mesh.uv_layers.get("fibres"):
        return "uv"
    axis = attachment_axis(mesh, name) if name else None
    return axis or long_axes(mesh)


def attachment_axis(mesh, name):
    global _ATTACH
    if _ATTACH is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "ligament-attachments.json")
        try:
            with open(path, encoding="utf-8") as f:
                _ATTACH = {x["ligament"]: [t["bone"] for t in x["attachments"]] for x in json.load(f)["ligaments"]}
        except OSError:
            _ATTACH = {}
    bones_of = _ATTACH.get(name, [])
    if len(bones_of) < 2 or len(mesh.vertices) < 3:
        return None
    from mathutils.bvhtree import BVHTree
    trees = []
    for bone in bones_of[:2]:
        m = bake_raw([bone], "axisbone_" + bone)
        if not m.vertices:
            bpy.data.meshes.remove(m)
            return None
        trees.append(BVHTree.FromPolygons([v.co.copy() for v in m.vertices], [p.vertices[:] for p in m.polygons]))
        bpy.data.meshes.remove(m)
    near = ([], [])
    for v in mesh.vertices:
        d = [t.find_nearest(v.co)[3] or 1.0 for t in trees]
        near[0 if d[0] < d[1] else 1].append(v.co.copy())
    if not near[0] or not near[1]:
        return None
    ca = sum(near[0], mathutils.Vector()) / len(near[0])
    cb = sum(near[1], mathutils.Vector()) / len(near[1])
    length = cb - ca
    if length.length < 1e-4:
        return None
    length.normalize()
    pca = long_axes(mesh)
    width = pca[2].cross(length)
    if width.length < 1e-6:
        width = pca[0] - length * pca[0].dot(length)
    width.normalize()
    thick = length.cross(width)
    return mathutils.Matrix((width, length, thick))


def long_axes(mesh):
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
    by_uv = axes == "uv"
    if not by_uv:
        mapping.inputs["Rotation"].default_value = axes.to_euler()

    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.wave_profile = "SIN"
    # A drawn band's u runs 0-1 across it: twelve fibres side by side.
    wave.inputs["Scale"].default_value = 12.0 if by_uv else 380.0
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
    # The lines are a hint of fibre, not stripes: at full contrast they
    # aliased into moire at phone size (see flat_strap_mat). A fifth of the
    # way to the line colour reads as grain and survives being shrunk.
    mix.inputs["A"].default_value = tuple(f + (l - f) * 0.22 for f, l in zip(fill, line))
    mix.inputs["B"].default_value = fill

    if by_uv:
        uvmap = nt.nodes.new("ShaderNodeUVMap")
        uvmap.uv_map = "fibres"
        nt.links.new(uvmap.outputs["UV"], mapping.inputs["Vector"])
    else:
        nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])

    # The same bands as relief, so the fibres catch the light as ridges and
    # the strap stops being a flat decal. This is the single biggest step
    # towards the painted look.
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
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


def ghost_strap_mat():
    """A strap you can see through, for a ligament under other ligaments.

    Ghosting the carpal bones was not enough for the interosseous ligaments
    of the wrist: the radiocarpal and radiate straps lie over the whole carpus,
    hid the target on all eight angles, and as solid neighbours they held it
    out of its mask too. A spec entry that gives solidStraps keeps only the
    straps matching those patterns solid; every other strap in the frame is
    drawn in this material and, like a ghosted bone, cuts nothing from the
    hotspot and takes no taps of its own.
    """
    mat = principled("lig_ghost_strap", REST_MUTED_FILL, 0.6)
    mat.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.22
    try:
        mat.blend_method = "BLEND"
    except (AttributeError, TypeError):
        pass
    try:
        mat.show_transparent_back = False
    except AttributeError:
        pass
    return mat


GHOST_STRAP_MAT = ghost_strap_mat()


def smooth(mesh):
    for poly in mesh.polygons:
        poly.use_smooth = True
    return mesh


def skinned_copy(src):
    """The mesh a faceless strap's own modifiers make of it.

    The intertransverse ligaments are modelled as 26 bare edges with a Skin
    modifier: no faces at all until the modifier runs. Copying the raw data, as
    bake does for everything else, gave an empty picture and a 0.000% mask —
    the ligament was never buried, it was never drawn. Only a mesh with no
    faces takes this path, and only when it is the TARGET (skin=True): a
    faceless neighbour stays undrawn, as it always was, so no published plate
    changes if it is re-rendered.
    """
    was_hidden = src.hide_viewport
    src.hide_viewport = False
    scene.collection.objects.link(src)
    try:
        deps = bpy.context.evaluated_depsgraph_get()
        deps.update()
        return bpy.data.meshes.new_from_object(src.evaluated_get(deps))
    finally:
        scene.collection.objects.unlink(src)
        src.hide_viewport = was_hidden


def bake(names, mesh_name, skin=False):
    """bake_raw, except that a ligament in BAND_TABLE comes out as its bands."""
    banded = [n for n in names if n in BAND_TABLE]
    if not banded:
        return bake_raw(names, mesh_name, skin)
    bm = bmesh.new()
    plain = [n for n in names if n not in BAND_TABLE]
    if plain:
        m = bake_raw(plain, mesh_name + "_plain", skin)
        bm.from_mesh(m)
        bpy.data.meshes.remove(m)
    for n in banded:
        cut = bake_raw([n], "cut_" + n, skin)
        if cut.vertices:
            m = build_bands(BAND_TABLE[n], cut, "bands_" + n)
            bm.from_mesh(m)
            bpy.data.meshes.remove(m)
        bpy.data.meshes.remove(cut)
    mesh = bpy.data.meshes.new(mesh_name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def bake_raw(names, mesh_name, skin=False):
    bm = bmesh.new()
    for n in names:
        src = bpy.data.objects.get(n)
        if not src or src.type != "MESH":
            continue
        tmp = skinned_copy(src) if (skin and not src.data.polygons and src.modifiers) else src.data.copy()
        mat = src.matrix_world
        for v in tmp.vertices:
            v.co = mat @ v.co
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    mesh = bpy.data.meshes.new(mesh_name)
    if STUDIO:
        # The .l meshes are mirrored copies with their normals pointing inward;
        # lit properly, half the skeleton would shade inside-out.
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    if STUDIO:
        # Smooth, but keep a real edge an edge: flat-shaded, the atlas's few
        # hundred faces per bone read as anatomy that is not there.
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
        mesh.set_sharp_from_angle(angle=math.radians(50))
    return mesh


_BAND_TREES = {}


def anatomical(rows, mids, across, up, width, shape, cord, seed_text):
    """Takes the geometry out of a band (owner, 17 Oct 2026: "a ligament is
    unlikely to be a perfect rectangle from attachment A to B").

    A real ligament fans out into each bone and is narrowest between them, is
    thicker along its middle than at its edges, and is never ruled straight:
    so the width flares towards both attachments, the cross-section is domed,
    the outline wanders a little, and a free cord arches slightly off the
    joint. The wander is seeded by the band's own name, so a ligament looks the
    same in every frame and every run.

    `shape` is the ligament's own outline, from the anatomy: "band" (flat,
    widest at its footprints: ATFL, trapezoid), "fan" (narrow where it starts,
    spreading to where it ends: the deltoid's tibiocalcaneal part, conoid,
    elbow's radial collateral), "fanIn" (the reverse: coraco-acromial, broad at
    the coracoid), "cord" (round and narrow: LCL, CFL), "hub" (a fan's spoke).
    """
    import random
    rnd = random.Random(seed_text)
    phases = [rnd.uniform(0, 2 * math.pi) for _ in range(4)]
    n = len(rows) - 1
    m = len(rows[0]) - 1

    def wander(t, k):
        return 0.6 * math.sin(2 * math.pi * (t * 1.3) + phases[k]) + 0.4 * math.sin(2 * math.pi * (t * 2.7) + phases[k + 1])

    out = []
    for i, row in enumerate(rows):
        t = i / n
        # Narrow waist, wide footprints; a fan's hub end stays narrow.
        if shape == "hub":
            flare = 0.42 + 0.58 * t + 0.25 * t * t
        elif shape == "apex":
            # One sector of a fan that shares its apex with its neighbours (the
            # deltoid): a point at the start, full width at the end, so the
            # sectors tile one sheet instead of overlapping.
            flare = 0.06 + 0.94 * t
        elif shape == "fan":
            flare = 0.32 + 0.68 * t ** 1.15 + 0.12 * (1 - t) ** 6
        elif shape == "fanIn":
            flare = 0.32 + 0.68 * (1 - t) ** 1.15 + 0.12 * t ** 6
        elif shape == "cord":
            flare = 0.85 + 0.3 * (2 * t - 1) ** 2
        else:
            flare = 0.72 + 0.5 * (2 * t - 1) ** 2
        flare *= 1.0 + 0.05 * wander(t, 0)
        lift = (0.0016 if cord else 0.0006) * math.sin(math.pi * t)
        sway = across * (0.0005 * wander(t, 1))
        # Ends sink a little into the bone, so the band grows out of it.
        sink = -0.0006 * (1.0 - math.sin(math.pi * t)) ** 2
        new_row = []
        for j in range(m + 1):
            u = 2.0 * j / m - 1.0
            # A cord is round: its dome is half its width. A band is a thick
            # sheet, highest along its middle.
            depth = 0.42 * width * flare if shape == "cord" else 0.0011
            dome = depth * math.sqrt(max(0.0, 1.0 - u * u)) * math.sin(math.pi * min(1.0, max(0.0, t * 0.85 + 0.075)))
            p = mids[i] + across * (u * width * 0.5 * flare) + sway + up * (lift + dome + sink)
            new_row.append(p)
        out.append(new_row)
    return out


def build_bands(bands, cutout, mesh_name):
    """One strap mesh per spec band, laid on the two bones it joins.

    A band is {"from": bone, "to": bone, "width": metres?}. Its ends are the
    points of each bone nearest a guide point: the midway point of the two
    bones pushed towards the atlas cut-out, so a palmar ligament lands on the
    palmar faces. Between them a grid is laid flat, then each vertex is moved
    onto the nearer bone's surface (plus a millimetre) wherever a bone is
    close; over the joint gap it bridges straight across, as a real ligament
    does. Two smoothing passes along the band take out the kinks.
    """
    from mathutils.bvhtree import BVHTree
    cut = [v.co.copy() for v in cutout.vertices]
    cut_centre = sum(cut, mathutils.Vector()) / max(1, len(cut))

    trees = _BAND_TREES

    def bone_tree(name):
        if name not in trees:
            m = bake_raw([name], "bandbone_" + name)
            pts = [v.co.copy() for v in m.vertices]
            centre = sum(pts, mathutils.Vector()) / max(1, len(pts))
            trees[name] = (BVHTree.FromPolygons(pts, [p.vertices[:] for p in m.polygons]), centre)
            bpy.data.meshes.remove(m)
        return trees[name]

    def nearest(name, point):
        tree, centre = bone_tree(name)
        loc, normal, _i, dist = tree.find_nearest(point)
        if loc is None:
            return None, None, None
        # The left-side meshes are mirrored with their faces turned inward:
        # an outward normal is the one pointing away from the bone's centre.
        n = normal.normalized()
        if n.dot(loc - centre) < 0:
            n = -n
        return loc, n, dist

    def marker_point(marker, bone):
        """A Z-Anatomy landmark marker (`<name>.j`, a two-point label line on
        the RIGHT side), mirrored to the left: the end nearer the bone is the
        landmark, the other is the label's tail."""
        ob = bpy.data.objects.get(marker + ".j")
        if not ob or ob.type != "MESH":
            print("[bands] no marker " + marker, flush=True)
            return None
        pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
        pts = [mathutils.Vector((-p.x, p.y, p.z)) for p in pts]
        return min(pts, key=lambda p: surface_dist(bone, p))

    def surface_dist(name, point):
        loc, _n, dist = nearest(name, point)
        return dist if loc is not None else 1.0

    def local_centre(a_name, b_name):
        """The part of the cut-out between these two bones, else all of it."""
        both = [v for v in cut if surface_dist(a_name, v) < 0.006 and surface_dist(b_name, v) < 0.006]
        either = both or [v for v in cut if min(surface_dist(a_name, v), surface_dist(b_name, v)) < 0.006]
        pts = either or cut
        return sum(pts, mathutils.Vector()) / max(1, len(pts))

    def drape(point, up, names):
        """The highest bone surface under a point, looking down along `up`."""
        best = None
        for name in names:
            tree, _c = bone_tree(name)
            loc, _n, _i, _d = tree.ray_cast(point + up * 0.03, -up, 0.06)
            if loc is not None and (best is None or (loc - point).dot(up) > (best - point).dot(up)):
                best = loc
        return best

    bm = bmesh.new()
    ALONG, ACROSS, LIFT, MIN_LENGTH = 24, 8, 0.0012, 0.009
    for index, band in enumerate(bands):
        a_name, b_name = band["from"], band["to"]
        drape_over = (a_name, b_name) + tuple(band.get("over", []))
        centre = local_centre(a_name, b_name)
        # A fan (`"hub": true`, the radiate carpal ligament) starts every band
        # at one point on the hub bone, nearest the middle of the cut-out, and
        # ends each where the cut-out meets the other bone.
        a_guide = marker_point(band["fromAt"], a_name) if band.get("fromAt") else None
        # `fromNudge` [x, y, z] metres moves the start from its marker to the
        # border the ligament actually leaves from: the ATFL leaves the
        # ANTERIOR border of the lateral malleolus, the marker is on its side.
        if a_guide is not None and band.get("fromNudge"):
            a_guide = a_guide + mathutils.Vector(band["fromNudge"])
        b_guide = marker_point(band["toAt"], b_name) if band.get("toAt") else None
        a, na, _ = nearest(a_name, a_guide or (cut_centre if band.get("hub") else centre))
        # `toOffset` [x, y, z] metres from the start, left side, atlas axes
        # (+x lateral, -y anterior, +z up): for an end the atlas has no marker
        # for, or a marker on the wrong face. The ATFL's talar end is the
        # lateral side of the neck, forward of the malleolus; the atlas's
        # "Neck of talus" marker is on the medial side.
        if band.get("toOffset") and a is not None:
            b_guide = a + mathutils.Vector(band["toOffset"])
        b, nb, _ = nearest(b_name, b_guide or centre)
        if a is None or b is None:
            continue
        span = b - a
        print("[band] " + a_name + " -> " + b_name + ": from " + str(tuple(round(c, 4) for c in a)) + " to " + str(tuple(round(c, 4) for c in b)) + ", " + format(span.length * 1000, ".1f") + " mm"
              + (" (guides " + str(a_guide and tuple(round(c, 4) for c in a_guide)) + ", " + str(b_guide and tuple(round(c, 4) for c in b_guide)) + ")"), flush=True)
        if span.length < 1e-5:
            continue
        axis = span.normalized()
        up = na + nb
        # `face` [x, y, z] says which way the band's broad side looks, when
        # the bones' own normals at its two ends disagree: the deltoid's
        # parts face medially, whatever the malleolus and sustentaculum say.
        if band.get("face"):
            up = mathutils.Vector(band["face"])
        up = (up - axis * up.dot(axis)).normalized() if up.length > 1e-6 else mathutils.Vector((0, 0, 1))
        # Short across a narrow joint, a band still has to reach onto both
        # bones to read as joining them: carpal ligaments are about a centimetre.
        reach = max(0.0, (MIN_LENGTH - span.length) / 2) + (0.0008 if (a_guide or b_guide) else 0.0015)
        hub = bool(band.get("hub"))
        # A fan's bands leave the hub a little apart, so they do not knot.
        a, b = (a + axis * 0.0015 if hub else a - axis * reach), b + axis * reach
        span = b - a
        across = axis.cross(up).normalized()
        width = float(band.get("width", min(0.007, max(0.003, 0.4 * span.length))))
        rows = []
        for i in range(ALONG + 1):
            t = i / ALONG
            taper = (0.45 + 0.55 * t) if hub else 1.0 - 0.3 * abs(2 * t - 1) ** 3
            row = []
            for j in range(ACROSS + 1):
                u = (j / ACROSS - 0.5) * width * taper
                p = a + span * t + across * u
                # A cord (`"drape": false`) runs straight between its ends, as
                # the ankle and knee collaterals do; draping lays it on
                # whichever bone is nearest the camera side instead.
                hit = drape(p, up, drape_over) if band.get("drape", True) else None
                # A surface far above or below the band's own line is another
                # face of the bone (its side, a neighbour's edge), not the one
                # the band lies on: bridged over instead, or the band curls.
                if hit is not None and abs((hit - p).dot(up)) > 0.0035:
                    hit = None
                # Each band a hair above the last, so crossing bands never
                # fight for the same surface.
                row.append(hit + up * (LIFT + band.get("lift", 0.0) + 0.00025 * index) if hit is not None else None)
            rows.append(row)
        # Over the joint gap nothing is hit: bridge straight between the
        # nearest draped points on either side, as the ligament does.
        for j in range(ACROSS + 1):
            col = [rows[i][j] for i in range(ALONG + 1)]
            known = [i for i, p in enumerate(col) if p is not None]
            if not known:
                for i in range(ALONG + 1):
                    rows[i][j] = a + span * (i / ALONG) + across * ((j / ACROSS - 0.5) * width) + up * (LIFT + band.get("lift", 0.0))
                continue
            for i in range(ALONG + 1):
                if col[i] is not None:
                    continue
                lo = max([k for k in known if k < i], default=None)
                hi = min([k for k in known if k > i], default=None)
                if lo is not None and hi is not None:
                    f = (i - lo) / (hi - lo)
                    rows[i][j] = col[lo].lerp(col[hi], f)
                else:
                    k = lo if lo is not None else hi
                    rows[i][j] = col[k] + span * ((i - k) / ALONG)
        for _ in range(3):
            rows = [rows[0]] + [[(rows[i - 1][j] + rows[i][j] * 2 + rows[i + 1][j]) / 4 for j in range(ACROSS + 1)] for i in range(1, ALONG)] + [rows[-1]]
        # And once across, so the band lies flat rather than twisting.
        mids = [sum(row, mathutils.Vector()) / len(row) for row in rows]
        rows = [[mids[i] + (rows[i][j] - mids[i]) * 0.5 + across * ((j / ACROSS - 0.5) * width * 0.5) for j in range(ACROSS + 1)] for i in range(ALONG + 1)]
        rows = anatomical(rows, mids, across, up, width, "hub" if hub else band.get("shape", "band"), not band.get("drape", True), a_name + b_name + str(index))
        verts = [[bm.verts.new(p) for p in row] for row in rows]
        uv = bm.loops.layers.uv.get("fibres") or bm.loops.layers.uv.new("fibres")
        for i in range(ALONG):
            for j in range(ACROSS):
                face = bm.faces.new((verts[i][j], verts[i][j + 1], verts[i + 1][j + 1], verts[i + 1][j]))
                # u across the band, v along it: the fibres run along v, and
                # because u is measured across each row's own width they
                # spread with a fan instead of running parallel.
                for loop, (ii, jj) in zip(face.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                    loop[uv].uv = (jj / ACROSS, ii / ALONG)
    mesh = bpy.data.meshes.new(mesh_name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def mesh_bbox_padded(mesh, pad=0.003):
    lo, hi = mesh_bbox(mesh)
    return ([v - pad for v in lo], [v + pad for v in hi])


def mesh_bbox(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


# The least frame, as a multiple of the ligament's own span: all of it, plus a
# little of the bone at each end so the student can see what it connects.
FULL_LIGAMENT = 1.2


def frame_size(span, margin, min_frame, max_frame=None):
    """The wider of "a bit more than the ligament" and "enough to hold the
    joint" (see --min-frame), no wider than max_frame when one is given.

    Without a ceiling every ligament of an area was framed at the area's full
    size, so an 11mm acromioclavicular ligament was a sliver on a 240mm
    shoulder. With a spec that gives both, a small ligament is framed at
    minFrame (still enough to orient) and a long one grows up to frame.
    """
    size = max(span * margin, min_frame)
    if max_frame:
        size = min(size, max_frame)
    # NEVER TIGHTER THAN THE LIGAMENT. The ceiling is for context, not for
    # cropping: a 293mm interosseous membrane on a 200mm knee frame became a
    # bare stretch of shin with neither joint in view. The whole ligament and
    # a little of each end always fits.
    return max(size, span * FULL_LIGAMENT)


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
    if abs(elevation_deg) >= 89.0:
        # Straight down or straight up, "up" in the picture is undefined. Take
        # the limit of the tilt instead: the far side going up, the near side
        # going down. Tilting up from the posterior view and down from the
        # anterior one, both put the toes at the top of the picture.
        forward = (centre - cam.location).normalized()
        far = mathutils.Vector((math.sin(theta), math.cos(theta), 0.0))
        up_hint = far if elevation_deg > 0 else -far
        right = forward.cross(up_hint).normalized()
        true_up = right.cross(forward).normalized()
        cam.rotation_euler = mathutils.Matrix((right, true_up, -forward)).transposed().to_euler()
    else:
        cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = size
    if STUDIO:
        aim_lights()
    else:
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


def render_ids(path, bones_mesh, parts, target_thickness=0.0009):
    """One render where every strap is its own colour, so a click on the
    wrong ligament can be named. parts: list of (index, mesh)."""
    clear()
    link(bones_mesh, "id_bones", BLACK_MAT)
    for idx, m in parts:
        link(m, "id_%d" % idx, flat_emission("lig_id_%d" % idx, id_colour(idx)), soften=True,
             thickness=target_thickness if idx == 1 else 0.0009)
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


def link(mesh, name, material, holdout=False, outlined=False, soften=False, boned=False, thickness=0.0009):
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.clear()
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.material_index = 0
    ob.is_holdout = holdout
    if soften:
        soften_strap(ob, thickness)
    (outline_coll if outlined else bone_coll if boned else scene.collection).objects.link(ob)
    return ob


def soften_strap(ob, thickness=0.0009):
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
    solid.thickness = thickness
    solid.offset = 0.0
    sub = ob.modifiers.new("soften", "SUBSURF")
    # One level, not two: two on a 0.9mm solidified sheet rippled the edge.
    sub.levels = 1
    sub.render_levels = 1


EEVEE_ENGINE = scene.render.engine


def multiply_lines(path, line_path):
    """Multiplies the Workbench line pass over the lit render, where there is
    something under it (its transparent background would eat the edge)."""
    import numpy as np
    base = bpy.data.images.load(path)
    line = bpy.data.images.load(line_path)
    n = base.size[0] * base.size[1] * 4
    bpx = np.empty(n, dtype=np.float32); base.pixels.foreach_get(bpx)
    lpx = np.empty(n, dtype=np.float32); line.pixels.foreach_get(lpx)
    bpx = bpx.reshape(-1, 4); lpx = lpx.reshape(-1, 4)
    k = lpx[:, 3:4]
    bpx[:, :3] *= lpx[:, :3] * k + (1 - k)
    base.pixels.foreach_set(bpx.ravel())
    base.filepath_raw = path
    base.file_format = "PNG"
    base.save()
    bpy.data.images.remove(base)
    bpy.data.images.remove(line)
    os.remove(line_path)


def render_to(path, outlines=True):
    """outlines=True is a picture a student sees (context, highlight): it gets
    the strap outlines and, in the studio look, the line pass. The mask and ID
    renders pass False — a line would widen the traced hotspot."""
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    scene.render.engine = EEVEE_ENGINE
    scene.render.use_freestyle = outlines
    bpy.ops.render.render(write_still=True)
    if outlines and STUDIO:
        line_path = path[:-4] + ".lines.png"
        scene.render.filepath = line_path
        scene.render.use_freestyle = False
        scene.render.engine = "BLENDER_WORKBENCH"
        try:
            bpy.ops.render.render(write_still=True)
        finally:
            scene.render.engine = EEVEE_ENGINE
        multiply_lines(path, line_path)


skel = bpy.data.collections.get("1: Skeletal system")
skeleton_names = [o.name for o in skel.all_objects if o.type == "MESH" and boneLook.is_bone(o.name)]

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

def world_box(name, pad=0.003):
    """An object's world-space bounding box, grown by pad metres."""
    ob = bpy.data.objects.get(name)
    if not ob or ob.type != "MESH":
        return None
    pts = [ob.matrix_world @ mathutils.Vector(c) for c in ob.bound_box]
    return ([min(p[i] for p in pts) - pad for i in range(3)], [max(p[i] for p in pts) + pad for i in range(3)])


def boxes_touch(a, b):
    return all(a[0][i] <= b[1][i] and a[1][i] >= b[0][i] for i in range(3))


def touches_any(box, boxes):
    return any(boxes_touch(box, b) for b in boxes)


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
    # `jointBones` (the isolated pictures, owner 16 Oct 2026): only the bones
    # of this joint, on this side, in place of the region's keep list.
    if entry.get("jointBones"):
        entry = dict(entry, keep=entry["jointBones"])
    keep = expand(entry.get("keep", [])) if entry.get("keep") else None
    # A keep pattern that names nothing drops those bones with no error —
    # "Sternum*" matched nothing for a whole tranche, because the atlas names
    # them "Manubrium of sternum" and "Body of sternum". Say so.
    if entry.get("keep"):
        import fnmatch
        for pat in entry["keep"]:
            if not any(fnmatch.fnmatch(n, pat) for n in skeleton_names):
                print("[warn] " + key + ": keep pattern '" + pat + "' matches no bone", flush=True)

    lig_mesh = bake(lig_names, "lig_" + key, skin=True)
    if not lig_mesh.vertices:
        print("[warn] " + key + ": empty bake, skipped", flush=True)
        continue
    lo, hi = mesh_bbox(lig_mesh)
    # FRAME ON A PART. A ligament that runs the whole spine is its own wrong
    # ruler: framed on all 565mm of the intertransverse ligaments, each strand
    # is a hair. frameBox ([[x,y,z],[x,y,z]], metres) frames on one stretch of
    # it instead; the rest is still drawn and still traced where it is in shot.
    if entry.get("frameBox"):
        lo, hi = tuple(entry["frameBox"][0]), tuple(entry["frameBox"][1])

    # The bones, minus anything the spec cuts away. The ligament itself is baked
    # separately so it can be recoloured between the three renders.
    solid_names = [n for n in skeleton_names
                   if n not in drop and n not in ghost and n not in lig_names
                   and (keep is None or n in keep)]
    bones = smooth(bake(solid_names, "ligbones_" + key))
    ghost_mesh = smooth(bake([n for n in ghost if n not in lig_names], "ligghost_" + key)) if ghost else None

    # ghostAlpha (default 0.45, the ACL's) lets one entry thin its ghosted bones:
    # a 3mm interosseous ligament in the resting colour is close to invisible
    # through a carpal at 0.45. Set per entry, restored below, so no other
    # plate's ghost changes.
    GHOST_MAT.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = entry.get("ghostAlpha", 0.45)

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
    # BOTH SIDES. When the same ligament of the other side is in the picture —
    # the right sacrotuberous behind the left, both halves of the interclavicular
    # — it is part of the answer, not a neighbour: highlighted with the target,
    # traced into the target's mask (two outlines, one per side, as landmarks
    # are), and never offered as a wrong answer. The camera stays framed on the
    # left side, so a twin is only drawn when it genuinely falls in shot.
    import re
    twin_names = {re.sub(r"\.((?:o\d?)?)l$", r".\1r", n) for n in lig_names} - set(lig_names)
    twins = [n for n in others if n in twin_names]
    # An isolated picture of one side's joint has no other side to show: its
    # bones are not drawn, and its ligament would float in space.
    if entry.get("jointBones") and all(pat.endswith(".l") for pat in entry["jointBones"]):
        twins = []
    if twins:
        others = [n for n in others if n not in twins]
        print("[twin] " + key + ": " + ", ".join(twins), flush=True)
        bpy.data.meshes.remove(lig_mesh)
        lig_mesh = bake(lig_names + twins, "lig_" + key, skin=True)
    # SNUG ON THE BONE (spec `shrinkwrap`, metres off the surface). The atlas
    # draws the wrist retinacula as a cuff standing well clear of the bones,
    # because in the body the tendons fill the space beneath them; on a
    # bones-only plate that read as a loose band floating round the wrist
    # (owner, 16 Oct 2026). Each vertex moves to the nearest point of the
    # bones drawn, plus the offset, so the band lies where it would rest on the
    # skeleton. Only for an entry that asks: everywhere else the atlas's shape
    # is the shape.
    # A BAND BETWEEN TWO FOOTPRINTS (spec `hull`). The atlas has no patellar
    # ligament, only its two attachment patches (`.ol` on the apex of the
    # patella, `.el` on the tibial tuberosity, in "Muscular insertions"). The
    # convex hull of the two is the band that runs between them, which is the
    # ligament's real course: a straight, flat strap. Not for a twin pair,
    # whose hull would span the body.
    if entry.get("hull") and not twins:
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(lig_mesh)
        hull = bmesh.ops.convex_hull(bm, input=bm.verts, use_existing_faces=False)
        bmesh.ops.delete(bm, geom=hull["geom_interior"] + hull["geom_unused"], context="VERTS")
        bm.to_mesh(lig_mesh)
        bm.free()
        lig_mesh.update()
        print("[hull] " + key + ": one band over " + str(len(lig_mesh.vertices)) + " vertices", flush=True)
    if entry.get("shrinkwrap") is not None:
        from mathutils.bvhtree import BVHTree
        tree = BVHTree.FromPolygons([v.co.copy() for v in bones.vertices], [p.vertices[:] for p in bones.polygons])
        offset = float(entry["shrinkwrap"])
        moved = 0
        for v in lig_mesh.vertices:
            loc, normal, _i, _d = tree.find_nearest(v.co)
            if loc is not None and normal is not None:
                v.co = loc + normal.normalized() * offset
                moved += 1
        lig_mesh.update()
        print("[shrinkwrap] " + key + ": " + str(moved) + " vertices onto the bones, " + format(offset * 1000, ".1f") + "mm off", flush=True)
    # See ghost_strap_mat: with solidStraps, the straps it does not name are
    # ghosted. They leave `others`, so they are neither holdouts nor tap targets.
    ghost_strap_mesh = None
    if entry.get("solidStraps"):
        import fnmatch
        see_through = [n for n in others if not any(fnmatch.fnmatch(n, p) for p in entry["solidStraps"])]
        others = [n for n in others if n not in see_through]
        if see_through:
            print("[ghost-straps] " + key + ": " + ", ".join(sorted(see_through)), flush=True)
            ghost_strap_mesh = smooth(bake(see_through, "ligghoststraps_" + key))
    other_mesh = None  # superseded by the per-view sets below
    # ONE FACE OF THE WRIST AT A TIME. Every wrist ligament drawn at once,
    # palmar and dorsal through see-through carpals, was a tangle nobody
    # pictures; an illustration of the palmar wrist shows the palmar
    # ligaments. For a band-drawn target, a neighbour on the far side of the
    # capitate from it is left out.
    if lig_names and lig_names[0] in BAND_TABLE and bpy.data.objects.get("Capitate bone.l"):
        hub_box = world_box("Capitate bone.l")
        hub = mathutils.Vector([(hub_box[0][i] + hub_box[1][i]) / 2 for i in range(3)])
        tl, th = mesh_bbox(lig_mesh)
        facing = mathutils.Vector([(tl[i] + th[i]) / 2 for i in range(3)]) - hub
        if facing.length > 1e-6:
            facing.normalize()
            def same_face(n):
                box = world_box(n)
                if not box:
                    return True
                c = mathutils.Vector([(box[0][i] + box[1][i]) / 2 for i in range(3)])
                return (c - hub).dot(facing) > -0.002
            far = [n for n in others if not same_face(n)]
            others = [n for n in others if same_face(n)]
            if far:
                print("[one-face] " + key + ": left out " + str(len(far)) + " on the far side", flush=True)
    # THE LIGAMENT AND ITS JOINT'S BONES, NOTHING ELSE (spec `isolated`). The
    # owner, 16 Oct 2026: on the regenerated pictures "I don't want to see any
    # other structures other than the bones of that joint". No neighbouring
    # straps; the keep list already limits the bones to the joint's region.
    if entry.get("isolated"):
        others = []
    # QUESTION PICTURES SHOW THE JOINT'S MAIN LIGAMENTS (owner, 17 Oct 2026):
    # "up to 5 of the largest / most significant ligaments that fit around
    # that joint". `neighbours` is how many, chosen nearest first from
    # `neighbourPool` (the clinically important ligaments' atlas objects).
    elif entry.get("neighbours") is not None:
        pool = set(entry.get("neighbourPool", []))
        hub_lo, hub_hi = mesh_bbox(lig_mesh)
        hub_c = mathutils.Vector([(hub_lo[i] + hub_hi[i]) / 2 for i in range(3)])

        def dist(n):
            box = world_box(n, 0.0)
            c = mathutils.Vector([(box[0][i] + box[1][i]) / 2 for i in range(3)])
            return (c - hub_c).length
        ranked = sorted((n for n in others if n in pool and world_box(n)), key=dist)
        others = ranked[: int(entry["neighbours"])]
    if others:
        print("[straps] " + key + ": " + ", ".join(sorted(others)), flush=True)

    # Each strap is its own object in the visible renders, because the fibre
    # lines have to follow that strap's own length. The combined bake above is
    # still what holds the mask out — one holdout is as good as twenty.
    strap_parts = []
    for n in others:
        m = bake([n], "strap_" + key + "_" + n)
        if m.vertices:
            axes = fibre_axes(m, n)
            strap_parts.append((n, m, strap_mat("rest_" + n, REST_FILL, REST_LINE, axes),
                                strap_mat("muted_" + n, REST_MUTED_FILL, REST_MUTED_LINE, axes)))
        else:
            bpy.data.meshes.remove(m)
    # A STRAP IS DRAWN ONLY IF IT TOUCHES A BONE IN THE PICTURE. The wider
    # frames pulled in ligaments whose bones the keep list leaves out — the
    # sacro-iliac straps hanging in space beside a forearm, foot ligaments
    # floating under a leg — and a ligament with nothing to hold on to is not
    # anatomy. A bounding-box contact test, generous by 3mm.
    def straps_touching(bone_names):
        boxes = [b for b in (world_box(n) for n in list(bone_names) + [g for g in ghost if g not in lig_names]) if b]
        return [p for p in strap_parts if touches_any(mesh_bbox_padded(p[1]), boxes)]

    level_straps = straps_touching(solid_names)
    # TILTED UP, THE LEG IS IN THE WAY. Looking down on a foot from above, the
    # tibia and fibula stand between the camera and the dorsum; an atlas draws
    # a dorsal view with the leg removed, and so does this. Only the upward
    # tilts lose them — a view from below has the leg behind it.
    up_cut = expand(entry.get("tiltCutaway", []))
    if up_cut and any(t[1] > 0 for t in entry.get("tilts", [])):
        up_names = [n for n in solid_names if n not in up_cut]
        bones_up = smooth(bake(up_names, "ligbonesup_" + key))
        up_straps = straps_touching(up_names)
    else:
        bones_up, up_straps = bones, level_straps
    other_level = bake([p[0] for p in level_straps], "ligothers_" + key) if level_straps else None
    other_up = (bake([p[0] for p in up_straps], "ligothersup_" + key) if up_straps else None) if bones_up is not bones else other_level

    # A sheet seen edge-on can ask to be drawn thicker (targetThickness, metres).
    target_thick = entry.get("targetThickness", 0.0009)
    lig_axes = fibre_axes(lig_mesh, lig_names[0] if lig_names else None)
    LIG_MAT = strap_mat("rest_" + key, REST_FILL, REST_LINE, lig_axes)
    HILITE_MAT = strap_mat("hilite_" + key, HILITE_FILL, HILITE_LINE, lig_axes, HILITE_GLOW)

    angles = entry.get("angles") or [entry["angle"]]
    # The turntable views, then any tilted ones ([azimuth, elevation]), which
    # are named aNNNuMMM or aNNNdMMM (lib/rotationFrames.ts).
    views = [(ang, entry.get("elevation", 0), False) for ang in angles] + [(t[0], t[1], True) for t in entry.get("tilts", [])]
    for angle, elev, tilted in views:
      frame_camera(lo, hi, angle, elev,
                   entry.get("margin", a.margin), floor_m, ceiling_m)
      marker = "a%03d" % angle
      if tilted:
          marker += ("u" if elev > 0 else "d") + "%03d" % abs(elev)
      # A single-angle entry keeps the flat layout the preview packer reads;
      # a rotation set gets one folder per view underneath it.
      leaf_dir = os.path.join(a.out, key) if len(views) == 1 else os.path.join(a.out, key, marker)
      if a.skip_existing and os.path.exists(os.path.join(leaf_dir, "ids.json")):
          print("[skip] " + key + " " + marker + ": already rendered", flush=True)
          continue

      up_view = tilted and elev > 0
      view_bones = bones_up if up_view else bones
      view_straps = up_straps if up_view else level_straps
      view_others = other_up if up_view else other_level

      span_mm = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1000
      note = (", cutaway " + str(len(drop)) + " bone(s)") if drop else ""
      note += (", keeping " + str(len(solid_names)) + " bone(s)") if keep is not None else ""
      note += (", ghosting " + str(len(ghost)) + " bone(s)") if ghost else ""
      print("[lig] " + key + ": " + format(span_mm, ".0f") + "mm across, angle "
            + str(angle) + ("" if not tilted else " tilt " + str(elev)) + note, flush=True)

      clear()
      link(view_bones, "ctx_bones_" + key, BONE_MAT, boned=True)
      link(lig_mesh, "ctx_lig_" + key, LIG_MAT, outlined=True, soften=True, thickness=target_thick)
      for n, m, mat, _muted in view_straps:
          link(m, "ctx_" + n, mat, outlined=True, soften=True)
      if ghost_mesh:
          link(ghost_mesh, "ctx_ghost_" + key, GHOST_MAT, boned=True)
      if ghost_strap_mesh:
          link(ghost_strap_mesh, "ctx_ghoststraps_" + key, GHOST_STRAP_MAT, soften=True)
      render_to(os.path.join(leaf_dir, "context.png"))

      clear()
      link(view_bones, "hl_bones_" + key, BONE_MAT, boned=True)
      link(lig_mesh, "hl_lig_" + key, HILITE_MAT, outlined=True, soften=True, thickness=target_thick)
      for n, m, _rest, muted in view_straps:
          link(m, "hl_" + n, muted, outlined=True, soften=True)
      if ghost_mesh:
          link(ghost_mesh, "hl_ghost_" + key, GHOST_MAT, boned=True)
      if ghost_strap_mesh:
          link(ghost_strap_mesh, "hl_ghoststraps_" + key, GHOST_STRAP_MAT, soften=True)
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
      link(view_bones, "msk_bones_" + key, BONE_MAT, holdout=True)
      if view_others:
          link(view_others, "msk_others_" + key, BONE_MAT, holdout=True, soften=True)
      link(lig_mesh, "msk_lig_" + key, MASK_MAT, soften=True, thickness=target_thick)
      render_to(os.path.join(leaf_dir, "mask.png"), outlines=False)

      # The ID pass, with a legend the packer reads back. The target is index
      # 1; the neighbours follow in the order they were baked.
      parts = [(1, lig_mesh)] + [(i + 2, m) for i, (n, m, _, _) in enumerate(view_straps)]
      render_ids(os.path.join(leaf_dir, "ids.png"), view_bones, parts, target_thick)
      with open(os.path.join(leaf_dir, "ids.json"), "w") as f:
          json.dump({"1": entry.get("name", key)} | {str(i + 2): n for i, (n, _, _, _) in enumerate(view_straps)}, f)

      count += 4
    bpy.data.meshes.remove(lig_mesh)
    bpy.data.meshes.remove(bones)
    if ghost_mesh:
        bpy.data.meshes.remove(ghost_mesh)
    if ghost_strap_mesh:
        bpy.data.meshes.remove(ghost_strap_mesh)
    if other_mesh:
        bpy.data.meshes.remove(other_mesh)
    if other_level:
        bpy.data.meshes.remove(other_level)
    if other_up is not None and other_up is not other_level:
        bpy.data.meshes.remove(other_up)
    if bones_up is not bones:
        bpy.data.meshes.remove(bones_up)
    for _, m, _, _ in strap_parts:
        bpy.data.meshes.remove(m)

print("[complete] " + str(count) + " renders -> " + a.out
      + " (" + format(time.time() - t0, ".0f") + "s)", flush=True)
