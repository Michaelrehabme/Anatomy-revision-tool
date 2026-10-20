"""Renders single-muscle panel images: one muscle highlighted on the skeleton.

Replaces the 255px AI-generated panel crops, which are visibly soft on a modern
phone. The important property to preserve is CONTEXT: the old crops showed the
muscle picked out in blue against a skeleton, from several angles, so you could
tell *where* it sits. The 1400px Z-Anatomy isolated renders are sharper but show
the muscle floating alone against white, which is strictly worse for learning a
muscle's location — so this renders the muscle in place on the skeleton instead.

Camera frames the MUSCLE's bounding box with a generous margin so surrounding
bone stays in shot. That is deliberately unlike renderRegionsWithBones.py, whose
framing must stay pinned to the region bbox because hotspots depend on it. These
panels carry no hotspots (mode: 'single-structure'), so the camera is free.

  blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/renderMusclePanels.py -- \
      --mapping ta2-mapping.resolved.json --out renders/panels \
      --muscles deltoid,trapezius --views 0,6,12
"""
import bpy, json, sys, os, math, argparse, mathutils, bmesh, time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import boneLook  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mapping", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--muscles", required=True, help="comma-separated structure ids")
ap.add_argument("--views", default="0,6,12")
ap.add_argument("--elevations", default="0",
                help="camera heights in degrees, comma-separated; negative looks up from below")
ap.add_argument("--frames", type=int, default=24)
# 1400 matches the region plates, and gives a phone at 2x device pixel ratio
# real headroom to zoom into rather than up-scaling immediately.
ap.add_argument("--res", type=int, default=1400)
ap.add_argument("--margin", type=float, default=2.4, help="camera framing slack around the muscle")
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--one-side", default="",
                help="comma-separated ids to frame on one side regardless of SIDE_FRAMING_RATIO")
ap.add_argument("--frame-on", default="",
                help="comma-separated Blender object names to frame every render on, instead of each "
                     "subject's own bbox — for a hand or a foot, where the SUBJECT is not the thing "
                     "that has to be recognisable")
ap.add_argument("--backdrop", default="",
                help="comma-separated Blender object names to draw the subject on, instead of the whole "
                     "skeleton. A frame wide enough to hold a forearm also holds the femur beside it, "
                     "and the composite trims to whatever is opaque, so the far bone survives into the "
                     "panel. Naming the backdrop is the only way to be sure what is in the picture.")
ap.add_argument("--highlight", default="app",
                help="'app' (the default) is the app's highlight: the cyan the muscle, ligament and "
                     "landmark plates pick their answer out in, lifted by a little emission. Or an "
                     "RGB, 0-1: the panels shipped before 2 Oct 2026 were blue (0.22,0.45,0.72)")
ap.add_argument("--look", default="studio", choices=["studio", "flat"],
                help="'studio' is the shared plate look: boneLook's dim world, camera-fixed key and "
                     "fill, occluded ivory bone and the Workbench line pass the muscle turntables "
                     "multiply over every frame. 'flat' is the old white-world panel")
ap.add_argument("--context", default="",
                help="comma-separated Blender object names drawn in muscle red beside the subject: "
                     "soft tissue that is part of what the picture shows without being its subject, "
                     "such as the three tendons that bound the anatomical snuffbox")
ap.add_argument("--ao", action="store_true",
                help="shade the highlighted structure the way boneLook shades bone: ambient occlusion "
                     "darkens its hollows, so the grooves between a ligament's fibres read as the bone's "
                     "crevices do (owner, 20 Oct 2026: 'the same level of realism as the bones')")
ap.add_argument("--exposure", type=float, default=0.0,
                help="stops of extra exposure. The trunk's ribs and girdle shade a shoulder far more "
                     "than a limb is shaded (owner, 20 Oct 2026: 'quite dark and shadowed')")
ap.add_argument("--fill", type=float, default=0.0, help="extra fill-light energy, for the same reason")
ap.add_argument("--regions", default="",
                help="a rules file (panel-regions.rules.json): for the ids it names, the highlight is "
                     "a region grown on the parent bone by landmarkRegions.select_faces, and the "
                     "mapped objects only frame the shot")
a = ap.parse_args(argv)

mapping = {m["id"]: m for m in json.load(open(a.mapping))["mapping"]}
REGIONS = json.load(open(a.regions)) if a.regions else {}
wanted = a.muscles.split(",")
views = [int(v) for v in a.views.split(",")]
elevations = [float(e) for e in a.elevations.split(",")]
force_one_side = set(filter(None, a.one_side.split(",")))
frame_on = [n for n in a.frame_on.split(",") if n]
backdrop_only = [n for n in a.backdrop.split(",") if n]
# Which side --frame-on names, when it names one. A pure string question, so
# it is settled here rather than beside the bbox that also needs it — the
# skeleton is baked before that, and it needs the answer first.
_one_side = [n for n in frame_on if n.endswith(".l")] or [n for n in frame_on if n.endswith(".r")]
framed_side = _one_side[0][-2:] if _one_side and len(_one_side) < len(frame_on) else None
APP_HIGHLIGHT = a.highlight == "app"
highlight_rgb = (0.0, 0.72, 0.95, 1.0) if APP_HIGHLIGHT else tuple(float(v) for v in a.highlight.split(",")) + (1.0,)
STUDIO = a.look == "studio"

scene = bpy.data.scenes.new("PanelScene")
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

cam_data = bpy.data.cameras.new("panelcam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("panelcam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

# THE PANELS WERE THE LAST FAMILY STILL LIT THE OLD WAY. Every plate a student
# turns through went over to boneLook and the muscle turntables' line pass in
# September; the card pictures kept a white world at 0.55, which lights every
# face from every side, and beside the new plates they read as grey cut-outs.
# The studio look is the muscle turntables' recipe exactly: the shared world,
# lights and bone (boneLook.py), the Standard view transform, contact shadow,
# and a Workbench cavity-and-outline pass multiplied over the lit render.
fill = None
if STUDIO:
    boneLook.setup_world(scene)
    sun, fill = boneLook.add_lights(scene)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = a.exposure
    if a.fill and fill is not None:
        fill.data.energy += a.fill
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
    for attr, val in (("use_gtao", True), ("gtao_distance", 0.02), ("use_shadows", True),
                      ("use_fast_gi", True), ("fast_gi_distance", 0.03)):
        try:
            setattr(scene.eevee, attr, val)
        except (AttributeError, TypeError):
            pass
else:
    scene.world = bpy.data.worlds.new("PanelWorld")
    scene.world.use_nodes = True
    # Ambient fill. With only the sun, the lateral view falls into shadow and
    # reads much darker than the anterior and posterior ones sitting beside it
    # in the composited strip.
    _bg = scene.world.node_tree.nodes.get("Background")
    if _bg:
        _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
        _bg.inputs[1].default_value = 0.55
    sun_data = bpy.data.lights.new("panelsun", type="SUN")
    sun_data.energy = 3.0
    sun = bpy.data.objects.new("panelsun", sun_data)
    scene.collection.objects.link(sun)
EEVEE_ENGINE = scene.render.engine


def principled(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


# Muscle red, the same value renderRegionsWithBones.py gives its subject
# muscles, so a muscle looks like the same tissue whichever image it appears in.
#
# It replaces the blue the retired AI panels used. Blue reads as a highlight
# rather than as anatomy, and at low saturation it sat too close to both the
# cream bone and the near-white ground: the thinner structures — the plantar
# intrinsics, the deep spinal series — were hard to pick out at all. Red is
# what the tissue actually is, and it separates cleanly from bone.
highlight_mat = principled("panel_highlight", highlight_rgb, roughness=0.45)
highlight_mat.diffuse_color = highlight_rgb
if APP_HIGHLIGHT:
    # The same lift renderMusclePlates.py gives its HILITE_MAT, so a cyan
    # structure reads as cyan in the shade and not as a dull teal.
    try:
        _hb = highlight_mat.node_tree.nodes["Principled BSDF"]
        _hb.inputs["Emission Color"].default_value = (0.0, 0.85, 1.0, 1)
        _hb.inputs["Emission Strength"].default_value = 0.35
    except KeyError:
        pass
if a.ao:
    _nt = highlight_mat.node_tree
    _b = _nt.nodes["Principled BSDF"]
    _ao = _nt.nodes.new("ShaderNodeAmbientOcclusion")
    _ao.samples = 16
    _ao.inputs["Distance"].default_value = 0.004
    _ao.inputs["Color"].default_value = highlight_rgb
    _g = _nt.nodes.new("ShaderNodeGamma")
    _g.inputs["Gamma"].default_value = 2.2
    _nt.links.new(_ao.outputs["Color"], _g.inputs["Color"])
    _nt.links.new(_g.outputs["Color"], _b.inputs["Base Color"])
    _b.inputs["Roughness"].default_value = 0.42
    try:
        _b.inputs["Emission Strength"].default_value = 0.12 if APP_HIGHLIGHT else 0.0
    except KeyError:
        pass
bone_mat = (boneLook.bone_material("panel_bone") if STUDIO
            else principled("panel_bone", (0.90, 0.88, 0.83, 1.0), roughness=0.6))


def bake_world_mesh(object_names, mesh_name):
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


# How much tighter one side must be before the union is judged to be measuring
# the gap between a pair rather than the muscle. 3x clears the hand and foot
# intrinsics without touching the thigh and shoulder muscles, whose two halves
# sit about their own width apart.
SIDE_FRAMING_RATIO = 3.0


def mesh_bbox(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def bbox_size(bbox_min, bbox_max):
    return max(bbox_max[0] - bbox_min[0], bbox_max[1] - bbox_min[1], bbox_max[2] - bbox_min[2])


def frame_camera(bbox_min, bbox_max, angle_deg, margin, elevation_deg=0.0):
    """Place the camera at `angle_deg` around the body and `elevation_deg` above it.

    Elevation was fixed at zero until flexor-hallucis-brevis showed why that is
    not enough. It is a plantar muscle and the worst-lit panel in the set, 0.30%
    of its own subject visible across the three shipped views.

    Measuring it properly separates two faults. The three shipped angles (0, 90,
    180 degrees) are simply unlucky for this muscle: sampling twelve azimuths at
    the same height finds 4.52%, already above the 3.06% median. Dropping the
    camera to -45 degrees then reaches 9.74%. So the axis is worth having, but
    choosing better angles on the existing one is worth having first.

    The useful elevation belongs to the structure, not to the renderer:
    supraspinatus sits in the supraspinous fossa and reads best at +30, looking
    down. Negative elevation looks up from underneath, positive looks down.
    """
    center = mathutils.Vector(((bbox_min[0] + bbox_max[0]) / 2,
                               (bbox_min[1] + bbox_max[1]) / 2,
                               (bbox_min[2] + bbox_max[2]) / 2))
    size = bbox_size(bbox_min, bbox_max)
    dist = size * 4 + 0.5
    theta = math.radians(angle_deg)
    phi = math.radians(elevation_deg)
    offset = mathutils.Vector((-dist * math.sin(theta) * math.cos(phi),
                               -dist * math.cos(theta) * math.cos(phi),
                               dist * math.sin(phi)))
    loc = center + offset
    cam.location = loc
    cam.rotation_euler = (center - loc).to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = size * margin
    if STUDIO:
        # Fixed to the camera, so every view is lit from over the viewer's left
        # shoulder, from below the foot as much as from in front of the hand.
        boneLook.aim_lights(cam, sun, fill)
    else:
        # Keep the key light off the camera axis at any elevation, or a view
        # from directly below renders flat and unreadable.
        sun.rotation_euler = mathutils.Euler((0.9 - phi * 0.5, 0.3, 0.6 + theta), 'XYZ')


def clear_objects():
    for ob in list(scene.collection.objects):
        if ob not in (cam, sun, fill):
            scene.collection.objects.unlink(ob)


def multiply_lines(path, line_path):
    """The Workbench line pass multiplied over the lit render, where there is
    something under it. Same as renderMusclePlates.py."""
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


def render_to(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if not STUDIO:
        return
    line_path = path[:-4] + ".lines.png"
    scene.render.filepath = line_path
    scene.render.engine = "BLENDER_WORKBENCH"
    try:
        bpy.ops.render.render(write_still=True)
    finally:
        scene.render.engine = EEVEE_ENGINE
    multiply_lines(path, line_path)


def link(mesh, name, material):
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.clear()
    ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.material_index = 0
    scene.collection.objects.link(ob)


def build_mesh(spec, mesh_name):
    """A mesh made from measured geometry, for a structure the atlas lacks.

      {"kind": "tube", "paths": [[[x,y,z], ...], ...], "radius": m}
          a round cord along each path of world-millimetre points, smoothed
          through them: a ligament as a band between its measured attachments.
      {"kind": "hull", "objects": [names], "points": [[x,y,z], ...]}
          the convex hull of the named objects' vertices and/or measured
          points: the patellar ligament as the solid spanning its two
          attachment patches, the TFCC's disc as the slab through its corners.
    """
    out = bmesh.new()
    if spec["kind"] == "tube":
        for i, path in enumerate(spec["paths"]):
            cu = bpy.data.curves.new(f"{mesh_name}_c{i}", "CURVE")
            cu.dimensions = "3D"
            cu.bevel_depth = float(spec["radius"])
            cu.bevel_resolution = 4
            cu.use_fill_caps = True
            sp = cu.splines.new("NURBS")
            sp.points.add(len(path) - 1)
            for p, co in zip(sp.points, path):
                p.co = (co[0] / 1000.0, co[1] / 1000.0, co[2] / 1000.0, 1.0)
            sp.use_endpoint_u = True
            sp.order_u = min(3, len(path))
            ob = bpy.data.objects.new(f"{mesh_name}_o{i}", cu)
            scene.collection.objects.link(ob)
            dg = bpy.context.evaluated_depsgraph_get()
            me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
            out.from_mesh(me)
            bpy.data.meshes.remove(me)
            bpy.data.objects.remove(ob)
            bpy.data.curves.remove(cu)
    elif spec["kind"] == "hull":
        # Measured points (world mm) as well as, or instead of, objects: a
        # triangular disc is the hull of its corners above and below its plane.
        pts = [mathutils.Vector(c) / 1000.0 for c in spec.get("points", [])]
        for n in spec.get("objects", []):
            src = bpy.data.objects.get(n)
            if src and src.type == "MESH":
                pts += [src.matrix_world @ v.co for v in src.data.vertices]
        vs = [out.verts.new(p) for p in pts]
        bmesh.ops.convex_hull(out, input=vs)
        loose = [v for v in out.verts if not v.link_faces]
        bmesh.ops.delete(out, geom=loose, context="VERTS")
    elif spec["kind"] == "gapfill":
        # THE SPACE BETWEEN TWO SETS OF BONES, AND NOTHING ELSE. Over a
        # footprint (world mm, x and y), a vertical line through each grid point
        # meets the upper bones' under-surface and the lower bones' upper
        # surface; the solid is what lies between. Its top IS the upper bones'
        # surface and its bottom the lower bones', so it touches both and cannot
        # pass through or wrap round either — the TFCC between the ulna and
        # radius above and the lunate and triquetrum below (owner, 19 Oct 2026).
        from mathutils.bvhtree import BVHTree

        def tree(names):
            bm_t = bmesh.new()
            for n in names:
                src = bpy.data.objects.get(n)
                if not src:
                    continue
                tmp = src.data.copy()
                tmp.transform(src.matrix_world)
                bm_t.from_mesh(tmp)
                bpy.data.meshes.remove(tmp)
            t = BVHTree.FromBMesh(bm_t)
            bm_t.free()
            return t

        upper, lower = tree(spec["upper"]), tree(spec["lower"])
        foot = [(p[0] / 1000.0, p[1] / 1000.0) for p in spec["footprint"]]
        step = float(spec.get("step", 0.8)) / 1000.0
        max_gap = float(spec.get("maxGap", 12)) / 1000.0
        inset = float(spec.get("inset", 0.2)) / 1000.0
        z_hi, z_lo = spec["zRange"][1] / 1000.0, spec["zRange"][0] / 1000.0

        def inside(x, y):
            c = False
            j = len(foot) - 1
            for i in range(len(foot)):
                xi, yi = foot[i]
                xj, yj = foot[j]
                if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                    c = not c
                j = i
            return c

        xs = [p[0] for p in foot]
        ys = [p[1] for p in foot]
        nx = int((max(xs) - min(xs)) / step) + 2
        ny = int((max(ys) - min(ys)) / step) + 2
        node = {}
        for i in range(nx):
            for j in range(ny):
                x, y = min(xs) + i * step, min(ys) + j * step
                if not inside(x, y):
                    continue
                # Up from below the joint to the upper bones' under-surface, then
                # down from just under that to the first lower bone: the gap.
                # (Down from above starts inside the shaft; up from below meets
                # a carpal's distal face first.)
                up = upper.ray_cast(mathutils.Vector((x, y, z_lo)), mathutils.Vector((0, 0, 1)))
                if up[0] is None or up[0].z > z_hi:
                    continue
                down = lower.ray_cast(mathutils.Vector((x, y, up[0].z - 0.0001)), mathutils.Vector((0, 0, -1)))
                if down[0] is None:
                    continue
                top, bot = up[0].z - inset, down[0].z + inset
                if 0 < top - bot <= max_gap:
                    node[(i, j)] = (x, y, top, bot)
        # A line that grazes the side of a bone jumps to a far surface and draws
        # a spike; a lone cell at the edge draws a tooth. Drop columns that stand
        # out from their neighbours, and cells too short of neighbours to be
        # part of the sheet, a few passes over.
        jump = float(spec.get("maxJump", 1.2)) / 1000.0
        for _ in range(int(spec.get("cleanPasses", 3))):
            keep = {}
            for (i, j), (x, y, top, bot) in node.items():
                nb = [node[(i + di, j + dj)] for di in (-1, 0, 1) for dj in (-1, 0, 1)
                      if (di or dj) and (i + di, j + dj) in node]
                if len(nb) < 5:
                    continue
                tops = sorted(n[2] for n in nb)
                bots = sorted(n[3] for n in nb)
                if abs(top - tops[len(tops) // 2]) > jump or abs(bot - bots[len(bots) // 2]) > jump:
                    continue
                keep[(i, j)] = (x, y, top, bot)
            node = keep
        verts_top, verts_bot = {}, {}
        for k, (x, y, top, bot) in node.items():
            verts_top[k] = out.verts.new((x, y, top))
            verts_bot[k] = out.verts.new((x, y, bot))
        cells = [(i, j) for (i, j) in node if (i + 1, j) in node and (i, j + 1) in node and (i + 1, j + 1) in node]
        cellset = set(cells)
        for (i, j) in cells:
            q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            out.faces.new([verts_top[k] for k in q])
            out.faces.new([verts_bot[k] for k in reversed(q)])
        # Walls on the outline: a cell edge with no cell on its other side.
        for (i, j) in cells:
            for a, b, nb in (((i, j), (i + 1, j), (i, j - 1)), ((i + 1, j), (i + 1, j + 1), (i + 1, j)),
                             ((i + 1, j + 1), (i, j + 1), (i, j + 1)), ((i, j + 1), (i, j), (i - 1, j))):
                if nb not in cellset:
                    try:
                        out.faces.new([verts_top[a], verts_bot[a], verts_bot[b], verts_top[b]])
                    except ValueError:
                        pass
        bmesh.ops.delete(out, geom=[v for v in out.verts if not v.link_faces], context="VERTS")
        print(f"[build] {mesh_name}: gap filled over {len(cells)} cells", flush=True)
    elif spec["kind"] == "fibres":
        # A LIGAMENT AS ITS FIBRES. The atlas's ligament meshes are in the
        # right place but read as flat straps (owner, 17-19 Oct 2026: the
        # deltoid does not fan, the CFL goes through the fibula). The mesh is
        # used only to find WHERE the ligament attaches: its vertices within a
        # couple of millimetres of each named bone are that attachment's
        # footprint. `count` fibres then run from points spread along one
        # footprint to points spread along the other, each bowed outward from
        # the bones by `bow`, as a fan of cords; `subtract` then trims them at
        # the bone surfaces.
        import numpy as np
        from mathutils.bvhtree import BVHTree
        # The atlas's ligaments are a few dozen vertices each, so points are
        # SAMPLED over their faces, by area, rather than read off the vertices.
        rng = np.random.default_rng(7)
        lig = []
        for n in spec["ligament"]:
            o = bpy.data.objects.get(n)
            if not o:
                continue
            mw = o.matrix_world
            for poly in o.data.polygons:
                vs = [mw @ o.data.vertices[i].co for i in poly.vertices]
                for t in range(1, len(vs) - 1):
                    v0, v1, v2 = vs[0], vs[t], vs[t + 1]
                    area = ((v1 - v0).cross(v2 - v0)).length / 2
                    for _ in range(max(1, int(area / 2e-7))):
                        r1, r2 = rng.random(), rng.random()
                        if r1 + r2 > 1:
                            r1, r2 = 1 - r1, 1 - r2
                        lig.append(v0 + (v1 - v0) * r1 + (v2 - v0) * r2)
        near = float(spec.get("near", 3.0)) / 1000.0

        def footprint(names):
            bm_t = bmesh.new()
            for n in names:
                src = bpy.data.objects.get(n)
                if not src:
                    continue
                tmp = src.data.copy()
                tmp.transform(src.matrix_world)
                bm_t.from_mesh(tmp)
                bpy.data.meshes.remove(tmp)
            t = BVHTree.FromBMesh(bm_t)
            bm_t.free()
            dist = np.array([t.find_nearest(p)[3] or 1.0 for p in lig])
            pts = np.array([p[:] for p in lig])
            close = pts[dist < near]
            # A ligament drawn a little off the bone: its nearest tenth instead.
            if len(close) < 12:
                close = pts[np.argsort(dist)[: max(12, len(pts) // 10)]]
            return close

        # Measured spans (world mm) where the atlas's ligament is a single quad
        # and its footprints say nothing: the ATFL, CFL and PTFL.
        if spec.get("fromSpan") and spec.get("toSpan"):
            k_ = int(spec.get("count", 6))
            line = lambda sp: np.array([np.array(sp[0]) + (np.array(sp[1]) - np.array(sp[0])) * t for t in np.linspace(0, 1, max(k_ * 3, 12))]) / 1000.0
            a, b = line(spec["fromSpan"]), line(spec["toSpan"])
        elif list(spec["from"]) == list(spec["to"]):
            # Both ends on one bone (the coraco-acromial ligament, coracoid to
            # acromion; the transverse humeral ligament, tubercle to tubercle):
            # one footprint, so its two ends are its extremes along its length.
            fp = footprint(spec["from"])
            c0 = fp.mean(axis=0)
            ax0 = np.linalg.svd(fp - c0)[2][0]
            t0 = (fp - c0) @ ax0
            a, b = fp[t0 < np.percentile(t0, 22)], fp[t0 > np.percentile(t0, 78)]
        else:
            a, b = footprint(spec["from"]), footprint(spec["to"])
        if len(a) < 3 or len(b) < 3:
            raise ValueError(f"{mesh_name}: footprints too small ({len(a)}, {len(b)})")

        def spread(pts, k):
            c = pts.mean(axis=0)
            axis = np.linalg.svd(pts - c)[2][0]
            t = (pts - c) @ axis
            order = np.argsort(t)
            chunks = np.array_split(pts[order], k)
            return [ch.mean(axis=0) for ch in chunks if len(ch)]

        k = int(spec.get("count", 6))
        pa, pb = spread(a, k), spread(b, k)
        # Pair them so the fibres fan rather than cross.
        straight = sum(np.linalg.norm(x - y) for x, y in zip(pa, pb))
        crossed = sum(np.linalg.norm(x - y) for x, y in zip(pa, pb[::-1]))
        if crossed < straight:
            pb = pb[::-1]
        centre = (np.array(lig).mean(axis=0) if len(lig) else (a.mean(axis=0) + b.mean(axis=0)) / 2) if spec.get("bowFrom") is None else np.array(spec["bowFrom"]) / 1000.0
        # Outward: away from the bones the ligament crosses, measured from a
        # point inside the joint (the bones' common centre near the ligament).
        bone_pts = []
        for n in list(spec["from"]) + list(spec["to"]):
            src = bpy.data.objects.get(n)
            if src:
                vs = np.array([(src.matrix_world @ v.co)[:] for v in src.data.vertices])
                d = np.linalg.norm(vs - centre, axis=1)
                bone_pts.append(vs[d < 0.025])
        inner = np.concatenate([p for p in bone_pts if len(p)]).mean(axis=0) if any(len(p) for p in bone_pts) else centre
        bow = float(spec.get("bow", 1.5)) / 1000.0
        sink = float(spec.get("sink", 0.6)) / 1000.0
        # LAID ON THE BONES. A chord between two attachments passes through
        # the bone it wraps round; so every point along each fibre is moved to
        # the nearest bone surface and lifted clear of it by `lift`, and the
        # fibre runs over the bones the way the ligament does.
        allb = bmesh.new()
        for n in list(spec["from"]) + list(spec["to"]) + list(spec.get("over", [])):
            src = bpy.data.objects.get(n)
            if not src:
                continue
            tmp = src.data.copy()
            tmp.transform(src.matrix_world)
            allb.from_mesh(tmp)
            bpy.data.meshes.remove(tmp)
        bmesh.ops.recalc_face_normals(allb, faces=allb.faces)
        surf = BVHTree.FromBMesh(allb)
        allb.free()
        rad = float(spec.get("radius", 0.0008))
        lift = float(spec.get("lift", 0.4)) / 1000.0 + rad
        paths = []
        for x, y in zip(pa, pb):
            pts = []
            n_s = int(spec.get("samples", 12))
            for i_s in range(n_s + 1):
                s_ = i_s / n_s
                p = mathutils.Vector((x + (y - x) * s_).tolist())
                loc, nrm, _, _ = surf.find_nearest(p)
                if loc is None:
                    pts.append([c * 1000.0 for c in p])
                    continue
                # Ends sink into the bone so the trimmed fibre meets it.
                off = -rad if i_s in (0, n_s) else lift
                q = loc + nrm.normalized() * off
                pts.append([c * 1000.0 for c in q])
            # TIDY (owner, 20 Oct 2026: "quite messy"). Snapping each point to
            # the nearest facet of a coarse bone makes a fibre wobble; averaged
            # with its neighbours a few times, ends held, it runs smoothly.
            for _ in range(int(spec.get("smoothPath", 4))):
                pts = [pts[0]] + [
                    [(pts[i - 1][c] + 2 * pts[i][c] + pts[i + 1][c]) / 4 for c in range(3)]
                    for i in range(1, len(pts) - 1)
                ] + [pts[-1]]
            paths.append(pts)
        # Neighbouring fibres at the same point along their length are averaged
        # a little too, so the band lies flat instead of twisting.
        for _ in range(int(spec.get("smoothAcross", 2))):
            paths = [
                [[(paths[max(j - 1, 0)][i][c] + 2 * paths[j][i][c] + paths[min(j + 1, len(paths) - 1)][i][c]) / 4 for c in range(3)]
                 for i in range(len(paths[j]))]
                for j in range(len(paths))
            ]
        sub = {"kind": "tube", "radius": spec.get("radius", 0.0008), "paths": paths}
        tm = build_mesh(sub, f"{mesh_name}_tubes")
        out.from_mesh(tm)
        bpy.data.meshes.remove(tm)
        print(f"[build] {mesh_name}: {len(paths)} fibres, footprints {len(a)}/{len(b)} verts, ends {np.round(a.mean(axis=0)*1000,1)} -> {np.round(b.mean(axis=0)*1000,1)}, span {np.linalg.norm(a.mean(axis=0)-b.mean(axis=0))*1000:.1f}mm", flush=True)
    elif spec["kind"] == "multi":
        # Several builds as one structure, each finished on its own (its own
        # smoothing and cuts): the TFCC's disc in the gap and the fibre
        # bundles fanning over the back of the joint (owner's reference plate).
        for i, part in enumerate(spec["parts"]):
            pm = build_mesh(part, f"{mesh_name}_p{i}")
            out.from_mesh(pm)
            bpy.data.meshes.remove(pm)
    else:
        raise ValueError("unknown build kind: " + spec["kind"])
    # BOTH SIDES. A midline joint has a ligament each side (owner, 20 Oct
    # 2026: the sternoclavicular ligaments); built on the left, mirrored.
    if spec.get("mirrorX"):
        geom = out.verts[:] + out.edges[:] + out.faces[:]
        dup = bmesh.ops.duplicate(out, geom=geom)
        for v in [g for g in dup["geom"] if isinstance(g, bmesh.types.BMVert)]:
            v.co.x = -v.co.x
        bmesh.ops.reverse_faces(out, faces=[g for g in dup["geom"] if isinstance(g, bmesh.types.BMFace)])
    bmesh.ops.recalc_face_normals(out, faces=out.faces)
    me = bpy.data.meshes.new(mesh_name)
    out.to_mesh(me)
    out.free()
    # SOFTENED. A gap fill is built on a grid, and its walls step and its edges
    # are hard (owner, 19 Oct 2026: "too geometric"). Re-meshed into even
    # voxels and smoothed it reads as tissue; the smoothing swells it a little
    # into the bones, which `subtract` below then cuts back to their surfaces.
    if spec.get("smooth"):
        sm = spec["smooth"]
        ob = bpy.data.objects.new(f"{mesh_name}_smooth", me)
        scene.collection.objects.link(ob)
        rm = ob.modifiers.new("remesh", "REMESH")
        rm.mode = "VOXEL"
        rm.voxel_size = float(sm.get("voxel", 0.4)) / 1000.0
        ls = ob.modifiers.new("smooth", "SMOOTH")
        ls.iterations = int(sm.get("iterations", 20))
        ls.factor = float(sm.get("factor", 0.6))
        if sm.get("inflate"):
            dp = ob.modifiers.new("inflate", "DISPLACE")
            dp.strength = float(sm["inflate"]) / 1000.0
            dp.direction = "NORMAL"
        dg = bpy.context.evaluated_depsgraph_get()
        soft = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me)
        soft.name = mesh_name
        me = soft
    # SHAPED BY THE BONES ROUND IT. A hull spans the space between bones but
    # cuts through their ends (owner, 19 Oct 2026, of the TFCC: "it needs to fit
    # the shape by contacting the bones and not going through them"), so the
    # named bones are subtracted: what is left meets each bone's surface.
    if spec.get("subtract"):
        ob = bpy.data.objects.new(f"{mesh_name}_cut", me)
        scene.collection.objects.link(ob)
        # NO BULGING PAST THE BONES. The hull's outer faces are flat planes
        # between measured corners and stand proud of the bones beside them;
        # `envelope` clips it to the convex envelope of the named bones' parts
        # inside a box (world mm), so its outer surface runs bone to bone.
        env_ob = None
        if spec.get("envelope"):
            env = spec["envelope"]
            lo = mathutils.Vector(env["box"][0]) / 1000.0
            hi = mathutils.Vector(env["box"][1]) / 1000.0
            eb = bmesh.new()
            for n in env["objects"]:
                src = bpy.data.objects.get(n)
                if not src:
                    continue
                for v in src.data.vertices:
                    p = src.matrix_world @ v.co
                    if all(lo[i] <= p[i] <= hi[i] for i in range(3)):
                        eb.verts.new(p)
            bmesh.ops.convex_hull(eb, input=list(eb.verts))
            bmesh.ops.delete(eb, geom=[v for v in eb.verts if not v.link_faces], context="VERTS")
            env_me = bpy.data.meshes.new(f"{mesh_name}_env")
            eb.to_mesh(env_me)
            eb.free()
            env_ob = bpy.data.objects.new(f"{mesh_name}_env", env_me)
            scene.collection.objects.link(env_ob)
            mod = ob.modifiers.new("envelope", "BOOLEAN")
            mod.operation = "INTERSECT"
            mod.solver = "EXACT"
            mod.object = env_ob
        for n in spec["subtract"]:
            cutter = bpy.data.objects.get(n)
            if not cutter:
                continue
            mod = ob.modifiers.new(f"cut_{n}", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.solver = "EXACT"
            mod.object = cutter
        dg = bpy.context.evaluated_depsgraph_get()
        cut = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me)
        if env_ob is not None:
            env_me = env_ob.data
            bpy.data.objects.remove(env_ob)
            bpy.data.meshes.remove(env_me)
        # Keep the largest piece: a cut can leave slivers on the far side of a bone.
        bm = bmesh.new()
        bm.from_mesh(cut)
        parts, seen = [], set()
        for f in bm.faces:
            if f.index in seen:
                continue
            stack, part = [f], []
            seen.add(f.index)
            while stack:
                g = stack.pop()
                part.append(g)
                for e in g.edges:
                    for h in e.link_faces:
                        if h.index not in seen:
                            seen.add(h.index)
                            stack.append(h)
            parts.append(part)
        if len(parts) > 1:
            # Pieces of real size are kept (the TFCC's strip under the radius);
            # only slivers well under the largest go.
            areas = [sum(x.calc_area() for x in p) for p in parts]
            floor = max(areas) * float(spec.get("keepPieces", 1.0))
            keep = {f for p, a in zip(parts, areas) if a >= floor for f in p}
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in keep], context="FACES")
        bm.to_mesh(cut)
        bm.free()
        cut.name = mesh_name
        print(f"[build] {mesh_name}: cut by {len(spec['subtract'])} bone(s), {len(parts)} piece(s), kept {len(cut.polygons)} faces", flush=True)
        me = cut
    return me


def region_mesh(object_names, rule, mesh_name):
    """The faces of each named bone that a landmark rule picks, as one mesh.

    THE ATLAS'S MALLEOLUS IS A DISC, NOT A PIECE OF BONE. "Lateral malleolus.l"
    is a flat marker hung beside the fibula, and painted cyan it reads as a
    plate floating off the ankle. The malleolus is the END OF THE BONE, so the
    highlight is grown on the bone's own surface by the landmark pipeline's
    rules (landmarkRegions.py), exactly as renderLandmarkRegions.py does it:
    bake to world space, make the normals consistent, subdivide so the edge is
    not a sawtooth, select, and lift the kept faces 0.4mm so they draw in front
    of the same bone in the skeleton bake.

    TWO THINGS A CARD PICTURE NEEDS THAT A TAP TARGET DOES NOT. A `cap` is cut
    face by face, and the long thin triangles of a shaft leave its edge a row
    of teeth, which a traced hotspot smooths away and a painted picture shows.
    So the bone is first BISECTED on the cap's own plane and the edge is a
    clean line. And `medialWidth` keeps only that much of the slab, measured
    in from its most medial point, toward the midline whichever leg it is: the
    lowest slab of the tibia is the whole rim of the plafond, and the malleolus
    is only its medial end. keepIf cannot say that, since its axis is fixed and
    the two legs' medial sides face opposite ways.
    """
    import numpy as np
    from landmarkRegions import select_faces
    out = bmesh.new()
    for n in object_names:
        src = bpy.data.objects.get(n)
        if not src or src.type != "MESH" or not src.data.vertices:
            continue
        bm = bmesh.new()
        tmp = src.data.copy()
        for v in tmp.vertices:
            v.co = src.matrix_world @ v.co
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for _ in range(int(rule.get("subdivide", 2))):
            bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
        medial_cut = None
        if rule.get("kind") == "cap" and not isinstance(rule["direction"], str):
            d = mathutils.Vector(rule["direction"]).normalized()
            reach = max(v.co.dot(d) for v in bm.verts) - float(rule["depth"])
            bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                   plane_co=d * reach, plane_no=d, dist=1e-6)
            if rule.get("medialWidth"):
                cx = sum(v.co.x for v in bm.verts) / len(bm.verts)
                m = mathutils.Vector((-1.0 if cx > 0 else 1.0, 0.0, 0.0))
                edge = max(v.co.dot(m) for v in bm.verts if v.co.dot(d) >= reach) - float(rule["medialWidth"])
                bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                       plane_co=m * edge, plane_no=m, dist=1e-6)
                medial_cut = (m, edge)
        bm.faces.ensure_lookup_table()
        bm.verts.ensure_lookup_table()
        faces = list(bm.faces)
        index = {f: i for i, f in enumerate(faces)}
        adjacency = [[index[o] for e in f.edges for o in e.link_faces if o is not f] for f in faces]
        mask, _ = select_faces([v.co.copy() for v in bm.verts], [v.normal.copy() for v in bm.verts],
                               [f.calc_center_median() for f in faces], [f.normal.copy() for f in faces],
                               rule, {}, adjacency)
        if medial_cut:
            mask &= np.array([f.calc_center_median().dot(medial_cut[0]) >= medial_cut[1] for f in faces])
        print(f"[region] {mesh_name}: {int(mask.sum())}/{len(faces)} faces on {n}", flush=True)
        bmesh.ops.delete(bm, geom=[f for i, f in enumerate(faces) if not mask[i]], context="FACES")
        for v in bm.verts:
            v.co = v.co + v.normal * 0.0004
        part = bpy.data.meshes.new(mesh_name + "_part")
        bm.to_mesh(part)
        bm.free()
        out.from_mesh(part)
        bpy.data.meshes.remove(part)
    mesh = bpy.data.meshes.new(mesh_name)
    out.to_mesh(mesh)
    out.free()
    return mesh


skel = bpy.data.collections.get("1: Skeletal system")
# Z-Anatomy titles each top-level collection with a text mesh — "Skeletal
# system.g", "Muscular system.g", "Joints.g" — and it lives INSIDE the
# collection it names, so baking every mesh in "1: Skeletal system" bakes its
# title too. It sits beside the body and only enters frame on a wide shot, which
# is why it went unnoticed: "SYSTEM" is printed at both edges of every panel
# framed on the whole body, mirrored on the right, and has been in production
# on brachioradialis, flexor-digitorum-profundus, interspinales, multifidus and
# rotatores. `.g` is only ever a label, never anatomy.
bone_names = [o.name for o in skel.all_objects if o.type == "MESH" and boneLook.is_bone(o.name)]
# THE FAR LIMB IS NOT CONTEXT. A plantar view of one foot is taken from far
# enough below the body that the other foot walks into the edge of frame, and
# the trim that crops the finished panel then keeps it: the subject ends up
# off-centre next to half a stranger. A panel framed on one side shows that
# side. The axial skeleton carries no suffix and is unaffected.
if framed_side:
    other = ".r" if framed_side == ".l" else ".l"
    bone_names = [n for n in bone_names if not n.endswith(other)]
# An explicit backdrop wins outright. Dropping the far side is enough for a
# hand, whose frame is barely wider than it is; a forearm needs a frame deep
# enough to reach the elbow, and at that size the near femur stands beside the
# hand and the trim keeps it. Saying which bones may appear settles it.
if backdrop_only:
    bone_names = backdrop_only
print(f"[bones] baking {len(bone_names)} meshes...", flush=True)
bone_mesh = bake_world_mesh(bone_names, "panel_bones")
print(f"[bones] {len(bone_mesh.vertices)} verts", flush=True)
# Tissue drawn for context, in the red the region plates give a muscle
# (renderRegionsWithBones.py), so it reads as tissue rather than as the answer.
context_names = [n for n in a.context.split(",") if n]
context_mesh = bake_world_mesh(context_names, "panel_context") if context_names else None
context_mat = principled("panel_context", (0.76, 0.27, 0.25, 1.0), roughness=0.55)
# Neighbouring ligaments: the pale blue-grey a ligament is drawn in on a plate.
ligament_grey_mat = principled("panel_ligament_grey", (0.80, 0.83, 0.88, 1.0), roughness=0.5)
grain_mat = principled("panel_grain", (0.0, 0.52, 0.72, 1.0), roughness=0.5)

# FRAME ON THE HAND, NOT ON THE MUSCLE INSIDE IT.
#
# Every panel frames its own subject, which is right for a deltoid and wrong
# for opponens digiti minimi: the shot comes out as three strips of bone with
# a red thread in them, and nothing in it says whether you are looking at the
# palm or the back of the hand. The answer to "which structure is shown" is
# unanswerable if you cannot tell which side of the hand you are on, and the
# fix is not a better angle, it is a wider one — the whole hand in shot, from
# a side that is named.
#
# Computed once: it is the same box for every subject in the run, which is the
# point of it.
shared_box = None
if frame_on:
    frame_mesh = bake_world_mesh(frame_on, "panel_frame_on")
    if len(frame_mesh.vertices) == 0:
        print(f"[error] --frame-on matched no geometry", flush=True)
        sys.exit(1)
    # One side, always. The two hands hang the width of the body apart, so their
    # union frames the torso between them — the very failure this exists to fix.
    one = _one_side
    if framed_side:
        side_mesh = bake_world_mesh(one, "panel_frame_on_side")
        if len(side_mesh.vertices) > 0:
            bpy.data.meshes.remove(frame_mesh)
            frame_mesh = side_mesh
        else:
            bpy.data.meshes.remove(side_mesh)
    shared_box = mesh_bbox(frame_mesh)
    bpy.data.meshes.remove(frame_mesh)
    print(f"[frame] framing every render on {len(frame_on)} objects", flush=True)

t0 = time.time()
count = 0
for mid in wanted:
    entry = mapping.get(mid)
    if not entry or not entry.get("blenderObjects"):
        print(f"[warn] no mapping for {mid}, skipping", flush=True)
        continue

    objects = entry["blenderObjects"]
    # Highlight only the side that is in shot. The two feet sit close enough
    # that a plantar view framed on one has the other at the edge of frame, and
    # a red sliver of a muscle that is not the subject is worse than no sliver.
    if framed_side:
        objects = [o for o in objects if o.endswith(framed_side)] or objects
    mesh = bake_world_mesh(objects, f"panel_{mid}")
    if len(mesh.vertices) == 0:
        print(f"[warn] {mid}: empty bake, skipping", flush=True)
        continue

    bmin, bmax = shared_box if shared_box else mesh_bbox(mesh)

    # FRAME ONE SIDE WHEN THE PAIR IS WHAT IS WIDE, NOT THE MUSCLE.
    #
    # Nearly every muscle here is a .l/.r pair, and framing their union means
    # framing the gap between them. For a thigh or a shoulder that gap is
    # roughly the muscle's own size and the shot is fine. For the hand
    # intrinsics it is the entire width of the body: opponens pollicis came
    # out as a full skeleton with two invisible specks in it, and eight
    # panels were unusable for exactly this reason.
    #
    # So: if one side alone is dramatically tighter than the union, the union
    # is measuring the pose rather than the anatomy — frame the side instead.
    # Both sides still render highlighted; only the camera changes. The
    # threshold is deliberately loose so muscles that genuinely read better
    # as a symmetric pair keep their existing framing.
    side = [o for o in objects if o.endswith(".l")] or [o for o in objects if o.endswith(".r")]
    if shared_box is None and side and len(side) < len(objects):
        side_mesh = bake_world_mesh(side, f"frame_{mid}")
        if len(side_mesh.vertices) > 0:
            smin, smax = mesh_bbox(side_mesh)
            # The ratio test misses the forearm: the two forearms hang about a
            # forearm's length apart, so the pair measures roughly twice one
            # side, under the 3x threshold — and framing the pair means framing
            # the whole body. flexor-pollicis-longus came out as a full skeleton
            # with a red line down each arm. Forcing it per muscle, rather than
            # lowering the ratio, leaves every thigh and shoulder panel as it is.
            if (mid in force_one_side
                    or bbox_size(bmin, bmax) > bbox_size(smin, smax) * SIDE_FRAMING_RATIO):
                bmin, bmax = smin, smax
                print(f"[frame] {mid}: framed on one side", flush=True)
        bpy.data.meshes.remove(side_mesh)

    # A region on the bone replaces the atlas's marker as what is PAINTED; the
    # marker above still frames the shot, so the layout does not move.
    region = REGIONS.get(mid)
    if isinstance(region, dict) and region.get("rule"):
        parents = region["parentObjects"]
        if framed_side:
            parents = [o for o in parents if o.endswith(framed_side)] or parents
        grown = region_mesh(parents, region["rule"], f"panel_{mid}_region")
        if len(grown.vertices) == 0:
            print(f"[warn] {mid}: region rule selected nothing, keeping the mapped objects", flush=True)
            bpy.data.meshes.remove(grown)
        else:
            bpy.data.meshes.remove(mesh)
            mesh = grown
    # A STRUCTURE THE MODEL DOES NOT HAVE. The alar ligaments and the
    # transverse ligament of the atlas are not in Z-Anatomy at all, and the
    # patellar ligament is only its two attachment patches. `build` makes the
    # painted mesh from measured points instead (panel-regions.rules.json says
    # where each number came from); the mapped objects still frame the shot.
    if isinstance(region, dict) and region.get("build"):
        built = build_mesh(region["build"], f"panel_{mid}_built")
        bpy.data.meshes.remove(mesh)
        mesh = built
    # NEIGHBOURS, PALE. The deltoid's parts are three cards; each shows its own
    # fibres in the highlight and its siblings' in pale ligament grey, so the
    # fan reads as one ligament. `contextBuild` is a list of build specs.
    # FIBRE GRAIN. Fine fibres laid over a solid band, drawn a shade darker
    # than the highlight, so the band reads as one ligament and its fibre
    # direction still shows (owner, 20 Oct 2026, the UCL's three bundles).
    grain_built = None
    if isinstance(region, dict) and region.get("grainBuild"):
        gb = bmesh.new()
        for i, spec_g in enumerate(region["grainBuild"]):
            m_g = build_mesh(spec_g, f"panel_{mid}_grain{i}")
            gb.from_mesh(m_g)
            bpy.data.meshes.remove(m_g)
        grain_built = bpy.data.meshes.new(f"panel_{mid}_grain")
        gb.to_mesh(grain_built)
        gb.free()
        print(f"[grain] {mid}: {len(grain_built.polygons)} faces", flush=True)
    ctx_built = None
    if isinstance(region, dict) and region.get("contextBuild"):
        cb = bmesh.new()
        for i, spec_c in enumerate(region["contextBuild"]):
            m_c = build_mesh(spec_c, f"panel_{mid}_ctx{i}")
            cb.from_mesh(m_c)
            bpy.data.meshes.remove(m_c)
        ctx_built = bpy.data.meshes.new(f"panel_{mid}_ctx")
        cb.to_mesh(ctx_built)
        cb.free()

    for elev in elevations:
        for frame in views:
            frame_camera(bmin, bmax, frame * 360.0 / a.frames, a.margin, elev)
            clear_objects()
            link(bone_mesh, "panel_skeleton", bone_mat)
            if context_mesh is not None:
                link(context_mesh, "panel_context", context_mat)
            if ctx_built is not None:
                link(ctx_built, "panel_ctx_built", ligament_grey_mat)
            if grain_built is not None:
                link(grain_built, "panel_grain", grain_mat)
            link(mesh, f"panel_{mid}_hi", highlight_mat)
            # Elevation 0 keeps the flat <mid>/view-NN.png layout the compositor
            # and the existing 130 panels already use; anything else gets its own
            # subdirectory, so adding the axis cannot disturb what is shipped.
            leaf = f"view-{frame:02d}.png"
            parts = [a.out, mid] if elev == 0 else [a.out, mid, f"elev{elev:+03.0f}"]
            path = os.path.abspath(os.path.join(*parts, leaf))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            render_to(path)
            count += 1

    bpy.data.meshes.remove(mesh)
    print(f"[panel] {mid} ({count} renders, {time.time() - t0:.0f}s)", flush=True)

print(f"[complete] {count} renders in {time.time() - t0:.0f}s -> {a.out}", flush=True)
