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

# The world is nearly off. This single number is most of the difference
# between a modelled bone and a grey cut-out.
WORLD_STRENGTH = 0.12

# Where the light travels, in the CAMERA's own axes (x right, y up, -z away
# from the lens).
KEY_DIR = (0.62, -0.62, -0.48)
FILL_DIR = (-0.75, 0.25, -0.6)

BONE_COLOUR = (0.90, 0.88, 0.83, 1)
"""Base colour before occlusion darkens the hollows."""


"""Things filed under "1: Skeletal system" that a skeleton does not have.

Z-Anatomy keeps the nasal cartilages in the skeletal collection, so every plate
that draws the skull draws a NOSE on it — a soft, rounded tip sitting on the
bone, which is the one thing in the picture that is not skeleton. The ear
cartilages are the same: a skull with ears.

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
    sun.data.energy = 4.0
    sun.data.angle = math.radians(12)  # a soft-edged shadow, not a hard cut-out
    scene.collection.objects.link(sun)

    fill = bpy.data.objects.new("bonelook_fill", bpy.data.lights.new("bonelook_fill", type="SUN"))
    fill.data.energy = 0.6
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
    ao.inputs["Distance"].default_value = 0.02
    ao.inputs["Color"].default_value = (0.80, 0.76, 0.68, 1)
    # Gamma pulls the occlusion back out of the midtones so only the genuine
    # hollows darken; without it the whole bone goes muddy.
    gamma = nt.nodes.new("ShaderNodeGamma")
    gamma.inputs["Gamma"].default_value = 3.0
    nt.links.new(ao.outputs["Color"], gamma.inputs["Color"])
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
    return ls


def smooth(mesh):
    """Smooth shading changes how a surface catches light, not where its edge
    is — so it is safe on a mask mesh too, and the silhouette a hotspot is
    traced from is identical either way."""
    for poly in mesh.polygons:
        poly.use_smooth = True
    return mesh
