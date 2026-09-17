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

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import boneLook  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--spec", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--only", default="", help="comma-separated plate keys")
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--margin", type=float, default=1.35, help="camera slack around the subjects")
ap.add_argument("--limb-margin", type=float, default=1.12,
                help="slack for a limb plate, which is framed to its subject rather than square")
ap.add_argument("--plates-only", action="store_true",
                help="re-render the pictures and leave the masks alone. A mask is a flat emission, "
                     "so lighting cannot move a hotspot — relighting is a picture change only.")
ap.add_argument("--turntable", type=int, default=0,
                help="render this many angles evenly around the vertical axis instead of --views, "
                     "framed so the subject fits at every one of them")
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

boneLook.setup_world(scene)

cam_data = bpy.data.cameras.new("subcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("subcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

sun, fill = boneLook.add_lights(scene)

for _attr, _val in (("use_gtao", True), ("gtao_distance", 0.02), ("use_shadows", True),
                    ("use_fast_gi", True), ("fast_gi_distance", 0.03)):
    try:
        setattr(scene.eevee, _attr, _val)
    except (AttributeError, TypeError):
        pass

# OUTLINES ON THE PLATE ONLY, NEVER ON A MASK — a line drawn on a mask grows
# every traced polygon by its own width and silently moves the locate targets.
# Only the bones go in: two touching carpals of the same colour need an edge to
# divide them, while a red muscle on pale bone is already divided by its colour.
outline_coll = bpy.data.collections.new("sub_outlined")
scene.collection.children.link(outline_coll)
boneLook.outline_lineset(scene, outline_coll)


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
# The shared bone: pale, with its hollows darkened by occlusion. Seven renderers
# draw this skeleton and each had grown its own lighting; boneLook.py is the one
# the landmark panels had already got right.
BONE_MAT = boneLook.bone_material("sub_bone")
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


# The narrowest frame allowed, as width over height.
#
# THIS CLAMP WIDENS A TALL FRAME, and that is a cost as well as a convenience:
# the forearm turntable was clamped from its own 0.36 out to 0.5, 39% of extra
# width that went straight onto the rib cage and the pelvis behind the arm,
# and shrank every muscle on the plate by the same fraction. Extensor pollicis
# brevis fell under the tappability floor by 3%.
#
# It was set at a half when a plate was a fixed picture and a 1:5 frame meant
# the student scrolled to see the hand. The viewer pans and zooms now, so a
# taller frame is affordable in a way it was not, and 0.4 buys back the width
# the clamp was spending on the trunk.
MIN_FRAME_ASPECT = 0.4
# How far from square a subject has to be before the frame follows it. Inside
# this band the frame stays square, so a plate whose subject is a hand or a foot
# renders byte-identically to the ones already published and its hotspots do not
# move. Outside it — a forearm, a leg, a spine — the empty half is real and worth
# not rendering.
SQUARE_BAND = (0.8, 1.25)


def turntable_frame(mesh, centre):
    """The one frame that fits a subject at EVERY angle around the vertical axis.

    A turntable cannot refit its camera per frame. Fitting each angle to what
    that angle happens to show makes the picture breathe — the forearm swells as
    it turns broadside and shrinks as it goes end-on — and worse, it changes the
    resolution under a hotspot that is stored in normalised coordinates, so the
    same tap means different things on different frames.

    Both extents are therefore measured rotation-invariantly. Height is the
    subject's own, because turning about the vertical axis does not change it.
    Width is the diameter of the circle the footprint sweeps out, which is the
    widest the subject can ever present.
    """
    zs = [v.co.z for v in mesh.vertices]
    radius = 0.0
    for v in mesh.vertices:
        dx = v.co.x - centre[0]
        dy = v.co.y - centre[1]
        r = math.sqrt(dx * dx + dy * dy)
        if r > radius:
            radius = r
    return 2.0 * radius, (max(zs) - min(zs)) or (2.0 * radius)


def frame_camera(lo, hi, angle_deg, margin, elevation_deg=0.0, fit=False, span=None):
    """Spinning alone never shows the sole of a foot.

    The plantar muscles — quadratus plantae, flexor hallucis brevis, the plantar
    interossei — are under the foot bones from every angle on the vertical axis,
    which is why they survived a close plate and still had no target. Elevation
    is the axis that reaches them, the same one renderMusclePanels.py needed.

    `fit` SHAPES THE FRAME TO THE SUBJECT instead of rendering a square. A square
    frame on a limb spends most of itself on whatever happens to stand behind it:
    the first forearm plate put the arm down one side and the torso down the
    other, and every muscle on it measured under three pixels for no reason but
    the empty half. Fitting the frame is the cheapest magnification there is —
    the camera does not move, the wasted ground is simply not rendered.
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
    track = (centre - cam.location).to_track_quat("-Z", "Y")
    cam.rotation_euler = track.to_euler()

    if span:
        # A turntable: the frame is handed in, already measured to fit every
        # angle, so nothing here depends on where the camera happens to be.
        w, h = span
        aspect = 1.0 if SQUARE_BAND[0] <= w / h <= SQUARE_BAND[1] else w / h
        aspect = min(max(aspect, MIN_FRAME_ASPECT), 1.0 / MIN_FRAME_ASPECT)
        if aspect >= 1.0:
            rx, ry = a.res, max(1, round(a.res / aspect))
        else:
            rx, ry = max(1, round(a.res * aspect)), a.res
        scene.render.resolution_x, scene.render.resolution_y = rx, ry
        cam_data.sensor_fit = "HORIZONTAL"
        cam_data.ortho_scale = (w if w / h >= aspect else h * aspect) * margin
    elif fit:
        # The bounding box as the CAMERA sees it, which is not the world box: the
        # arm hangs at an angle and the view turns around it. Measured from the
        # track quaternion rather than matrix_world, which Blender has not
        # recomputed yet at this point in the frame.
        right = track @ mathutils.Vector((1.0, 0.0, 0.0))
        up = track @ mathutils.Vector((0.0, 1.0, 0.0))
        xs, ys = [], []
        for cx in (lo[0], hi[0]):
            for cy in (lo[1], hi[1]):
                for cz in (lo[2], hi[2]):
                    v = mathutils.Vector((cx, cy, cz)) - centre
                    xs.append(v.dot(right))
                    ys.append(v.dot(up))
        w = (max(xs) - min(xs)) or size
        h = (max(ys) - min(ys)) or size
        aspect = 1.0 if SQUARE_BAND[0] <= w / h <= SQUARE_BAND[1] else w / h
        aspect = min(max(aspect, MIN_FRAME_ASPECT), 1.0 / MIN_FRAME_ASPECT)
        if aspect >= 1.0:
            rx, ry = a.res, max(1, round(a.res / aspect))
        else:
            rx, ry = max(1, round(a.res * aspect)), a.res
        scene.render.resolution_x, scene.render.resolution_y = rx, ry
        # HORIZONTAL so ortho_scale means the width whichever way the frame leans.
        # Width is the subject's own when it is wider than the clamp allows, and
        # the clamp's otherwise — either way the subject fits.
        cam_data.sensor_fit = "HORIZONTAL"
        cam_data.ortho_scale = (w if w / h >= aspect else h * aspect) * margin
    else:
        scene.render.resolution_x = scene.render.resolution_y = a.res
        cam_data.sensor_fit = "AUTO"
        cam_data.ortho_scale = size * margin

    # In the CAMERA's frame, so a bone is lit the same way from every angle of a
    # turntable rather than raked from one side and flat from the next.
    boneLook.aim_lights(cam, sun, fill)


def clear():
    for ob in list(outline_coll.objects):
        outline_coll.objects.unlink(ob)
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun, fill):
            scene.collection.objects.unlink(ob)


def link(mesh, name, material, holdout=False, outline=False):
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.clear()
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.material_index = 0
    ob.is_holdout = holdout
    (outline_coll if outline else scene.collection).objects.link(ob)
    return ob


def render_to(path, outlines=False):
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    scene.render.use_freestyle = outlines
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

    # AN AXIAL PLATE PICKS NO SIDE AT ALL. Dropping one is right for a hand,
    # where framing both frames the gap between them — the whole body. It is
    # wrong for the muscles that live on the midline, which are paired like any
    # other and so look like a limb to side_of(). The interspinales are a blade
    # eight millimetres wide either side of the interspinous ligament: drawn on
    # one side only they read as half a muscle that does not reach across the
    # gap, which is what "the interspinales are not connecting" is.
    if plate.get("backdrop") == "full":
        suffix = None

    # A THREE-SEGMENT KEY IS A PLATE SPLIT OFF FOR SCALE, and it gets the tighter
    # margin. Two things drove the split. Forwards: a subregion whose subjects are
    # long — a forearm, a leg — frames wide enough to catch the body behind it,
    # and the first forearm plate came out as an arm down one side and a torso
    # down the other. Backwards: a subregion whose subjects are tiny — the
    # forefoot inside a foot, one disc inside a spine — frames so far back that
    # they are specks.
    tight = key.count("__") == 2

    # A LIMB PLATE ALSO DRAWS THAT LIMB AND NOTHING ELSE: the framed side only,
    # and no axial skeleton. The torso is not context for a forearm; the elbow
    # and the hand are, and they are on the same side. An axial plate has no side
    # to pick and keeps the whole skeleton around it, which is the right backdrop
    # there — a lumbar vertebra is placed by the vertebrae above and below it.
    #
    # HAVING A SIDE IS NOT THE SAME AS BEING A LIMB, which is why a plate may say
    # so outright. Longus colli and longus capitis are paired, so they carry .l
    # and .r and read as a limb here — but they lie on the fronts of the cervical
    # vertebral bodies, and a backdrop with the axial skeleton dropped out of it
    # would float them against nothing. The vertebrae are the whole point of the
    # picture.
    limb_only = tight and suffix is not None
    if plate.get("backdrop") == "full":
        limb_only = False
    elif plate.get("backdrop") == "limb":
        limb_only = suffix is not None

    def restrict(names):
        if suffix is None:
            return names
        kept = [n for n in names if n.endswith(suffix) or not (n.endswith(".l") or n.endswith(".r"))]
        return kept or names

    subjects = []
    for s in plate["subjects"]:
        mesh = boneLook.smooth(bake(restrict(s["objects"]), f"sub_{s['id']}"))
        if mesh.vertices:
            subjects.append((s["id"], s["kind"], mesh))
        else:
            print(f"[warn] {s['id']}: empty bake", flush=True)
    if not subjects:
        continue

    # FRAMING ON A SUBSET, where a subject's own geometry is the wrong ruler.
    # "Intervertebral disc" is one structure made of forty-seven meshes running
    # from C2 to the sacrum, so a camera framed on it frames the whole spine and
    # every disc in the picture is two pixels across. The plate names the two
    # vertebrae to frame on instead; the disc between them then fills the shot,
    # and the discs above and below are the same structure, so the mask tracing
    # over the frame edge is correct rather than a leak.
    frame_ids = set(plate.get("frameOn") or [])
    frame_names = [n for s in plate["subjects"]
                   if not frame_ids or s["id"] in frame_ids
                   for n in restrict(s["objects"])]
    if frame_ids and not frame_names:
        print(f"[warn] {key}: frameOn matched no subject, framing on all of them", flush=True)
        frame_names = [n for s in plate["subjects"] for n in restrict(s["objects"])]
    frame_mesh = bake(frame_names, f"frame_{key}")
    lo, hi = mesh_bbox(frame_mesh)

    # The skeleton minus every bone subject here, baked once: that is the part
    # of "everything else" that does not change from subject to subject.
    own = {n for sid, kind, _ in subjects for s in plate["subjects"] if s["id"] == sid and kind == "bone" for n in restrict(s["objects"])}
    # A LIMB PLATE NAMES ITS OWN BONES. Dropping the other side and the axial
    # skeleton is not enough, because ribs and hip bones are PAIRED: they end in
    # .l and .r like a radius does, so "keep this side" keeps the near half of
    # the trunk. The fitted frames never reached it; a turntable frame, which has
    # to be wide enough for the subject at its broadest angle, does.
    bones = plate.get("bones") or skeleton_names
    if limb_only:
        bones = [n for n in bones if n.endswith(suffix) or not (n.endswith(".l") or n.endswith(".r"))]
        if suffix:
            bones = [n for n in bones if not n.endswith(".r" if suffix == ".l" else ".l")]
    backdrop = boneLook.smooth(bake([n for n in bones if n not in own], f"backdrop_{key}"))

    bone_count = sum(1 for _, k, _ in subjects if k == "bone")
    print(f"[plate] {key}: {len(subjects)} subjects ({bone_count} bone), "
          f"frame {max(hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]):.3f}"
          f"{f' on {len(frame_ids)} of them' if frame_ids else ''}"
          f"{', limb-only' if limb_only else ''}", flush=True)

    # THE TURNTABLE IS THE LEVEL SET, and the elevations are the extra looks a
    # student cannot get by walking round: nothing on the horizon shows a sole.
    # So the angles at elevation 0 are a rotation set the app can turn through,
    # and any other elevation stays the single named view it already was.
    centre = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
    span = turntable_frame(frame_mesh, centre) if a.turntable else None
    turn_angles = [round(i * 360.0 / a.turntable) for i in range(a.turntable)] if a.turntable else None

    for elev in elevations:
      spin = turn_angles if (a.turntable and elev == 0) else [v * 15 for v in views]
      for angle in spin:
        # Fitting is measured, so it applies to any plate with a long subject —
        # the spine is as long and thin as a forearm. Framing on one side is not:
        # it is a property of the key, because the spine plate IS the axial
        # skeleton and dropping it would leave nothing to draw.
        use_span = span if (a.turntable and elev == 0) else None
        frame_camera(lo, hi, angle, a.limb_margin if tight else a.margin, elev,
                     fit=True, span=use_span)

        # Elevation 0 is the rotation set and is named by its angle, the way the
        # ligament plates already are. Any other elevation keeps the plain
        # view-NN name, because it is one picture rather than a set.
        if a.turntable and elev == 0:
            leaf = f"a{angle:03d}"
        else:
            frame = int(round(angle / 15))
            leaf = f"view-{frame:02d}" if elev == 0 else f"view-{frame:02d}-e{elev:+03.0f}"

        # The plate: the skeleton as it is, with the subject muscles laid on it.
        clear()
        link(backdrop, f"plate_backdrop_{key}", BONE_MAT, outline=True)
        for sid, kind, mesh in subjects:
            link(mesh, f"plate_{sid}", BONE_MAT if kind == "bone" else FLESH_MAT,
                 outline=kind == "bone")
        render_to(os.path.join(a.out, key, f"{leaf}.png"), outlines=True)
        count += 1

        if a.plates_only:
            print(f"[plate] {key} {leaf} ({count} renders, {time.time() - t0:.0f}s)", flush=True)
            continue

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
