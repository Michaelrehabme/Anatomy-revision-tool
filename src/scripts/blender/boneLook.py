"""The shared look for every bone the app draws.

WHY THIS IS A MODULE AND NOT A CONVENTION. Seven render scripts draw the same
skeleton — bone plates, deep plates, sub-region plates, muscle panels, joint
masks, ligament plates, landmark panels — and each grew its own lighting. The
result was one app with seven different bones in it: the landmark panels warm
and modelled, the plates a flat grey wash. Copying the good one into six
files would leave seven copies to drift apart again, so the good one moves
here and the others call it.

THE RECIPE IS THE LANDMARK PANELS', because that family had already solved
it, and its own comment says why: a white world at 0.55 lit every face from
every side, so a fossa was as bright as the ridge beside it and a vertebra
read as a grey silhouette with nothing on it to find. Relief comes from a dim
world and a key light raking across the surface. Three things carry it:

  a DIM WORLD (0.12, not 0.55) so shading has somewhere to fall;
  a KEY FIXED TO THE CAMERA, over the viewer's left shoulder, which is the
    convention of every anatomical plate — and, more practically, a sun fixed
    to the WORLD is a raking light in one view and a flat frontal one in the
    next, so the same bone changes character as the camera goes round it;
  AMBIENT OCCLUSION multiplied into the base colour, which is what separates
    a foramen's rim from its floor on a bone this pale. The lights alone
    cannot do it.

A MASK MUST NEVER BE SHADED, so nothing here touches the mask materials: a
flat emission thresholds to the same silhouette under any lighting, which is
what keeps a hotspot the shape of the bone rather than the shape of the
light.
"""
import bpy
import math
import mathutils
import os
import zlib

# The world is nearly off. This single number is most of the difference
# between a modelled bone and a grey cut-out.
WORLD_STRENGTH = 0.12

# Where the light travels, in the CAMERA's own axes (x right, y up, -z away
# from the lens).
KEY_DIR = (0.62, -0.62, -0.48)
FILL_DIR = (-0.75, 0.25, -0.6)

BONE_COLOUR = (0.90, 0.88, 0.83, 1)
"""Base colour before occlusion darkens the hollows."""

# ---------------------------------------------------------------- look v2
"""LOOK 2: DEFINITION FROM LIGHT, NOT FROM LINES (user, 15 Nov 2026).

A tester called the AC joint picture "lacking definition", and the user saw the
same on the levator scapulae: two bones (or two muscles) of one colour, lit
softly from everywhere, melt into each other. Drawn outlines were tried and
rejected ("it shouldn't need an outline"). What separates two touching things
in a real anatomical plate is the light:

  a CRISP KEY, so one bone casts a shadow onto the bone behind it — at 12
    degrees of sun the shadow edge was so soft it never landed anywhere;
  a WEAKER FILL, so the shadow side is actually darker than the lit side;
  REAL OCCLUSION in the gaps, at a reach that spans a joint space (5 cm, not
    2) and without the gamma that had pulled it back to almost nothing;
  a FAINT TONE PER STRUCTURE, a few percent of value, so two neighbours that
    the light happens to hit equally still read as two things. Each source
    object's name hashes to its own tone, so the same bone is the same tone in
    every plate and every turn of the turntable.

Selected by BONELOOK=2 in the environment, so a run can be compared with the
current look before anything is replaced. Masks are emission and ignore it.
"""
LOOK = os.environ.get("BONELOOK", "1")
V2 = LOOK == "2"
TONE_ATTR = "structure_tone"
TONE_SPREAD = 0.11
"""How much darker the darkest tone is than the lightest. Enough to tell two
bones apart side by side, not enough to read as a different tissue."""


def tone_of(name):
    """A stable 0.2..1.0 per object name (0 means untagged)."""
    base = name.rsplit(".", 1)[0] if name[-2:] in (".l", ".r") else name
    return 0.2 + 0.8 * ((zlib.crc32(base.encode()) % 1000) / 999.0)


def tag_tone(mesh, name):
    """Write the object's tone onto every vertex, so it survives being baked
    into one mesh with the rest of the skeleton. A no-op in look 1."""
    if not V2 or not len(mesh.vertices):
        return mesh
    t = tone_of(name)
    attr = mesh.color_attributes.get(TONE_ATTR) or mesh.color_attributes.new(TONE_ATTR, "FLOAT_COLOR", "POINT")
    attr.data.foreach_set("color", [t, t, t, 1.0] * len(mesh.vertices))
    return mesh


def _tone_multiplier(nt):
    """1 - TONE_SPREAD * tone, as a value node output (1.0 where untagged)."""
    at = nt.nodes.new("ShaderNodeAttribute")
    at.attribute_name = TONE_ATTR
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY_ADD"
    mul.inputs[1].default_value = -TONE_SPREAD
    mul.inputs[2].default_value = 1.0
    nt.links.new(at.outputs["Fac"], mul.inputs[0])
    return mul.outputs[0]


def _multiply(nt, a=None, b_socket=None, a_colour=None):
    """Colour a times scalar b. ShaderNodeMix in RGBA mode: MixRGB is legacy
    and the installed Blender is 5.x. Returns the output socket."""
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.clamp_result = True
    ins = [i for i in mix.inputs if i.enabled]
    fac, A, B = ins[0], ins[1], ins[2]
    fac.default_value = 1.0
    if a is not None:
        nt.links.new(a, A)
    else:
        A.default_value = a_colour
    nt.links.new(b_socket, B)
    return [o for o in mix.outputs if o.enabled][0]


def configure_eevee(scene):
    """Shadows and occlusion that reach across a joint space. Names differ
    between EEVEE versions, so each is tried and skipped if absent."""
    if not V2:
        return
    ee = scene.eevee
    for attr, val in (("use_gtao", True), ("gtao_distance", 0.05), ("gtao_quality", 0.5),
                      ("use_shadows", True), ("use_soft_shadows", True),
                      ("shadow_cube_size", "2048"), ("shadow_cascade_size", "4096"),
                      ("use_shadow_high_bitdepth", True),
                      ("shadow_ray_count", 3), ("shadow_step_count", 12),
                      ("use_raytracing", True), ("ray_tracing_method", "SCREEN"),
                      ("fast_gi_distance", 0.05), ("use_fast_gi", True)):
        try:
            setattr(ee, attr, val)
        except (AttributeError, TypeError, ValueError):
            pass
    try:
        ee.ray_tracing_options.screen_trace_quality = 0.5
    except AttributeError:
        pass


"""Things filed under "1: Skeletal system" that a skeleton does not have.

Z-Anatomy keeps the nasal cartilages in the skeletal collection, so every plate
that draws the skull draws a NOSE on it — a soft, rounded tip sitting on the
bone, which is the one thing in the picture that is not skeleton. The ear
cartilages are the same: a skull with ears.

The LARYNX is the same fault one storey down: the thyroid, cricoid, arytenoid
and corniculate cartilages hang in front of the cervical spine on every plate
that shows the neck, a box of soft tissue no skeletal atlas draws, and on an
anterior view it sits over the C4-C6 bodies. renderRegionsWithBones.py had
already dropped all three groups by name since ad8bb3d; this list now matches
it, so every renderer draws the same skeleton. The hyoid is bone and stays.

The costal cartilages stay. They are cartilage too, but they complete the rib
cage, they are where several muscles attach, and a rib that stops in mid-air is
the fault they fix. So this is a named list, not a rule about the word.
"""
NOT_BONE = (
    "Major alar cartilage",
    "Nasal septal cartilage",
    "Lateral process of nasal septal cartilage",
    "Nasal cartilages",
    "Cartilages of ear",
    "Thyroid cartilage",
    "Cricoid cartilage",
    "Arytenoid cartilage",
    "Corniculate cartilage",
    "Laryngeal cartilages",
)


def is_bone(name):
    """False for a mesh in the skeletal collection that is not skeleton.

    `.g` is the collection's own title text, which sits beside the body and
    prints "SYSTEM" at the edge of any wide frame.
    """
    if name.endswith(".g"):
        return False
    base = name.rsplit(".", 1)[0] if "." in name else name
    return base not in NOT_BONE and name not in NOT_BONE


def setup_world(scene):
    """A dim white world. Returns the background node for callers that want it."""
    configure_eevee(scene)
    scene.world = bpy.data.worlds.new("BoneLookWorld")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
        bg.inputs[1].default_value = WORLD_STRENGTH
    return bg


def add_lights(scene):
    """The key and fill. Aim them with `aim_lights` after moving the camera."""
    sun = bpy.data.objects.new("bonelook_key", bpy.data.lights.new("bonelook_key", type="SUN"))
    sun.data.energy = 5.0 if V2 else 4.0
    # Look 1: a soft-edged shadow, not a hard cut-out. Look 2: crisp enough
    # that a clavicle's shadow lands visibly on the acromion behind it.
    sun.data.angle = math.radians(3 if V2 else 12)
    if V2:
        for attr, val in (("use_contact_shadow", True), ("contact_shadow_distance", 0.02),
                          ("contact_shadow_thickness", 0.004), ("shadow_soft_size", 0.0)):
            try:
                setattr(sun.data, attr, val)
            except (AttributeError, TypeError):
                pass
    scene.collection.objects.link(sun)

    fill = bpy.data.objects.new("bonelook_fill", bpy.data.lights.new("bonelook_fill", type="SUN"))
    fill.data.energy = 0.3 if V2 else 0.6
    fill.data.use_shadow = False
    scene.collection.objects.link(fill)
    return sun, fill


def aim_lights(cam, sun, fill):
    """Point both lights in the camera's frame. Call after every camera move."""
    q = cam.rotation_euler.to_quaternion()
    for ob, d in ((sun, KEY_DIR), (fill, FILL_DIR)):
        ob.rotation_euler = (q @ mathutils.Vector(d)).to_track_quat("-Z", "Y").to_euler()


def bone_material(name="bonelook_bone"):
    """Pale bone with its hollows darkened by ambient occlusion."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = BONE_COLOUR
    bsdf.inputs["Roughness"].default_value = 0.5

    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 16
    ao.inputs["Distance"].default_value = 0.05 if V2 else 0.02
    ao.inputs["Color"].default_value = (0.80, 0.76, 0.68, 1)
    # Gamma pulls the occlusion back out of the midtones so only the genuine
    # hollows darken; without it the whole bone goes muddy. Look 2 keeps more
    # of it, because the gap between two bones IS a genuine hollow.
    gamma = nt.nodes.new("ShaderNodeGamma")
    gamma.inputs["Gamma"].default_value = 1.6 if V2 else 3.0
    nt.links.new(ao.outputs["Color"], gamma.inputs["Color"])
    if V2:
        out = _multiply(nt, gamma.outputs["Color"], _tone_multiplier(nt))
        nt.links.new(out, bsdf.inputs["Base Color"])
    else:
        nt.links.new(gamma.outputs["Color"], bsdf.inputs["Base Color"])

    mat.diffuse_color = (0.90, 0.87, 0.80, 1)  # what Workbench draws
    return mat


def outline_lineset(scene, collection, thickness=1.1, colour=(0.42, 0.36, 0.28)):
    """A Freestyle pass over one collection, for separating touching bones.

    Two adjacent carpals of the same colour share no shading event at their
    boundary, so no amount of lighting will divide them; an edge will. Keep
    the objects to be outlined in `collection`, and leave
    `scene.render.use_freestyle` FALSE except on the renders a student sees —
    a line on a mask grows its traced polygon by the line's own width.
    """
    scene.render.line_thickness_mode = "ABSOLUTE"
    scene.render.line_thickness = thickness
    vl = scene.view_layers[0]
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    fs.use_culling = True
    for old in list(fs.linesets):
        fs.linesets.remove(old)
    ls = fs.linesets.new("bonelook")
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_contour = True
    ls.select_crease = True
    ls.select_by_collection = True
    ls.collection = collection
    ls.linestyle.color = colour
    ls.linestyle.thickness = thickness
    # Look 2 draws no lines: the user wants bones told apart by light alone.
    ls.show_render = not V2
    return ls


def smooth(mesh):
    """Smooth shading changes how a surface catches light, not where its edge
    is — so it is safe on a mask mesh too, and the silhouette a hotspot is
    traced from is identical either way."""
    for poly in mesh.polygons:
        poly.use_smooth = True
    return mesh


def tissue_material(name, colour, roughness=0.55, occlusion=True):
    """Look 2 for soft tissue: the plate colour, a per-structure tone and a
    mild occlusion in the grooves between two muscles. The occlusion is held
    back further than on bone (gamma 2.2): on a dark red base the bone's
    amount came out near black (see REST_MAT in renderMusclePlates.py)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = colour
    if not V2:
        bsdf.inputs["Base Color"].default_value = colour
        return mat
    src = None
    if occlusion:
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.samples = 16
        ao.inputs["Distance"].default_value = 0.03
        ao.inputs["Color"].default_value = colour
        gamma = nt.nodes.new("ShaderNodeGamma")
        gamma.inputs["Gamma"].default_value = 2.2
        nt.links.new(ao.outputs["Color"], gamma.inputs["Color"])
        src = gamma.outputs["Color"]
    out = _multiply(nt, src, _tone_multiplier(nt), a_colour=colour)
    nt.links.new(out, bsdf.inputs["Base Color"])
    return mat
