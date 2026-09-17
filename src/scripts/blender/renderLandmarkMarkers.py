"""Renders landmark images: the skeleton framed on a landmark, and where it lands.

WHY LANDMARKS NEED THEIR OWN RENDERER. A landmark is not separable geometry.
The greater tubercle is a region of the humerus, not an object, so Z-Anatomy
models it as a label anchor — a `.j` mesh of a vertex or two sitting on the bone
surface. Anchors cannot be highlighted (there is nothing to fill), which is why
104 landmarks were left with only an AI-generated slide.

But a `.j` anchor carries a real position (see ANCHOR_SUFFIXES in
generateSkeletalMapping.ts), and a position is exactly what a landmark is. So
this renders the skeleton plainly, framed on the landmark, and records where the
anchor lands on screen. landmarkMarkers.ts then draws a ring there for identify
questions and emits a small circle for locate — the same way a textbook marks a
point on a bone, and the same shape the joint references use.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderLandmarkMarkers.py -- \
      --spec landmark-markers.spec.json --out renders/landmarks --views 0,6,12

A POINT ON THE FAR SIDE OF A BONE IS NOT VISIBLE. The ASIS seen from behind is
inside the pelvis. Each view casts a ray from the camera to the anchor, and if
anything is hit meaningfully before it, the view is recorded as hidden — a
marker drawn over the wrong face of a bone would teach the wrong surface.
"""
import bpy, json, sys, os, re, math, argparse, mathutils, bmesh
from mathutils import kdtree
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--spec", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--only", default="", help="comma-separated landmark ids")
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--frame", type=float, default=0.9,
                help="frame width as a fraction of the parent bone's largest dimension")
ap.add_argument("--pull", type=float, default=0.5,
                help="where the camera aims, from the bone's centre (0) to the landmark (1)")
ap.add_argument("--zoom", type=float, default=25.0,
                help="frame width as a multiple of the landmark's radius")
ap.add_argument("--max-snap", type=float, default=0.5,
                help="reject an anchor further than this fraction of the bone from it")
ap.add_argument("--regions", default="landmark-regions.rules.json",
                help="rules for landmarks that are a traced REGION rather than a point")
ap.add_argument("--subdivide", type=int, default=2,
                help="times to cut each triangle of a region's parent bone before selecting")
ap.add_argument("--region-context", type=float, default=2.4,
                help="frame width as a multiple of the region's own extent")
ap.add_argument("--min-frame", type=float, default=0.15,
                help="metres the picture must span, however small the landmark; below this a "
                     "landmark cannot be identified because nothing around it is in shot")
ap.add_argument("--look", default="studio", choices=["flat", "studio"],
                help="how the bone is lit and shaded; 'flat' is the old even grey")
a = ap.parse_args(argv)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from landmarkRegions import select_faces  # noqa: E402

REGION_RULES = {}
# Which angles a landmark is photographed from, where the default three are
# wrong for it: the sustentaculum tali is a medial shelf that a posterior view
# never shows, and the intertrochanteric line is invisible from the side.
# Angle indices as for --views (x15 degrees): 0 anterior, 6 lateral, 12
# posterior, 18 medial.
VIEW_OVERRIDES = {}
# Landmarks that exist on BOTH sides of the body. The atlas names one anchor
# for "the pedicle"; the picture shows two, and the reviewer's rule is that
# every symmetrical structure gets a target each side. A list rather than a
# test on the anchor's distance from the midline, because several midline
# anchors (the sacral apex, the sacral base) sit a centimetre off it.
TWINS = set()
# Parent bones whose superior view is drawn anterior-up, to match the plates
# the reviewer works from.
TOP_FLIP = set()
# Extra bones shown with an isolated one, where the landmark is the gap
# BETWEEN bones: an intervertebral foramen does not exist on one vertebra.
ISOLATE_WITH = {}
# Landmarks isolated one at a time, where the PARENT does not want isolating but
# this one landmark on it does. The sacral canal is the only one: it opens
# upwards at the sacral base, L5 sits on that base, and with the skeleton in the
# scene the fifth lumbar vertebra is between the camera and the opening from the
# one angle the opening is an opening from.
ISOLATE_IDS = set()
if os.path.exists(a.regions):
    _rules = json.load(open(a.regions))
    REGION_RULES = {k: v for k, v in _rules.items() if not k.startswith("_")}
    VIEW_OVERRIDES = _rules.get("_views", {})
    TWINS = set(_rules.get("_twins", {}).get("ids", []))
    TOP_FLIP = set(_rules.get("_topFlip", {}).get("parents", []))
    ISOLATE_WITH = {k: v for k, v in _rules.get("_isolateWith", {}).items() if not k.startswith("_")}
    ISOLATE_IDS = set(_rules.get("_isolate", {}).get("ids", []))
    print(f"[regions] {len(REGION_RULES)} landmark(s) have a traced region, "
          f"{len(VIEW_OVERRIDES)} have their own views", flush=True)

spec = json.load(open(a.spec))
wanted = set(filter(None, a.only.split(","))) or {s["id"] for s in spec["landmarks"]}
views = [int(v) for v in a.views.split(",")]

scene = bpy.data.scenes.new("LandmarkScene")
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

# THE AMBIENT LIGHT IS WHAT FLATTENED THE BONES. A white world at 0.55 lit every
# face from every side, so a fossa was as bright as the ridge beside it and a
# vertebra read as a grey silhouette with nothing on it to find. Relief comes
# from a dim world and a key light raking across the surface.
WORLD_STRENGTH = 0.55 if a.look == "flat" else 0.12
scene.world = bpy.data.worlds.new("LandmarkWorld")
scene.world.use_nodes = True
_bg = scene.world.node_tree.nodes.get("Background")
if _bg:
    _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    _bg.inputs[1].default_value = WORLD_STRENGTH

cam_data = bpy.data.cameras.new("landmarkcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("landmarkcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun = bpy.data.objects.new("landmarksun", bpy.data.lights.new("landmarksun", type="SUN"))
sun.data.energy = 3.0 if a.look == "flat" else 4.0
scene.collection.objects.link(sun)
fill = bpy.data.objects.new("landmarkfill", bpy.data.lights.new("landmarkfill", type="SUN"))
fill.data.energy = 0.6
fill.data.use_shadow = False
scene.collection.objects.link(fill)
fill.hide_render = a.look == "flat"
if a.look != "flat":
    sun.data.angle = math.radians(12)   # a soft-edged shadow, not a hard cut-out

# Where the light travels, in the CAMERA's own axes (x right, y up, -z away
# from the lens). Fixed to the camera rather than the world, because a sun
# fixed in the world is a raking light from the front and a flat frontal one
# from above — which is exactly the view a vertebra is shown from. The key
# comes over the viewer's left shoulder, the convention of every anatomical
# plate; the fill lifts the shadow side from the lower right.
KEY_DIR = (0.62, -0.62, -0.48)
FILL_DIR = (-0.75, 0.25, -0.6)


def aim_lights():
    q = cam.rotation_euler.to_quaternion()
    for ob, d in ((sun, KEY_DIR), (fill, FILL_DIR)):
        ob.rotation_euler = (q @ mathutils.Vector(d)).to_track_quat("-Z", "Y").to_euler()


def principled(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


BONE_MAT = principled("landmark_bone", (0.90, 0.88, 0.83, 1), 0.6)
if a.look == "studio":
    # Darken the hollows. Ambient occlusion multiplied into the base colour is
    # what separates a foramen's rim from its floor and a process from the
    # arch behind it; the lights alone cannot, on a bone this pale.
    _nt = BONE_MAT.node_tree
    _bsdf = _nt.nodes["Principled BSDF"]
    _ao = _nt.nodes.new("ShaderNodeAmbientOcclusion")
    _ao.samples = 16
    _ao.inputs["Distance"].default_value = 0.02
    _ao.inputs["Color"].default_value = (0.80, 0.76, 0.68, 1)
    _gamma = _nt.nodes.new("ShaderNodeGamma")
    _gamma.inputs["Gamma"].default_value = 3.0
    _nt.links.new(_ao.outputs["Color"], _gamma.inputs["Color"])
    _nt.links.new(_gamma.outputs["Color"], _bsdf.inputs["Base Color"])
    _bsdf.inputs["Roughness"].default_value = 0.5
BONE_MAT.diffuse_color = (0.90, 0.87, 0.80, 1)   # what Workbench draws


def emission(name, colour):
    """Flat, unlit colour. A mask must not be shaded, or thresholding it turns
    the lighting into part of the traced shape."""
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


MASK_OFF = emission("landmark_mask_off", (0, 0, 0, 1))
MASK_ON = emission("landmark_mask_on", (1, 1, 1, 1))


def bake(object_names, mesh_name):
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
    if a.look != "flat":
        # The `.l` meshes are mirrored copies with their normals left pointing
        # inward; lit properly, half the skeleton would shade inside-out.
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    if a.look != "flat":
        # Smooth, but keep a real edge an edge: the atlas is a few hundred
        # faces, and flat-shaded its facets read as anatomy that is not there.
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
        mesh.set_sharp_from_angle(angle=math.radians(50))
    return mesh


def world_points(name):
    """An anchor's position is its vertices in world space, not its origin.

    The `.j` anchors carry one or two vertices at the landmark; their object
    origin is not guaranteed to sit anywhere meaningful.
    """
    ob = bpy.data.objects.get(name)
    if not ob or ob.type != "MESH" or not ob.data.vertices:
        return []
    return [ob.matrix_world @ v.co for v in ob.data.vertices]


def bbox_of(points):
    xs = [p.x for p in points]; ys = [p.y for p in points]; zs = [p.z for p in points]
    return mathutils.Vector((min(xs), min(ys), min(zs))), mathutils.Vector((max(xs), max(ys), max(zs)))


def place_camera(target, angle_deg, frame_size):
    theta = math.radians(angle_deg)
    dist = frame_size * 6 + 0.5
    offset = mathutils.Vector((-dist * math.sin(theta), -dist * math.cos(theta), 0))
    cam.location = target + offset
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = frame_size
    if a.look == "flat":
        sun.rotation_euler = mathutils.Euler((0.9, 0.3, 0.6 + theta), "XYZ")
    else:
        aim_lights()


def clear():
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun, fill):
            scene.collection.objects.unlink(ob)


EEVEE_ENGINE = scene.render.engine
if a.look != "flat":
    # AgX rolls the highlights off, and a bone is nearly all highlight: the
    # whole surface was compressed into one pale grey. Standard keeps the
    # light-to-shadow range the lights were set up to make.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
if a.look == "studio":
    # THE LINE PASS. Workbench, unlit and white, draws only what a draughtsman
    # would ink: the silhouette, the step in depth where one bone passes in
    # front of another, and the creases. Multiplied over the lit render it puts
    # an edge between the femoral head and the socket it sits in — two pale
    # surfaces that no amount of lighting separates.
    sh = scene.display.shading
    sh.light = "FLAT"
    sh.color_type = "SINGLE"
    sh.single_color = (1, 1, 1)
    sh.show_cavity = True
    sh.cavity_type = "BOTH"
    sh.cavity_ridge_factor = 0.0
    sh.cavity_valley_factor = 2.0
    sh.curvature_ridge_factor = 0.0
    sh.curvature_valley_factor = 1.6
    sh.show_shadows = False
    sh.show_object_outline = True
    sh.object_outline_color = (0.16, 0.13, 0.11)
    scene.display.render_aa = "16"


def multiply_lines(path, line_path):
    import numpy as np
    base = bpy.data.images.load(path)
    line = bpy.data.images.load(line_path)
    n = base.size[0] * base.size[1] * 4
    bpx = np.empty(n, dtype=np.float32); base.pixels.foreach_get(bpx)
    lpx = np.empty(n, dtype=np.float32); line.pixels.foreach_get(lpx)
    bpx = bpx.reshape(-1, 4); lpx = lpx.reshape(-1, 4)
    # Only where the line pass has bone under it; its transparent background
    # is black, and multiplying by that would eat the anti-aliased edge.
    k = lpx[:, 3:4]
    bpx[:, :3] *= lpx[:, :3] * k + (1 - k)
    base.pixels.foreach_set(bpx.ravel())
    base.filepath_raw = path
    base.file_format = "PNG"
    base.save()
    bpy.data.images.remove(base)
    bpy.data.images.remove(line)
    os.remove(line_path)


def render_to(path, beauty=False):
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    scene.render.engine = EEVEE_ENGINE
    bpy.ops.render.render(write_still=True)
    if beauty and a.look == "studio":
        line_path = path[:-4] + ".lines.png"
        scene.render.filepath = line_path
        scene.render.engine = "BLENDER_WORKBENCH"
        bpy.ops.render.render(write_still=True)
        scene.render.engine = EEVEE_ENGINE
        multiply_lines(path, line_path)


def contact_line(bone_mask_path, partner_mask_path, reach=4, samples=28):
    """Where the partner's visible pixels touch this bone's, as an ordered line.

    Both masks were rendered through the panel's camera with everything else
    black, so each is only what can be SEEN of its subject. The partner's
    pixels lying within `reach` px of the bone are the contact; they form an
    arc round the partner, so sorting by angle about the partner's centre puts
    them in order, and the widest angular gap is where the arc is open.
    """
    import numpy as np

    def load(path):
        img = bpy.data.images.load(os.path.abspath(path))
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        return px.reshape(h, w, 4)[::-1, :, 0] > 0.5   # row 0 at the top

    bone, part = load(bone_mask_path), load(partner_mask_path)
    if not bone.any() or not part.any():
        return None
    near = bone.copy()
    for _ in range(reach):
        grown = near.copy()
        grown[1:, :] |= near[:-1, :]; grown[:-1, :] |= near[1:, :]
        grown[:, 1:] |= near[:, :-1]; grown[:, :-1] |= near[:, 1:]
        near = grown
    ys, xs = np.nonzero(part & near)
    if len(xs) < 40:
        return None
    py, px_ = np.nonzero(part)
    cx, cy = px_.mean(), py.mean()
    ang = np.arctan2(ys - cy, xs - cx)
    order = np.argsort(ang)
    ang, xs, ys = ang[order], xs[order], ys[order]
    gaps = np.diff(np.concatenate([ang, [ang[0] + 2 * np.pi]]))
    start = (int(np.argmax(gaps)) + 1) % len(ang)
    xs, ys, ang = np.roll(xs, -start), np.roll(ys, -start), np.unwrap(np.roll(ang, -start))
    h, w = part.shape
    line = []
    for k in range(samples):
        lo = ang[0] + (ang[-1] - ang[0]) * k / samples
        hi = ang[0] + (ang[-1] - ang[0]) * (k + 1) / samples
        sel = (ang >= lo) & (ang <= hi)
        if sel.any():
            line.append([round(float(np.median(xs[sel])) / w, 5), round(float(np.median(ys[sel])) / h, 5)])
    for _ in range(2):
        line = [line[0]] + [[(line[i - 1][0] + 2 * line[i][0] + line[i + 1][0]) / 4,
                             (line[i - 1][1] + 2 * line[i][1] + line[i + 1][1]) / 4]
                            for i in range(1, len(line) - 1)] + [line[-1]]
    return [[round(x, 5), round(y, 5)] for x, y in line] if len(line) > 3 else None


def region_anchor_names(node, into=None):
    """Every `.j` a region rule mentions, however deeply nested in a point spec."""
    into = set() if into is None else into
    if isinstance(node, str):
        if node.endswith(".j"):
            into.add(node)
    elif isinstance(node, dict):
        for v in node.values():
            region_anchor_names(v, into)
    elif isinstance(node, list):
        for v in node:
            region_anchor_names(v, into)
    return into


def build_region(bone_name, rule, anchors):
    """The landmark's own surface, as a separate mesh sitting just proud of the bone.

    It is lifted along its normals by a fraction of a millimetre so that the
    mask pass draws it in front of the bone it was cut from instead of
    z-fighting with it — the whole skeleton has to stay in the scene for the
    mask, because a region hidden behind another bone must come out hidden.
    """
    ob = bpy.data.objects.get(bone_name)
    if not ob or ob.type != "MESH" or not ob.data.vertices:
        return None

    if rule.get("kind") == "plug":
        # A FORAMEN IS NOT BONE, so there are no faces to select: the target is
        # the opening. A ball is sunk into each hole, its top level with the
        # rim, and the mask pass does the rest — the bone around the opening
        # hides everything of the ball except what shows through it, so the
        # traced shape is the gap exactly as this camera sees it. That is the
        # reviewer's "make the 10/10 ring the size of the gap". Centres are
        # MEASURED (probeHoles.py casts a grid of rays at the bone and reports
        # where they fall through), in world millimetres.
        bm = bmesh.new()
        centres = []
        r = float(rule.get("radius", 0.006))
        radii = []
        for entry_ in rule["at"]:
            x, y, z = entry_[:3]
            # An optional fourth number is this ball's own radius in mm. A ball
            # the size of its hole can sit level with the rim — and so be seen
            # from the side — without spreading over the bone round the hole.
            own = entry_[3] / 1000.0 if len(entry_) > 3 else r
            centres.append(mathutils.Vector((x, y, z)) / 1000.0)
            radii.append(own)
            if rule.get("mirrorX"):
                centres.append(mathutils.Vector((-x, y, z)) / 1000.0)
                radii.append(own)
        for c, cr in zip(centres, radii):
            bmesh.ops.create_icosphere(bm, subdivisions=3, radius=cr,
                                       matrix=mathutils.Matrix.Translation(c))
        mesh = bpy.data.meshes.new("landmark_region")
        bm.to_mesh(mesh)
        bm.free()
        rlo, rhi = bbox_of(centres)
        pad = mathutils.Vector((r, r, r))
        return mesh, centres, rlo - pad, rhi + pad

    bm = bmesh.new()
    tmp = ob.data.copy()
    for v in tmp.vertices:
        v.co = ob.matrix_world @ v.co
    bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    # MAKE THE NORMALS POINT OUT. A left-side bone in this atlas is a mirrored
    # copy of the right, and mirroring flips the winding, so its normals point
    # inward. Every "faces anterior" test then selects the inner surface, and
    # the lift along the normal pushes the region inside the bone, behind the
    # skeleton — which is how the pubis came out invisible from the front.
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    for _ in range(a.subdivide):
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
    bm.faces.ensure_lookup_table()
    bm.verts.ensure_lookup_table()

    verts = [v.co.copy() for v in bm.verts]
    vnormals = [v.normal.copy() for v in bm.verts]
    faces = list(bm.faces)
    centres = [f.calc_center_median() for f in faces]
    fnormals = [f.normal.copy() for f in faces]

    index = {f: i for i, f in enumerate(faces)}
    adjacency = [[] for _ in faces]
    for i, f in enumerate(faces):
        for e in f.edges:
            for other in e.link_faces:
                if other is not f:
                    adjacency[i].append(index[other])

    try:
        mask, seeds = select_faces(verts, vnormals, centres, fnormals, rule, anchors, adjacency)
    except Exception as exc:
        print(f"[region] rule failed on {bone_name}: {exc}", flush=True)
        bm.free()
        return None

    # THE REGION'S EXTENT, measured before the mesh is cut down. Taking it from
    # the surviving mesh's vertices instead gave the fibular head a frame wider
    # than the whole fibula, because deleting faces can leave loose vertices
    # behind and the bounding box then spans the entire bone.
    picked = [centres[i] for i in range(len(faces)) if mask[i]]
    if not picked:
        bm.free()
        return None
    rlo, rhi = bbox_of(picked)

    kill = [f for i, f in enumerate(faces) if not mask[i]]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    if not bm.faces:
        bm.free()
        return None

    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        v.co = v.co + v.normal * 0.0004

    mesh = bpy.data.meshes.new("landmark_region")
    bm.to_mesh(mesh)
    bm.free()
    return mesh, [mathutils.Vector(s) for s in seeds], rlo, rhi


# Same exclusion as the other renderers: the collection's own title is a mesh
# inside it, and baking the skeleton wholesale would bake "SYSTEM" in too.
skel = bpy.data.collections.get("1: Skeletal system")
skeleton_names = [o.name for o in skel.all_objects if o.type == "MESH" and not o.name.endswith(".g")]
print(f"[bones] baking {len(skeleton_names)} meshes...", flush=True)
skeleton_mesh = bake(skeleton_names, "landmark_skeleton")

# One linked object serves every view: the context render and the visibility
# ray cast both need the skeleton in the scene.
clear()
skeleton_ob = bpy.data.objects.new("landmark_skeleton_ob", skeleton_mesh)
skeleton_ob.data.materials.append(BONE_MAT)
scene.collection.objects.link(skeleton_ob)
depsgraph = bpy.context.evaluated_depsgraph_get()

# THE ARM COMES OFF FOR A LATERAL VIEW OF ANYTHING THAT IS NOT THE ARM. In the
# anatomical position the upper limb hangs straight down the side of the trunk,
# so from the side it sits squarely in front of the pelvis, the sacrum and the
# proximal femur. The reviewer's rule: remove it as if it were not there — a
# real arm moves out of the way, and a hand across the iliac crest teaches
# nothing about the iliac crest.
ARM_BONE = re.compile(
    r"humerus|radius|ulna|carpal|metacarpal|scaphoid|lunate|triquetr|pisiform|trapezi|capitate|hamate"
    # THE ATLAS CALLS TOES "FINGERS OF FOOT" ("Distal phalanx of first finger
    # of foot.r"), so matching on "finger" took the toes off with the arm — the
    # reviewer: "why have the phalanges been removed?". A hand bone says "hand".
    r"|(phalanx|phalanges).*(thumb|hand)|sesamoid.*(hand|thumb)",
    re.I,
)
UPPER_LIMB_PARENT = re.compile(r"humerus|radius|ulna|scapula|clavicle|carpal|metacarpal|hand|finger|thumb", re.I)
armless_names = [n for n in skeleton_names if not ARM_BONE.search(n)]
print(f"[bones] baking {len(armless_names)} meshes again without the upper limb...", flush=True)
skeleton_noarm_ob = bpy.data.objects.new("landmark_skeleton_noarm_ob", bake(armless_names, "landmark_skeleton_noarm"))
skeleton_noarm_ob.data.materials.append(BONE_MAT)
scene.collection.objects.link(skeleton_noarm_ob)
skeleton_noarm_ob.hide_render = True

# A VERTEBRA IS SHOWN ON ITS OWN, from above and from the side. In a stack of
# vertebrae a pedicle is unidentifiable — the neighbours hide it and every
# level looks alike — whereas one vertebra from above is the textbook figure.
# The reviewer's rule; the sacrum and coccyx are fused bones and stay in
# context.
ISOLATE_PARENTS = {
    "atlas-c1", "axis-c2", "c7-vertebra", "cervical-vertebrae",
    "l4-vertebra", "lumbar-vertebrae", "thoracic-vertebrae",
    # The reviewer, second pass: "the sacrum needs its own image with it being
    # a complicated structure". In the skeleton the ilia cover its sides (the
    # auricular surface could not be seen at all) and L5 sits on its base.
    "sacrum",
}
# A fused bone is looked at the way a whole bone is — front, side, back — not
# from above and the side like a single vertebra.
ISOLATE_DEFAULT_VIEWS = {"sacrum": [0, 6, 12]}


LOWER_LIMB = re.compile(
    r"femur|patella|tibia|fibula|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal"
    r"|(phalanx|phalanges).*(toe|foot)|sesamoid.*(foot|toe)",
    re.I,
)
SIDE_BAKES = {}


def medial_context(parent_name):
    """The skeleton without the arms and without the OTHER leg, for a view
    from the inner side. Standing, the far leg is exactly where a medial camera
    looks from, so the sustentaculum tali — a shelf on the medial calcaneus —
    was hidden behind the opposite foot in the one view that shows it. Baked
    once per side, and only when a medial view asks for it."""
    side = "l" if parent_name.endswith(".l") else "r"
    other = ".r" if side == "l" else ".l"
    if side not in SIDE_BAKES:
        names = [n for n in armless_names if not (LOWER_LIMB.search(n) and n.endswith(other))]
        print(f"[bones] baking {len(names)} meshes for medial views of the {side} side...", flush=True)
        ob = bpy.data.objects.new(f"landmark_skeleton_medial_{side}", bake(names, f"landmark_skeleton_medial_{side}"))
        ob.data.materials.append(BONE_MAT)
        scene.collection.objects.link(ob)
        ob.hide_render = ob.hide_viewport = True
        SIDE_BAKES[side] = ob
    return SIDE_BAKES[side]


def place_camera_top(target, frame_size, flip=False):
    """Straight down. A camera at identity rotation looks along -Z with +Y up,
    so the image's top is posterior: spinous process at the top, body at the
    bottom, as in most of the reviewer's superior-view plates. `flip` turns it
    half a turn, anterior-up, which is how the reviewer's atlas plates run."""
    dist = frame_size * 6 + 0.5
    cam.location = target + mathutils.Vector((0, 0, dist))
    cam.rotation_euler = (0.0, 0.0, math.pi if flip else 0.0)
    cam_data.ortho_scale = frame_size
    if a.look == "flat":
        sun.rotation_euler = mathutils.Euler((0.35, 0.25, 0.8), "XYZ")
    else:
        aim_lights()

done = 0
for lm in spec["landmarks"]:
    lid = lm["id"]
    if lid not in wanted:
        continue

    # Anchors come unsided in Z-Anatomy ("Greater trochanter.j"), and a paired
    # bone has two copies. Take the first anchor's vertices and frame on the
    # parent-bone mesh nearest to them, so the camera and the marker agree on
    # which side is meant.
    pts = []
    for name in lm["anchors"]:
        pts = world_points(name)
        if pts:
            break
    if not pts:
        print(f"[skip] {lid}: no anchor vertices", flush=True)
        continue
    anchor = sum(pts, mathutils.Vector()) / len(pts)
    # A MEASURED CORRECTION to where the atlas put the anchor, in metres, before
    # it is snapped to the bone: the adductor tubercle's anchor sits 8mm low.
    if lm.get("anchorOffset"):
        anchor = anchor + mathutils.Vector(lm["anchorOffset"])

    parent_name = None
    parent_pts = []
    for name in lm["parentObjects"]:
        ob = bpy.data.objects.get(name)
        if ob and ob.type == "MESH":
            verts = [ob.matrix_world @ v.co for v in ob.data.vertices]
            if verts:
                lo, hi = bbox_of(verts)
                centre = (lo + hi) / 2
                parent_pts.append(((centre - anchor).length, lo, hi, verts, name))
    if not parent_pts:
        print(f"[skip] {lid}: parent bone has no geometry", flush=True)
        continue
    _, plo, phi, pverts, parent_name = min(parent_pts, key=lambda t: t[0])
    parent_size = max(phi.x - plo.x, phi.y - plo.y, phi.z - plo.z)
    # ZOOM SO THE LANDMARK IS WORTH AIMING AT. The target a student taps is the
    # landmark's own size, and at whole-bone framing a 7mm spine is smaller than
    # a fingertip on a phone. Frame so the landmark spans at least a usable
    # share of the image, rather than inflating the target beyond its anatomy.
    # Clamped so a tiny feature does not zoom until the bone is unrecognisable.
    radius = lm.get("radius")
    if radius:
        frame_size = min(max(radius * a.zoom, parent_size * 0.35), parent_size * lm.get("frame", a.frame))
    else:
        frame_size = parent_size * lm.get("frame", a.frame)
    # ALWAYS SHOW ENOUGH TO IDENTIFY THE BONE. Framing on the landmark's own
    # size left a vertebral process filling the picture with one vertebra and
    # nothing either side of it — you cannot tell a pedicle from a lamina, or
    # L4 from T8, with nothing in shot to compare against. Half the atlas was
    # framed under 120mm. A floor in metres fixes that where a fraction of the
    # parent bone cannot: the bone that needs the context is often the small one.
    # `minFrame` in the spec widens one landmark's picture: the sustentaculum
    # tali at 150mm showed a heel and nothing to say which way up it was.
    frame_size = max(frame_size, lm.get("minFrame", a.min_frame))

    # A LANDMARK WITH A TRACED REGION IS FRAMED ON THE REGION, not on a radius.
    # The radius rule zooms by a number derived from the landmark's name-class,
    # which is what cropped the femoral neck until there was no bone above it.
    # A region knows its own extent, so the frame can be that extent plus
    # context — and "can you see what is around it" stops being a guess.
    region_mesh = None
    rule = REGION_RULES.get(lid)
    if rule:
        region_anchors = {}
        for n in region_anchor_names(rule) | {lm["anchors"][0]}:
            p = world_points(n)
            if p:
                region_anchors[n] = sum(p, mathutils.Vector()) / len(p)
        region_anchors.setdefault(lm["anchors"][0], anchor)
        built = build_region(parent_name, rule, region_anchors)
        if built is None:
            print(f"[skip] {lid}: region rule selected nothing on {parent_name}", flush=True)
            continue
        region_mesh, region_seeds, rlo, rhi = built
        region_centre = (rlo + rhi) / 2
        extent = max(rhi.x - rlo.x, rhi.y - rlo.y, rhi.z - rlo.z)
        # Context, but bounded by the bone. A small feature wants room around it;
        # a long one — the linea aspera runs most of the femur — is already its
        # own context, and 2.4x its extent framed half a metre of empty air
        # around a bone that is shorter than that.
        frame_size = max(extent * 1.15, min(extent * a.region_context, parent_size * 1.25),
                         lm.get("minFrame", a.min_frame))

    # SNAP TO THE BONE. A `.j` anchor is where Z-Anatomy starts a label's leader
    # line, placed near the landmark for legibility rather than on it: the
    # greater trochanter's anchor sits in empty space lateral to the femur. The
    # landmark is the nearest point of the bone to that anchor.
    tree = kdtree.KDTree(len(pverts))
    for i, v in enumerate(pverts):
        tree.insert(v, i)
    tree.balance()
    raw_anchor = anchor
    anchor, _, snap_dist = tree.find(raw_anchor)
    anchor = mathutils.Vector(anchor)

    # A SNAP THAT TRAVELS TOO FAR IS THE WRONG BONE. Z-Anatomy names its anchors
    # without a level — there is one "Spinous process.j", not one per vertebra —
    # so an anchor found by name can belong to a different vertebra than the one
    # being framed, and snapping would put the marker on the nearest corner of
    # the wrong bone. Better to report it than to draw it.
    if snap_dist > parent_size * a.max_snap:
        print(f"[skip] {lid}: anchor is {snap_dist / parent_size:.0%} of the bone away "
              f"from {lm['parent']} — probably a different bone", flush=True)
        continue

    # AIM BETWEEN THE BONE AND THE LANDMARK. Aimed at the landmark itself, every
    # landmark lands dead centre, which answers a locate question before it is
    # asked. Aimed halfway, it falls where it naturally sits on the bone, off
    # centre, with most of the bone in view to say which bone it is.
    # An isolated vertebra is framed on itself, whatever the landmark's size:
    # the bone IS the context, and the 150mm floor would shrink an 89mm
    # vertebra into the middle third of an empty picture.
    isolate = lm["parent"] in ISOLATE_PARENTS or lid in ISOLATE_IDS
    iso_ob = None
    if isolate:
        with_names = ISOLATE_WITH.get(lid) or ISOLATE_WITH.get("parent:" + lm["parent"], [])
        # "{side}" in a companion's name is this landmark's own side, so one
        # list serves whichever foot the anchor happens to sit on.
        _side = parent_name[-1] if parent_name[-2:] in (".l", ".r") else ""
        with_names = [n.replace("{side}", _side) for n in with_names]
        iso_names = [parent_name] + [n for n in with_names if bpy.data.objects.get(n) and n != parent_name]
        if len(iso_names) > 1:
            # Frame the group, not the one bone: the gap between two vertebrae
            # is centred between them.
            gpts = [bpy.data.objects[n].matrix_world @ v.co for n in iso_names for v in bpy.data.objects[n].data.vertices]
            plo, phi = bbox_of(gpts)
            parent_size = max(phi.x - plo.x, phi.y - plo.y, phi.z - plo.z)
        frame_size = max(parent_size * 1.35, 0.09)
        iso_ob = bpy.data.objects.new(f"landmark_iso_ob_{lid}", bake(iso_names, f"landmark_iso_{lid}"))
        iso_ob.data.materials.append(BONE_MAT)
        scene.collection.objects.link(iso_ob)

    bone_centre = (plo + phi) / 2
    pull = lm.get("pull", a.pull)

    # KEEP THE WHOLE TARGET ON THE PICTURE, not just its centre.
    #
    # The check further down tested only where the anchor landed, so a target
    # whose centre was comfortably inside could still have half its circle off
    # the top of the frame — the femoral neck shipped with 40% of its target
    # above the edge and no bone above it to say what you were looking at.
    #
    # The camera orbits horizontally about `target`, so the anchor's offset from
    # the frame centre is (1-pull) times its offset from the bone's centre:
    # vertically that is fixed, and horizontally the worst view is the one
    # looking straight down the offset, which is bounded by its length in plane.
    if not REGION_RULES.get(lid):
        MIN_ZONE_FRACTION = 55.0 / 1400.0   # mirrors MIN_ZONE_PX in publishLandmarks.ts
        TARGET_MULTIPLE = 2.5               # and TARGET_MULTIPLE there
        MARGIN = 0.04                       # a strip of context beyond the halo
        MIN_OFFSET = 0.10                   # keep it off-centre; see the note below
        off = anchor - bone_centre
        reach = max(mathutils.Vector((off.x, off.y, 0)).length, abs(off.z))
        # An isolated vertebra is aimed at its own centre, so the fit has to be
        # found with pull held at 0 and the frame alone growing — fitting it at
        # pull 0.5 and then centring afterwards is how the spinous process, at
        # the bone's very edge, ended up outside its own halo and unpublished.
        if isolate:
            pull = 0.0
        for _ in range(60):
            halo = max((lm.get("radius") or 0.0) / frame_size, MIN_ZONE_FRACTION) * TARGET_MULTIPLE
            if (1 - pull) * reach / frame_size + halo + MARGIN <= 0.5:
                break
            # Pull toward the landmark first — it costs nothing but centring —
            # and only widen the frame once that is spent.
            if pull < 0.85 and not isolate:
                pull = min(0.85, pull + 0.02)
            else:
                frame_size *= 1.06
        else:
            print(f"[frame] {lid}: could not fit the whole target; check it by eye", flush=True)

        # AND NOT DEAD CENTRE. This is what pull=0.5 was reaching for: a
        # landmark in the middle of the frame answers the question before it is
        # asked. Expressed as a floor rather than a magic number, so the fitting
        # above cannot quietly centre it.
        while pull > 0.0 and (1 - pull) * reach / frame_size < MIN_OFFSET:
            pull -= 0.02

    # An isolated vertebra is aimed at its own centre. The off-centre pull
    # exists so a point is not given away by sitting in the middle of the
    # frame; here the whole bone is in the middle and the landmark sits
    # wherever it sits on it, so pulling only pushes the bone off the edge.
    target = bone_centre if isolate else bone_centre.lerp(anchor, pull)

    region_ob = None
    if region_mesh is not None:
        # Aimed at the region's own centre. The off-centre rule above exists so
        # a POINT is not given away by sitting dead centre; a traced region is
        # a shape the student has to outline in their head, and pushing it to
        # the edge only crops it.
        if not isolate:
            target = region_centre
        region_ob = bpy.data.objects.new(f"landmark_region_ob_{lid}", region_mesh)
        region_ob.data.materials.append(MASK_ON)
        scene.collection.objects.link(region_ob)
        region_ob.hide_render = True

    # A LINE THAT EXISTS ONLY IN THE PICTURE. With the femur in its socket the
    # acetabulum is, in the reviewer's words, "the line in which we stop seeing
    # the femoral head" — not a feature of either mesh but the place where one
    # passes behind the other from this camera. So it is found in the image:
    # the partner's region (the femoral head) is masked through the same
    # camera, and the line is where its visible pixels meet this bone's.
    edge_ob = None
    edge_rule = rule.get("edgeWith") if rule else None
    if edge_rule:
        side = parent_name[-2:] if parent_name[-2:] in (".l", ".r") else ""
        partner = edge_rule["bone"] + side
        prule = REGION_RULES.get(edge_rule["rule"])
        panchors = {}
        for n in region_anchor_names(prule):
            pp = world_points(n)
            if pp:
                # The partner's anchor on THIS side of the body.
                c = sum(pp, mathutils.Vector()) / len(pp)
                panchors[n] = mathutils.Vector((abs(c.x) * (1 if anchor.x > 0 else -1), c.y, c.z))
        pbuilt = build_region(partner, prule, panchors) if prule else None
        if pbuilt:
            edge_ob = bpy.data.objects.new(f"landmark_edge_ob_{lid}", pbuilt[0])
            edge_ob.data.materials.append(MASK_ON)
            scene.collection.objects.link(edge_ob)
            edge_ob.hide_render = True
        else:
            print(f"[edge] {lid}: could not build {edge_rule['rule']} on {partner}", flush=True)

    # A LANDMARK WITH A TWIN IS FRAMED ON THE MIDLINE, so that both of them are
    # in the picture. Aimed at one side, the sacral ala's opposite number sat
    # in shot but so near the edge that its target would not fit, and it went
    # unmarked — the very thing the twin rule exists to stop. Only when the
    # pair fits comfortably; a frame is not widened for it.
    # Not for a limb: between the two legs there is only air, and centring the
    # adductor tubercle there put a femur at each edge of the picture and
    # nothing in the middle. A limb landmark stays framed on its own side and
    # its twin is marked only if it happens to be in shot.
    if lid in TWINS and not isolate and not LOWER_LIMB.search(parent_name):
        # What has to fit: the gap between the pair plus the whole of each one.
        # Testing the gap alone centred the tibial plateau between the knees
        # with half of each plateau off the edge of the picture.
        if region_mesh is not None:
            pair_span = 2 * abs(region_centre.x) + (rhi.x - rlo.x)
        else:
            pair_span = 2 * abs(anchor.x) + 2 * 2.5 * max(lm.get("radius") or 0.0, frame_size * 55.0 / 1400.0)
        if pair_span <= frame_size * 0.92:
            target = mathutils.Vector((0.0, target.y, target.z))

    # THE OTHER SIDE. A left bone in this atlas is the right one mirrored, and
    # a midline bone is its own mirror, so the twin of anything is the same
    # thing with x negated: the anchor (re-snapped, since no mesh is perfectly
    # symmetrical), the spine of a line, and the traced region itself.
    twin_anchor = twin_seeds = twin_region_ob = None
    if lid in TWINS:
        paired = parent_name[-2:] in (".l", ".r")
        twin_parent = parent_name[:-1] + ("r" if parent_name.endswith("l") else "l") if paired else parent_name
        tob = bpy.data.objects.get(twin_parent)
        if tob and tob.type == "MESH":
            tverts = [tob.matrix_world @ v.co for v in tob.data.vertices]
            ttree = kdtree.KDTree(len(tverts))
            for i, v in enumerate(tverts):
                ttree.insert(v, i)
            ttree.balance()
            mirrored = mathutils.Vector((-anchor.x, anchor.y, anchor.z))
            co, _, tdist = ttree.find(mirrored)
            if tdist <= 0.006:
                twin_anchor = mathutils.Vector(co)
            else:
                print(f"[twin] {lid}: no bone within 6mm of the mirrored anchor on {twin_parent}", flush=True)
        if region_mesh is not None:
            twin_seeds = [mathutils.Vector((-p.x, p.y, p.z)) for p in region_seeds]
            # Smoothed exactly as the line itself is, further down; left raw,
            # the far shin's crest was still a zigzag beside a smooth near one.
            for _ in range(int(rule.get("smoothAxis", 0))):
                twin_seeds = [twin_seeds[0]] + [(twin_seeds[i - 1] + twin_seeds[i] * 2 + twin_seeds[i + 1]) / 4
                                                for i in range(1, len(twin_seeds) - 1)] + [twin_seeds[-1]]
            # A midline bone's rule mirrors its own selection (mirrorX); a
            # paired bone's twin is on a different mesh, so the region is
            # copied across.
            if paired:
                tmesh = region_mesh.copy()
                for v in tmesh.vertices:
                    v.co.x = -v.co.x
                twin_region_ob = bpy.data.objects.new(f"landmark_region_twin_{lid}", tmesh)
                twin_region_ob.data.materials.append(MASK_ON)
                scene.collection.objects.link(twin_region_ob)
                twin_region_ob.hide_render = True

    # frameSize is recorded because the hotspot radius is worked out from the
    # landmark's real size in metres, and only the renderer knows how many
    # metres the frame covers.
    meta = {"id": lid, "anchor": list(anchor), "snapDistance": snap_dist,
            "snapFraction": snap_dist / parent_size, "parentSize": parent_size,
            "frameSize": frame_size, "radius": lm.get("radius"),
            "region": bool(region_mesh),
            # The landmark is a GAP in this bone: the mask is the whole bone
            # and the publisher keeps the background enclosed inside it.
            "hole": bool(rule and rule.get("hole")),
            # A rule may lower the smallest patch worth tracing: a sacral
            # foramen seen from the side is a few millimetres of opening, and
            # the default floor threw the second one away as a speck.
            "minComponentPx": (rule or {}).get("minComponentPx"),
            "views": {}}
    # Which pictures to take, and what stands behind the bone in each.
    top_flip = lm["parent"] in TOP_FLIP
    angles = VIEW_OVERRIDES.get(lid, ISOLATE_DEFAULT_VIEWS.get(lm["parent"], ["top", 6]) if isolate else views)
    view_specs = []
    for frame in angles:
        if frame == "top":
            view_specs.append(("view-top", lambda: place_camera_top(target, frame_size, top_flip)))
        else:
            view_specs.append((f"view-{frame:02d}", (lambda f: lambda: place_camera(target, f * 15, frame_size))(frame)))
    drop_arm = not isolate and not UPPER_LIMB_PARENT.search(" ".join(lm.get("parentObjects", [])) + " " + lm["parent"])

    for vkey, placer in view_specs:
        placer()
        bpy.context.view_layer.update()

        # The context object for this view: the vertebra alone, the skeleton
        # without its arm, the skeleton without the far leg (a medial view),
        # or the whole skeleton. The mask pass paints it black.
        if isolate:
            ctx_ob = iso_ob
        elif vkey == "view-18":
            ctx_ob = medial_context(parent_name)
        elif drop_arm and vkey == "view-06":
            ctx_ob = skeleton_noarm_ob
        else:
            ctx_ob = skeleton_ob
        # THE RAY CAST MUST SEE THE SAME BONES THE RENDER DOES. hide_render
        # only stops an object being drawn; scene.ray_cast still hits it. With
        # the arm hidden from the picture but not from the ray, a point behind
        # the arm was reported invisible and dropped from a view that showed it
        # plainly. hide_viewport takes it out of the evaluated scene as well.
        for ob_ in [skeleton_ob, skeleton_noarm_ob] + list(SIDE_BAKES.values()):
            ob_.hide_render = ob_.hide_viewport = ob_ is not ctx_ob
        if iso_ob is not None:
            iso_ob.hide_render = iso_ob.hide_viewport = ctx_ob is not iso_ob
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()

        # Where the anchor lands in the image, 0-1 with the origin top-left to
        # match the hotspot convention.
        co = world_to_camera_view(scene, cam, anchor)
        u, v = co.x, 1.0 - co.y

        # Visible if the first thing the camera meets along this line is the
        # landmark itself. Measuring "is anything in front of the snapped point"
        # got the acromion wrong: the nearest bone vertex to its anchor lies on
        # the acromion's far face, so the ray met the near face of the same
        # process and called the landmark hidden behind itself. A landmark is a
        # region of bone, not a point; if the first hit lands within that region
        # the student is looking at it. A hit far away is a different bone or
        # the far side of this one — the ASIS seen from behind.
        direction = (anchor - cam.location).normalized()
        hit, loc, *_ = scene.ray_cast(depsgraph, cam.location, direction)
        # NOT "region": the spec carries an anatomical region per landmark, and
        # reusing that key here multiplied a length by the string "back-core".
        tolerance = parent_size * lm.get("visibleWithin", 0.08)
        # The ray cast runs against the whole skeleton, which an isolated
        # vertebra is not rendered with — a neighbouring vertebra "in the way"
        # is not in the picture, so it cannot hide anything.
        # ...unless it is drawn WITH companions (a whole foot): then the other
        # bones are in the picture and can hide it — the sustentaculum tali
        # from above is under the talus.
        lone = isolate and not (ISOLATE_WITH.get(lid) or ISOLATE_WITH.get("parent:" + lm["parent"]))
        visible = lone or (not hit) or ((loc - anchor).length <= tolerance)
        # The WHOLE target, not its centre: a circle half off the frame is half
        # untappable, and the old centre-only test is why 23 of them shipped.
        halo = max((lm.get("radius") or 0.0) / frame_size, 55.0 / 1400.0) * 2.5
        inside = halo <= u <= 1 - halo and halo <= v <= 1 - halo

        render_to(os.path.join(a.out, lid, f"{vkey}.png"), beauty=True)
        entry = {"u": u, "v": v, "visible": bool(visible and inside)}

        if twin_anchor is not None:
            tco = world_to_camera_view(scene, cam, twin_anchor)
            tu, tv = tco.x, 1.0 - tco.y
            tdir = (twin_anchor - cam.location).normalized()
            thit, tloc, *_ = scene.ray_cast(depsgraph, cam.location, tdir)
            # Ray cast even on an isolated bone: from the side its twin is
            # directly behind the landmark, through the bone, and is not there
            # to be tapped; from above both are in plain view.
            tvisible = (not thit) or ((tloc - twin_anchor).length <= tolerance)
            tinside = halo <= tu <= 1 - halo and halo <= tv <= 1 - halo
            entry["twin"] = {"u": tu, "v": tv, "visible": bool(tvisible and tinside)}

        # A TWIN THAT DOES NOT FIT IS NOT A TWIN. The frame stays on the
        # landmark's own side, so the opposite one can sit half outside it —
        # the other knee's medial epicondyle was traced as a sliver down the
        # edge of the picture, which is a strip of "correct" on a bone barely
        # in shot. Measured on the twin patch's FACE CENTRES: its vertices are
        # no use, because deleting faces leaves loose ones behind that span the
        # whole bone, and its anchor is no use either, because the point tests
        # around it are a 2.5x halo and a ray cast that a region does not want.
        # A GAP is exempt: there the patch is the whole bone by construction
        # (the target is the background it encloses), so its extent says
        # nothing, and the flood fill decides as it always does.
        twin_fits = True
        if twin_region_ob is not None and not (rule and rule.get("hole")):
            for poly in twin_region_ob.data.polygons:
                co = world_to_camera_view(scene, cam, twin_region_ob.matrix_world @ poly.center)
                if not (0.015 <= co.x <= 0.985 and 0.015 <= co.y <= 0.985):
                    twin_fits = False
                    break
            if not twin_fits:
                print(f"[twin] {lid} {vkey}: the other side is cut by the frame — not marked", flush=True)

        if region_ob is not None:
            # THE MASK DECIDES VISIBILITY FOR A REGION, and it is a better
            # judge than the ray cast above: the whole skeleton stays in the
            # scene, flat black, so a region behind another bone simply does
            # not appear. That is why the linea aspera stops being published
            # on the anterior view — not because a tolerance was tuned, but
            # because from the front there is a femur in the way.
            # A gap BETWEEN bones is enclosed by all of them: the intervertebral
            # foramen has L4 above it, L5 below and the disc in front, so the
            # whole isolated group is the silhouette the gap is cut from.
            group_hole = bool(rule.get("hole")) and lid in ISOLATE_WITH
            ctx_ob.data.materials[0] = MASK_ON if group_hole else MASK_OFF
            region_ob.hide_render = False
            if twin_region_ob is not None and twin_fits:
                twin_region_ob.hide_render = False
            sun.hide_render = fill.hide_render = True
            if _bg:
                _bg.inputs[1].default_value = 0.0
            mask_path = os.path.join(a.out, lid, vkey.replace("view", "mask") + ".png")
            render_to(mask_path)
            if edge_ob is not None:
                region_ob.hide_render = True
                edge_ob.hide_render = False
                edge_path = os.path.join(a.out, lid, vkey.replace("view", "edge") + ".png")
                render_to(edge_path)
                edge_ob.hide_render = True
                contact = contact_line(mask_path, edge_path)
                if contact:
                    entry["axis"] = contact
                    entry["axisWidth"] = rule.get("axisHalfWidth")
            ctx_ob.data.materials[0] = BONE_MAT
            region_ob.hide_render = True
            if twin_region_ob is not None:
                twin_region_ob.hide_render = True
            sun.hide_render = False
            fill.hide_render = a.look == "flat"
            if _bg:
                _bg.inputs[1].default_value = WORLD_STRENGTH
            entry["mask"] = True

            # A LINE'S CENTRE-LINE, projected. A crest is a line, and a line
            # scored with rings tells "dead on it" from "a few millimetres off"
            # — which a traced outline cannot, since containment has no
            # gradient. Only rules that emit a capsule carry one.
            if rule.get("emit") == "capsule" and len(region_seeds) > 1 and edge_ob is None:
                line = [p.copy() for p in region_seeds]
                # SMOOTH THE LINE. Seeds are snapped to mesh vertices, so a
                # crest came out as a zigzag from vertex to vertex — "the line
                # isn't smooth enough". Ends are held so two halves still meet.
                for _ in range(int(rule.get("smoothAxis", 0))):
                    line = [line[0]] + [(line[i - 1] + line[i] * 2 + line[i + 1]) / 4
                                        for i in range(1, len(line) - 1)] + [line[-1]]
                # ONLY THE PART THAT CAN BE SEEN. A rim is a loop round a socket
                # or a head, and from any one side half of it is behind the
                # bone. The reviewer on the acetabulum: it is "the line in which
                # we stop seeing the femoral head" — so each point is ray-cast
                # along the (parallel, orthographic) view direction and the
                # longest visible run is the line.
                if rule.get("visibleOnly"):
                    fwd = cam.matrix_world.to_3x3() @ mathutils.Vector((0, 0, -1))
                    closed = (line[0] - line[-1]).length < 1e-6
                    pts = line[:-1] if closed else line
                    seen = []
                    for p in pts:
                        origin = p - fwd * ((p - cam.location).dot(fwd))
                        h, hl, *_ = scene.ray_cast(depsgraph, origin, fwd)
                        seen.append((not h) or (hl - p).length <= float(rule.get("visibleWithin", 0.006)))
                    n = len(pts)
                    order = list(range(n))
                    if closed and not all(seen) and any(seen):
                        # Start the walk on a hidden point, so a visible run
                        # that crosses the loop's seam is not cut in two.
                        k = seen.index(False)
                        order = order[k:] + order[:k]
                    best, run = [], []
                    for i in order:
                        if seen[i]:
                            run.append(i)
                        else:
                            if len(run) > len(best):
                                best = run
                            run = []
                    if len(run) > len(best):
                        best = run
                    if closed and all(seen):
                        best = best + [best[0]]
                    line = [pts[i] for i in best]
                axis = []
                for p in line:
                    co = world_to_camera_view(scene, cam, p)
                    axis.append([round(co.x, 5), round(1.0 - co.y, 5)])
                if len(axis) > 1:
                    entry["axis"] = axis
                if rule.get("minZonePx"):
                    entry["axisMinZonePx"] = rule["minZonePx"]
                if twin_seeds:
                    entry["twinAxis"] = [[round(c.x, 5), round(1.0 - c.y, 5)]
                                         for c in (world_to_camera_view(scene, cam, p) for p in twin_seeds)]
                # The ridge's real half-width in metres. NOT `width` on a rim
                # rule, where that key is a face-dilation count; a rim says its
                # half-width explicitly or falls back to the spec radius.
                if rule.get("kind") == "rim":
                    entry["axisWidth"] = rule.get("axisHalfWidth")
                else:
                    entry["axisWidth"] = rule.get("axisHalfWidth", rule.get("width"))

        meta["views"][vkey] = entry

    # Put the scene back the way every other landmark expects it.
    skeleton_ob.hide_render = False
    skeleton_noarm_ob.hide_render = True
    if iso_ob is not None:
        iso_mesh = iso_ob.data
        scene.collection.objects.unlink(iso_ob)
        bpy.data.objects.remove(iso_ob)
        bpy.data.meshes.remove(iso_mesh)
    if twin_region_ob is not None:
        tmesh = twin_region_ob.data
        scene.collection.objects.unlink(twin_region_ob)
        bpy.data.objects.remove(twin_region_ob)
        bpy.data.meshes.remove(tmesh)
    if edge_ob is not None:
        emesh = edge_ob.data
        scene.collection.objects.unlink(edge_ob)
        bpy.data.objects.remove(edge_ob)
        bpy.data.meshes.remove(emesh)
    if region_ob is not None:
        scene.collection.objects.unlink(region_ob)
        bpy.data.objects.remove(region_ob)
        bpy.data.meshes.remove(region_mesh)

    with open(os.path.join(os.path.abspath(a.out), lid, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    shown = sum(1 for x in meta["views"].values() if x["visible"])
    print(f"[landmark] {lid}: {shown}/{len(view_specs)} views show it, "
          f"snapped {snap_dist / parent_size:.1%} of the bone's size", flush=True)
    done += 1

print(f"[complete] {done} landmark(s) -> {a.out}", flush=True)
