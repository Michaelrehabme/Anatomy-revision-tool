"""Renders the masks a joint-line hotspot is derived from: one per articulating bone.

WHY THIS EXISTS. Every joint in the dataset carries eligibility.locate = false,
and structures.joints.seed.ts says why: "there's no atlas-slide hotspot data
pinpointing a joint space specifically (as opposed to the bones that form it)".
Mapping a joint to Z-Anatomy's ligament collection does not fix that — it
highlights the ligament draped over the joint, not the articulation, so a
student asked to locate the distal tibiofibular joint would be clicking the
syndesmosis rather than the tibia/fibula gap.

The joint line is derivable from the two bones instead, which is the one thing
we always have: articulatingStructureIds names them, and the skeletal mapping
resolves them to meshes. This script renders each bone as a flat white mask
from a shared camera; jointLineHotspots.ts then dilates both by a few pixels
and intersects them, and the overlap band is the joint line plus that margin.
Nothing here needs a joint object to exist in the atlas, which is why it also
covers the joints Z-Anatomy models no geometry for at all.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderJointMasks.py -- \
      --spec joint-lines.spec.json --out renders/joint-lines --views 0,6,12

CONTACT POINTS, NOT THE WHOLE BONE. Framing on the union of two whole bones
gives a picture of the entire lower leg, so the camera is framed on the contact
region: the vertices of bone A closest to bone B. Tibia and fibula are close at
BOTH ends, though, so `zPrefer` in the spec picks which articulation is meant —
"min" seeds from the lowest contact point, "max" from the highest, and the
region grows from that seed. Without it the distal tibiofibular joint resolves
to the proximal one, silently and plausibly.
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh
from mathutils import kdtree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--spec", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--joints", default="", help="comma-separated ids; default all in the spec")
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--res", type=int, default=900)
ap.add_argument("--margin", type=float, default=3.0, help="camera slack around the contact region")
ap.add_argument("--band", type=float, default=0.02,
                help="contact tolerance, as a fraction of bone A's bounding box")
ap.add_argument("--cluster", type=float, default=0.12,
                help="region-grow radius around the seed contact point, same units as --band")
a = ap.parse_args(argv)

spec = json.load(open(a.spec))
wanted = a.joints.split(",") if a.joints else [j["id"] for j in spec["joints"]]
views = [int(v) for v in a.views.split(",")]

scene = bpy.data.scenes.new("JointScene")
bpy.context.window.scene = scene
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 16
scene.render.resolution_x = scene.render.resolution_y = a.res
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

scene.world = bpy.data.worlds.new("JointWorld")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.0

cam_data = bpy.data.cameras.new("jointcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("jointcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun = bpy.data.objects.new("jointsun", bpy.data.lights.new("jointsun", type="SUN"))
sun.data.energy = 3.0
scene.collection.objects.link(sun)


def flat(name, colour):
    """Emission, so a mask is a hard silhouette with no shading gradient to threshold."""
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


def principled(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


MASK_MAT = flat("joint_mask_white", (1, 1, 1, 1))
BONE_MAT = principled("joint_bone", (0.93, 0.92, 0.89, 1), 0.55)


def side_of(names):
    """Z-Anatomy pairs meshes .l/.r. Mixing sides frames the camera across the body."""
    for suffix in (".l", ".r"):
        if any(n.endswith(suffix) for n in names):
            return suffix
    return None


def restrict(names, suffix):
    """Keep this side's meshes, plus unpaired ones (vertebrae, sternum) which have no side."""
    if suffix is None:
        return names
    return [n for n in names if n.endswith(suffix) or not (n.endswith(".l") or n.endswith(".r"))]


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
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def bbox(points):
    xs = [p.x for p in points]
    ys = [p.y for p in points]
    zs = [p.z for p in points]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def bbox_size(lo, hi):
    return max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])


def kd_of(mesh):
    tree = kdtree.KDTree(len(mesh.vertices))
    for i, v in enumerate(mesh.vertices):
        tree.insert(v.co, i)
    tree.balance()
    return tree


def contact_region(mesh_a, mesh_b, band_frac, cluster_frac, z_prefer):
    """The facing surfaces of both bones, narrowed to the articulation z_prefer names.

    Returns (indices_a, indices_b, points), or None when the bones never come
    close enough to read as an articulation — better to report that than to emit
    a hotspot over a gap.

    Both sides are collected, not just A's. The joint line is the space between
    two surfaces, so a mask built from one bone's surface alone sits against the
    joint rather than over it.
    """
    if not mesh_a.vertices or not mesh_b.vertices:
        return None

    # Scale the tolerance off the LARGER bone. Off bone A, a joint whose first
    # named part is small — the patella, against the femur — gets a band sized
    # to the patella, which is far tighter than the cartilage gap it has to
    # span, and the contact set collapses to a handful of vertices.
    scale = max(
        bbox_size(*bbox([v.co for v in mesh_a.vertices])),
        bbox_size(*bbox([v.co for v in mesh_b.vertices])),
    )
    band = scale * band_frac
    cluster = scale * cluster_frac

    tree_a, tree_b = kd_of(mesh_a), kd_of(mesh_b)
    dist_a = [tree_b.find(v.co)[2] for v in mesh_a.vertices]
    dist_b = [tree_a.find(v.co)[2] for v in mesh_b.vertices]

    d_min = min(min(dist_a), min(dist_b))
    cutoff = d_min + band

    idx_a = {i for i, d in enumerate(dist_a) if d <= cutoff}
    idx_b = {i for i, d in enumerate(dist_b) if d <= cutoff}
    if not idx_a and not idx_b:
        return None

    # Tibia and fibula are close at both ends, as are radius and ulna. Seed from
    # the end z_prefer names and keep only what is within one cluster radius of
    # it, or the two articulations merge into a single mask spanning the limb.
    if z_prefer in ("min", "max"):
        candidates = [mesh_a.vertices[i].co for i in idx_a] + [mesh_b.vertices[i].co for i in idx_b]
        seed = min(candidates, key=lambda p: p.z) if z_prefer == "min" else max(candidates, key=lambda p: p.z)
        idx_a = {i for i in idx_a if (mesh_a.vertices[i].co - seed).length <= cluster}
        idx_b = {i for i in idx_b if (mesh_b.vertices[i].co - seed).length <= cluster}

    points = [mesh_a.vertices[i].co.copy() for i in idx_a] + [mesh_b.vertices[i].co.copy() for i in idx_b]
    if not points:
        return None
    return idx_a, idx_b, points


def collect_faces(meshes_and_indices, predicate):
    verts, faces, vmap = [], [], {}
    for mesh, idx in meshes_and_indices:
        for p in mesh.polygons:
            if not predicate(p.vertices, idx):
                continue
            face = []
            for vi in p.vertices:
                key = (id(mesh), vi)
                if key not in vmap:
                    vmap[key] = len(verts)
                    verts.append(mesh.vertices[vi].co.copy())
                face.append(vmap[key])
            faces.append(face)
    return verts, faces


def surface_patch(meshes_and_indices, name):
    """The facing surfaces themselves, as one mesh, ready to render as a mask.

    A face is kept only when EVERY one of its vertices is in contact. Keeping a
    face on any single contact vertex drags in the whole triangle, including the
    far vertex pointing away from the joint — the patch then renders as a blob
    with spikes radiating out of it rather than a band along the joint line.

    Where that strict rule finds nothing — a coarse mesh whose faces are large
    relative to the contact band — it falls back to the loose one rather than
    reporting a joint as unrenderable, and says so, because an over-wide band
    is reviewable and a missing one is not.
    """
    strict = lambda vs, idx: all(vi in idx for vi in vs)
    loose = lambda vs, idx: any(vi in idx for vi in vs)

    verts, faces = collect_faces(meshes_and_indices, strict)
    relaxed = False
    if not faces:
        verts, faces = collect_faces(meshes_and_indices, loose)
        relaxed = True

    mesh = bpy.data.meshes.new(name)
    if faces:
        mesh.from_pydata([list(v) for v in verts], [], faces)
        mesh.update()
    return mesh, relaxed


def frame_camera(lo, hi, angle_deg, margin):
    center = mathutils.Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
    size = max(bbox_size(lo, hi), 1e-4)
    dist = size * 8 + 0.5
    theta = math.radians(angle_deg)
    offset = mathutils.Vector((-dist * math.sin(theta), -dist * math.cos(theta), 0))
    loc = center + offset
    cam.location = loc
    cam.rotation_euler = (center - loc).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = size * margin
    sun.rotation_euler = mathutils.Euler((0.9, 0.3, 0.6 + theta), "XYZ")


def clear():
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
    return ob


def render_to(path):
    # Absolute: Blender resolves a relative render filepath against the .blend,
    # not the working directory, so a relative path silently writes elsewhere.
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


by_id = {j["id"]: j for j in spec["joints"]}
done = 0

for jid in wanted:
    j = by_id.get(jid)
    if j is None:
        print(f"[skip] {jid}: not in spec", flush=True)
        continue

    suffix = side_of(j["a"]["objects"] + j["b"]["objects"])
    objs_a = restrict(j["a"]["objects"], suffix)
    objs_b = restrict(j["b"]["objects"], suffix)

    mesh_a = bake(objs_a, f"a_{jid}")
    mesh_b = bake(objs_b, f"b_{jid}")

    found = contact_region(mesh_a, mesh_b, a.band, a.cluster, j.get("zPrefer"))
    if found is None:
        print(f"[skip] {jid}: {j['a']['id']} and {j['b']['id']} never come close enough", flush=True)
        continue

    idx_a, idx_b, contact = found
    patch, relaxed = surface_patch(((mesh_a, idx_a), (mesh_b, idx_b)), f"line_{jid}")
    if not patch.polygons:
        print(f"[skip] {jid}: contact found but no faces to render", flush=True)
        continue

    lo, hi = bbox(contact)
    note = "  (relaxed face rule — band will be wide)" if relaxed else ""
    print(f"[joint] {jid}: {len(contact)} contact verts, {len(patch.polygons)} faces, "
          f"region {bbox_size(lo, hi):.4f}{note}", flush=True)

    for frame in views:
        # The joint line, rendered from the 3D contact surfaces rather than
        # recovered from flattened silhouettes. Intersecting two bone
        # silhouettes cannot tell "adjacent" from "one in front of the other",
        # so on a lateral ankle view it swallowed the whole distal fibula.
        clear()
        frame_camera(lo, hi, frame * 15, a.margin)
        link(patch, f"mask_line_{jid}", MASK_MAT)
        render_to(os.path.join(a.out, jid, f"view-{frame:02d}", "line.png"))

        # Both bones lit normally, pixel-aligned to the mask, so the derived
        # band can be checked against the anatomy by eye.
        clear()
        link(mesh_a, f"ctx_a_{jid}", BONE_MAT)
        link(mesh_b, f"ctx_b_{jid}", BONE_MAT)
        render_to(os.path.join(a.out, jid, f"view-{frame:02d}", "context.png"))

    done += 1

print(f"[complete] {done} joint(s) -> {a.out}", flush=True)
