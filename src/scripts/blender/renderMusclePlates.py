"""Renders every muscle as a twelve-frame turntable, in context, in the shared look.

WHAT THIS REPLACES. public/anatomy/panels/: one flat frame per muscle, at a
lower resolution, lit by renderMusclePanels.py's own rig, drawn as a single red
muscle on a bare skeleton. Every other family the app asks about — bones,
sub-regions, landmarks, ligaments, joints — is drawn by a script that calls
boneLook.py and turns on a thirty-degree turntable. The muscles were the last
122 structures on the old pictures.

THREE THINGS ARE DIFFERENT, and each is something the user asked for:

  THE SAME LOOK AS THE BONES. boneLook.py, unchanged: a dim world, a key over
  the viewer's left shoulder fixed to the camera, ambient occlusion in the base
  colour, and the Workbench line pass inked over the top. The bones in a muscle
  plate are the same bones as in a joint plate, because they are rendered by
  the same recipe — which is the whole point of that module.

  THE MUSCLE IN CONTEXT. Every other muscle in frame is drawn too. On the
  context render they all wear the same red, so a locate question is a real
  question; on the highlight render the target goes cyan — the colour every
  other family highlights with — and the neighbours drop to a quiet grey, which
  is the identify picture and the atlas picture both.

  THE SUPERFICIAL LAYER COMES OFF A DEEP MUSCLE. `layer: 1` in the spec means
  the muscles in front of this one are not drawn. Without it subscapularis is a
  picture of a scapula, which is exactly why the 48 muscles in
  deep-muscles.mapping.json have no hotspot on the region plates.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderMusclePlates.py -- \
      --spec muscle-plates.spec.json --out renders/muscles \
      --muscles deltoid,subscapularis --samples 48

Four renders per frame, the same four the ligament plates produce and
publishLigamentPlates.ts reads: context (no highlight, for locate), highlight
(for identify and the atlas), mask (the target's silhouette, for the hotspot)
and ids (every neighbour in its own flat colour, so a tap on the wrong muscle
can be named), with ids.json as the legend.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import boneLook

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--spec", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1500)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--margin", type=float, default=1.45,
                help="camera frame as a multiple of the muscle's own span, floored by the spec's minFrame")
ap.add_argument("--muscles", default="", help="comma-separated keys; default every muscle in the spec")
ap.add_argument("--angles", default="", help="comma-separated degrees; default every angle in the spec")
ap.add_argument("--lines", default="workbench", choices=["freestyle", "workbench"],
                help="what draws the edge between two touching muscles. Freestyle traces each muscle's "
                     "own silhouette and is the better line; Workbench's object outline is drawn in the "
                     "line pass that already runs, and costs nothing")
ap.add_argument("--dry-run", action="store_true",
                help="work out each muscle's frame, twin and neighbours and print them, rendering "
                     "nothing — a minute that says what a four-hour run is about to draw")
ap.add_argument("--skip-existing", action="store_true",
                help="leave a frame alone when its ids.json already exists, so an interrupted run resumes")
a = ap.parse_args(argv)

spec = json.load(open(a.spec))
wanted = set(filter(None, (x.strip() for x in a.muscles.split(","))))
only_angles = set(int(x) for x in a.angles.split(",") if x.strip())

# ---------------------------------------------------------------- scene

scene = bpy.data.scenes.new("MuscleScene")
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

_bg = boneLook.setup_world(scene)

cam_data = bpy.data.cameras.new("musclecam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("musclecam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun, fill = boneLook.add_lights(scene)

# AgX rolls the highlights off and a pale bone is nearly all highlight; Standard
# keeps the range the lights make. Same choice as the ligament and joint plates.
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"

# The Workbench line pass: unlit, white, cavity only, so it draws the silhouette
# and the step in depth where one thing passes in front of another. Multiplied
# over the lit render it inks the picture.
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

# Contact shadow where a muscle meets bone, which is what makes it sit ON the
# bone rather than float. EEVEE renames these between versions.
for attr, val in (("use_gtao", True), ("gtao_distance", 0.02), ("use_shadows", True),
                  ("use_fast_gi", True), ("fast_gi_distance", 0.03)):
    try:
        setattr(scene.eevee, attr, val)
    except (AttributeError, TypeError):
        pass

# OUTLINES ON THE MUSCLES ONLY. Two red muscles lying against each other share
# no shading event at their boundary, so no amount of lighting divides them; an
# edge does. The bones get their edges from the Workbench pass instead, so a
# second lineset over them only drew stray ticks at every crease.
muscle_coll = bpy.data.collections.new("muscle_outlined")
scene.collection.children.link(muscle_coll)
bone_coll = bpy.data.collections.new("muscle_bones")
scene.collection.children.link(bone_coll)
scene.render.use_freestyle = True
scene.render.line_thickness_mode = "ABSOLUTE"
scene.render.line_thickness = 1.5
_vl = scene.view_layers[0]
_vl.use_freestyle = True
_fs = _vl.freestyle_settings
_fs.use_culling = True
for _old in list(_fs.linesets):
    _fs.linesets.remove(_old)
_ls = _fs.linesets.new("muscles")
_ls.select_silhouette = True
_ls.select_border = True
_ls.select_contour = True
_ls.select_crease = False
_ls.select_by_collection = True
_ls.collection = muscle_coll
_ls.linestyle.color = (0.22, 0.06, 0.06)
_ls.linestyle.thickness = 1.5
# FREESTYLE IS MOST OF THE TIME A FRAME TAKES. On a shoulder plate with 34
# muscles in it, tracing every one of them put a lit render at 14 seconds
# against 4 for the same scene without: two thirds of a ten-hour run spent on
# the lines. The Workbench pass already draws an outline around every object
# and costs a third of a second, so it can do the same job if it looks as good.
FREESTYLE = a.lines == "freestyle"
_ls.show_render = FREESTYLE

EEVEE_ENGINE = scene.render.engine

# ---------------------------------------------------------------- materials


def principled(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = colour
    return mat


BONE_MAT = boneLook.bone_material("muscle_plate_bone")

# MUSCLE RED, AND LIGHTER THAN THE TISSUE ACTUALLY IS. The first pass used a
# deep (0.62,0.21,0.20) with ambient occlusion multiplied in, on the reasoning
# that it is what bone does. On bone that works because the base is a 0.90
# ivory with room to darken; a dark red under the same dim world and the same
# occlusion came out near black, and a shoulder plate read as one brown lump
# with no muscle in it distinguishable from the next. The occlusion is gone —
# the Workbench pass already inks the creases and the seam between two touching
# muscles — and the red is a plate red rather than a cadaver red.
#
# The values are picked from measured output, not from taste: with this key and
# this world a lit face comes back at roughly (245R, 375G, 406B) times the base,
# so a lit face comes back at very close to the base colour read as LINEAR
# light: (0.45,0.09,0.07) renders as about #B4564A where the key falls and
# #83372F in the shade, against the bones' #ACA08A. Guessing at this twice
# produced a plate of black meat and then a plate of pink skin, so the values
# are measured from a render each time they move.
REST_MAT = principled("muscle_rest", (0.45, 0.09, 0.07, 1), 0.55)
# THE HIGHLIGHT IS THE APP'S HIGHLIGHT. Cyan, the same value the ligament
# plates and the landmark markers use, so "the highlighted structure" looks the
# same whichever family the question is about.
HILITE_MAT = principled("muscle_hilite", (0.0, 0.72, 0.95, 1), 0.45)
try:
    _hb = HILITE_MAT.node_tree.nodes["Principled BSDF"]
    _hb.inputs["Emission Color"].default_value = (0.0, 0.85, 1.0, 1)
    _hb.inputs["Emission Strength"].default_value = 0.35
except KeyError:
    pass
# On the highlight render the neighbours go quiet, so the answer stands out.
# The context render keeps them all alike — a locate question must not give
# the target away by colour.
MUTED_MAT = principled("muscle_muted", (0.67, 0.37, 0.32, 1), 0.55)


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


MASK_MAT = flat_emission("muscle_mask", (1, 1, 1, 1))
BLACK_MAT = flat_emission("muscle_id_black", (0, 0, 0, 1))


def id_colour(i):
    """Index 1..255 as a flat colour, decodable from the PNG: red carries the
    low four bits, green the high four, at sixteen even LINEAR levels. Same
    encoding as the ligament plates, so the same packer reads it."""
    return ((i % 16) / 15.0, (i // 16) / 15.0, 0.0, 1.0)


# ---------------------------------------------------------------- geometry


def bake(names, mesh_name):
    """One world-space mesh from a list of object names."""
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
    # The .l meshes are mirrored copies with their normals pointing inward;
    # lit properly, half the body would shade inside-out.
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    if len(mesh.polygons):
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
        mesh.set_sharp_from_angle(angle=math.radians(50))
    return mesh


def mesh_bbox(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def world_box(name):
    ob = bpy.data.objects.get(name)
    if not ob or ob.type != "MESH" or not ob.data.vertices:
        return None
    pts = [ob.matrix_world @ mathutils.Vector(c) for c in ob.bound_box]
    return ([min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)])


# The least a frame may be, as a multiple of the muscle's own span: all of it,
# plus a little of the bone at each end so a student can see what it pulls on.
FULL_MUSCLE = 1.06


def frame_size(span, margin, min_frame):
    """NO CEILING, unlike the ligament plates, but LESS SLACK THE LONGER THE
    MUSCLE IS.

    A ligament is a band across one joint, so framing it at its area's full size
    made an 11mm strap a sliver; a muscle IS the length of its segment, and its
    own span is already the right picture. The floor is what stops opponens
    pollicis from being 20mm of thenar eminence with no hand around it.

    The slack has to taper, though. Half the margin of a 45mm muscle is 20mm of
    context; half the margin of longissimus, which runs 669mm from the skull to
    the sacrum, is 150mm of empty air at each end — the dry run framed it at
    970mm, a whole body with a thread down the back of it, and baked 625 bones
    to draw it. Above 200mm the margin falls away to almost nothing, so a long
    muscle is framed at its own length and a short one still gets its context.
    """
    if span > 0.20:
        margin = max(1.08, margin - (span - 0.20) * 0.9)
    return max(span * margin, min_frame, span * FULL_MUSCLE)


def in_frame(centre, size, names, exclude, skip_side):
    """Every named object whose bounding box overlaps the camera's cube.

    THE FAR LIMB IS NOT CONTEXT, which renderMusclePanels.py learned the hard
    way: a frame deep enough to reach the elbow has the near femur standing
    beside the hand in it. A plate framed on one side shows that side; the
    axial skeleton carries no suffix and is unaffected.
    """
    half = size / 2
    found = []
    for n in names:
        if n in exclude:
            continue
        if skip_side and n.endswith(skip_side):
            continue
        box = world_box(n)
        if box and all(box[0][i] <= centre[i] + half and box[1][i] >= centre[i] - half for i in range(3)):
            found.append(n)
    return found


def frame_camera(lo, hi, angle_deg, margin, min_frame):
    centre = mathutils.Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
    span = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    size = frame_size(span, margin, min_frame)
    dist = size * 8 + 0.5
    theta = math.radians(angle_deg)
    cam.location = centre + mathutils.Vector((-dist * math.sin(theta), -dist * math.cos(theta), 0.0))
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = size
    boneLook.aim_lights(cam, sun, fill)


# ---------------------------------------------------------------- rendering


def clear():
    for coll in (scene.collection, muscle_coll, bone_coll):
        for ob in list(coll.objects):
            if ob not in (cam, sun, fill):
                coll.objects.unlink(ob)


def link(mesh, name, material, holdout=False, outlined=False, boned=False):
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.clear()
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.material_index = 0
    ob.is_holdout = holdout
    (muscle_coll if outlined else bone_coll if boned else scene.collection).objects.link(ob)
    return ob


def multiply_lines(path, line_path):
    """Multiplies the Workbench line pass over the lit render, where there is
    something under it — its transparent background would eat the edge."""
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


def render_to(path, outlines=True, samples=None):
    """outlines=True is a picture a student sees: it gets the muscle outlines
    and the line pass. The mask and ID renders pass False — a line would widen
    the traced hotspot by its own width."""
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    scene.render.engine = EEVEE_ENGINE
    scene.render.use_freestyle = outlines and FREESTYLE
    # A MASK NEEDS NO SAMPLES. It is one flat emission against holdouts, so the
    # only thing more samples buy is a smoother anti-aliased edge — and eight
    # already gives that. At the lit renders' count it was the third of the
    # frame's time that bought nothing.
    was = scene.eevee.taa_render_samples
    if samples:
        scene.eevee.taa_render_samples = samples
    try:
        bpy.ops.render.render(write_still=True)
    finally:
        scene.eevee.taa_render_samples = was
    if outlines:
        line_path = path[:-4] + ".lines.png"
        scene.render.filepath = line_path
        scene.render.use_freestyle = False
        scene.render.engine = "BLENDER_WORKBENCH"
        try:
            bpy.ops.render.render(write_still=True)
        finally:
            scene.render.engine = EEVEE_ENGINE
        multiply_lines(path, line_path)


def render_ids(path, bones_mesh, parts):
    """One render where every muscle is its own flat colour, so a tap on the
    wrong muscle can be named. parts: list of (index, mesh)."""
    clear()
    link(bones_mesh, "id_bones", BLACK_MAT)
    for idx, m in parts:
        link(m, "id_%d" % idx, flat_emission("muscle_id_%d" % idx, id_colour(idx)))
    saved = (scene.eevee.taa_render_samples, scene.render.dither_intensity,
             _bg.inputs[1].default_value if _bg else None)
    scene.eevee.taa_render_samples = 1
    scene.render.dither_intensity = 0.0
    if _bg:
        _bg.inputs[1].default_value = 0.0
    try:
        render_to(path, outlines=False)
    finally:
        scene.eevee.taa_render_samples = saved[0]
        scene.render.dither_intensity = saved[1]
        if _bg and saved[2] is not None:
            _bg.inputs[1].default_value = saved[2]


# ---------------------------------------------------------------- the atlas

skel = bpy.data.collections.get("1: Skeletal system")
# boneLook.is_bone drops two kinds of mesh the skeletal collection carries and a
# skeleton does not: the collection's own title text, which prints "SYSTEM" at
# the edge of any wide frame, and the nasal and ear cartilages, which put a nose
# and a pair of ears on the skull.
bone_names = [o.name for o in skel.all_objects if o.type == "MESH" and boneLook.is_bone(o.name)]

# The meshes the skeletal collection carries that a skeleton does not. Only
# used to report, on a dry run, which plates were drawing a nose.
not_bone = [o.name for o in skel.all_objects
            if o.type == "MESH" and not o.name.endswith(".g") and not boneLook.is_bone(o.name)]
print("[atlas] %d bone meshes, %d non-bone mesh(es) dropped" % (len(bone_names), len(not_bone)), flush=True)

entries = [e for e in spec["muscles"] if not wanted or e["key"] in wanted]
if wanted:
    missing = wanted - {e["key"] for e in spec["muscles"]}
    for m in sorted(missing):
        print("[warn] %s: not in the spec" % m, flush=True)

# Who owns each muscle object, and how deep it is.
#
# ONLY THE MUSCLES THE APP KNOWS ARE DRAWN, which is the spec's 122 and no more.
# Sweeping the atlas's muscular system collection instead put the wrong things
# in the picture twice over: the collection whose name matches "muscular" first
# is "2: Muscular insertions", 705 little markers, and the real one — "4:
# Muscular system" — carries 133 objects that are not muscle at all, among them
# fascia lata and the thoracolumbar fascia, sheets that would be painted muscle
# red over the whole thigh and back. Drawing only what the spec names also means
# every muscle in a picture is one a tap can be graded against.
owner = {}
layer_of = {}
for e in spec["muscles"]:
    for n in e["objects"] + e["twins"]:
        owner[n] = e["key"]
        layer_of[n] = e["layer"]
atlas_muscles = sorted(owner)
missing = [n for n in atlas_muscles if bpy.data.objects.get(n) is None]
print("[atlas] %d muscle mesh(es) named by the spec, %d missing from the blend"
      % (len(atlas_muscles), len(missing)), flush=True)
for n in missing[:10]:
    print("[warn] the spec names '%s', the blend does not" % n, flush=True)

t0 = time.time()
count = 0

for entry in entries:
    key = entry["key"]
    own = list(entry["objects"])
    target_mesh = bake(own, "m_target_" + key)
    if not target_mesh.vertices:
        print("[warn] %s: empty bake, skipped" % key, flush=True)
        bpy.data.meshes.remove(target_mesh)
        continue
    lo, hi = mesh_bbox(target_mesh)
    centre = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
    span = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    frame = frame_size(span, a.margin, entry["minFrame"])
    side = entry.get("side")
    other_side = (".r" if side == ".l" else ".l") if side else None

    # BOTH SIDES, WHERE BOTH ARE IN SHOT. The camera is framed on the left copy,
    # but a hip or a spine frame holds the right copy too, and then it is part
    # of the answer rather than a neighbour: highlighted with the target, traced
    # into the target's mask, never offered as a wrong answer. Same rule as the
    # ligament twins and the joints the user set it for.
    twins = in_frame(centre, frame, entry["twins"], set(), None)
    if twins:
        print("[twin] %s: %s" % (key, ", ".join(twins)), flush=True)
        bpy.data.meshes.remove(target_mesh)
        own = own + twins
        target_mesh = bake(own, "m_target_" + key)
        lo, hi = mesh_bbox(target_mesh)
        centre = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
        span = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
        frame = frame_size(span, a.margin, entry["minFrame"])
        # A TWINNED PLATE IS A MIDLINE PLATE, so the far side stops being "the
        # far limb" and becomes half the picture. Dropping it is right for a
        # deltoid, where the other arm would walk into the edge of shot; on the
        # trapezius it left both trapezii highlighted above one arm and one bare
        # shoulder, which reads as a render that failed. If the twin is in
        # frame, everything on that side is.
        other_side = None

    # WHETHER THIS IS A MIDLINE PLATE decides what its angles are called: a
    # plate with both sides in it has no medial view (lib/viewForAngle.ts). The
    # publisher cannot work it out — the twin test needs the geometry — so it is
    # written down here, beside the frames it describes.
    os.makedirs(os.path.join(a.out, key), exist_ok=True)
    with open(os.path.join(a.out, key, "meta.json"), "w") as f:
        json.dump({"midline": bool(twins) or not side}, f)

    mine = set(own) | set(entry["twins"])
    # THE SUPERFICIAL LAYER COMES OFF A DEEP MUSCLE, and stays on a superficial
    # one. Two layers, not a per-angle occlusion test: which layer a muscle is
    # in is a property of the body, and dropping whatever happens to stand
    # between the camera and the target at this angle would draw pectoralis
    # major from behind through a stripped chest.
    # A named cutaway goes whatever its depth: a sheet that wraps this muscle
    # rather than lying over it, like the rectus sheath (generateMusclePlateSpec).
    hidden = set(entry.get("hide", []))
    drawable = [n for n in atlas_muscles
                if n not in mine and layer_of.get(n, 0) >= entry["layer"]
                and owner.get(n) not in hidden]
    neighbours = in_frame(centre, frame, drawable, set(), other_side)

    # One mesh per NEIGHBOURING MUSCLE, not per object: a muscle with two
    # bellies or three heads is one answer, so its hotspot has to be one
    # hotspot and its outline one outline.
    by_owner = {}
    for n in neighbours:
        by_owner.setdefault(owner[n], []).append(n)
    parts = []
    for nkey in sorted(by_owner):
        m = bake(by_owner[nkey], "m_nb_" + key + "_" + nkey)
        if m.vertices:
            parts.append((nkey, m))
        else:
            bpy.data.meshes.remove(m)

    kept_bones = in_frame(centre, frame, bone_names, set(), other_side)
    if a.dry_run and in_frame(centre, frame, not_bone, set(), other_side):
        # This plate had a nose (or a pair of ears) on its skull before
        # boneLook.is_bone started dropping them, so it needs re-rendering.
        print("[nose] " + key, flush=True)
    bones = bake(kept_bones, "m_bones_" + key)
    # Every neighbour in one mesh, for holding the mask out in a single object.
    others_mesh = bake(neighbours, "m_others_" + key) if neighbours else None

    print("[muscle] %s: %.0fmm across, frame %.0fmm, %d neighbour(s), %d bone(s)%s"
          % (key, span * 1000, frame * 1000, len(parts), len(kept_bones),
             ", superficial layer removed" if entry["layer"] else ""), flush=True)

    for angle in (entry["angles"] if not a.dry_run else []):
        if only_angles and angle not in only_angles:
            continue
        leaf = os.path.join(a.out, key, "a%03d" % angle)
        if a.skip_existing and os.path.exists(os.path.join(leaf, "ids.json")):
            print("[skip] %s a%03d: already rendered" % (key, angle), flush=True)
            continue
        frame_camera(lo, hi, angle, a.margin, entry["minFrame"])

        clear()
        link(bones, "ctx_bones", BONE_MAT, boned=True)
        for nkey, m in parts:
            link(m, "ctx_" + nkey, REST_MAT, outlined=True)
        link(target_mesh, "ctx_target", REST_MAT, outlined=True)
        render_to(os.path.join(leaf, "context.png"))

        clear()
        link(bones, "hl_bones", BONE_MAT, boned=True)
        for nkey, m in parts:
            link(m, "hl_" + nkey, MUTED_MAT, outlined=True)
        link(target_mesh, "hl_target", HILITE_MAT, outlined=True)
        render_to(os.path.join(leaf, "highlight.png"))

        # The bones and the other muscles HOLD THE MASK OUT rather than hiding
        # it, so a muscle that disappears behind a condyle or under a neighbour
        # is missing from the hotspot too: the target can only ever be the part
        # a student can actually see and tap.
        clear()
        link(bones, "msk_bones", BONE_MAT, holdout=True)
        if others_mesh:
            link(others_mesh, "msk_others", BONE_MAT, holdout=True)
        link(target_mesh, "msk_target", MASK_MAT)
        render_to(os.path.join(leaf, "mask.png"), outlines=False, samples=8)

        render_ids(os.path.join(leaf, "ids.png"), bones,
                   [(1, target_mesh)] + [(i + 2, m) for i, (_, m) in enumerate(parts)])
        # The legend names index 1 with the muscle's own NAME and the neighbours
        # with their STRUCTURE IDS — unlike the ligament plates, whose legend
        # carries Blender object names the publisher then has to map back. Here
        # the grouping into structures has already happened, above.
        with open(os.path.join(leaf, "ids.json"), "w") as f:
            json.dump({"1": entry["name"]} | {str(i + 2): nkey for i, (nkey, _) in enumerate(parts)}, f)
        count += 4

    bpy.data.meshes.remove(target_mesh)
    bpy.data.meshes.remove(bones)
    if others_mesh:
        bpy.data.meshes.remove(others_mesh)
    for _, m in parts:
        bpy.data.meshes.remove(m)

print("[complete] %d renders -> %s (%.0fs)" % (count, a.out, time.time() - t0), flush=True)
