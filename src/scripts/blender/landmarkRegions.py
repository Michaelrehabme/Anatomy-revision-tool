"""Grows a landmark's region on its parent bone.

A landmark is not separable geometry — "the linea aspera" names a region of the
femur, and the atlas models it as a two-vertex label anchor. To draw one as a
shape rather than a circle, the region has to be GROWN on the bone, and this is
where the rules for growing it live.

THE ANCHOR CANNOT PLACE THE REGION. Probing the atlas, the linea aspera's anchor
snaps to a point 6mm from the femoral shaft's own centre-line — not to the
posterior ridge the name means. Anchors are where a label's leader line starts,
so they are near the landmark, not on it. Every rule below therefore takes its
geometry from the BONE'S OWN SHAPE (the most posterior surface along the shaft,
the highest edge of the ilium) and uses the anchor only to pick the side of the
body and, sometimes, to bound the run.

FOUR RULES, which between them cover every landmark that needs one:

  ridge   The extreme surface in some direction, swept along the bone — the
          linea aspera is "most posterior, down the middle of the shaft", the
          iliac crest is "highest, from the ASIS round to the PSIS". Produces a
          polyline that follows the bone's real curve.
  span    A band between two named anchors, every sample snapped to the bone —
          the intertrochanteric line runs from the greater to the lesser
          trochanter, and both anchors exist.
  trail   A band from one anchor running a fixed distance in some direction,
          for a feature with only one named end: the intertubercular sulcus
          runs distally from between the two tubercles.
  cap     The extreme slab of a bone — the tibial plateau is its top, the
          vertebral body is everything in front of the pedicles.

Everything but `cap` produces SEED POINTS, and the region is then the set of
faces within `width` of the nearest seed. That keeps one notion of thickness
across all of them, and it follows the surface instead of cutting through it.
"""
import mathutils
import numpy as np
from mathutils import kdtree


def _dilate(mask, adjacency):
    out = mask.copy()
    for i, nbrs in enumerate(adjacency):
        if not mask[i]:
            for n in nbrs:
                if mask[n]:
                    out[i] = True
                    break
    return out


def _erode(mask, adjacency):
    out = mask.copy()
    for i, nbrs in enumerate(adjacency):
        if mask[i]:
            for n in nbrs:
                if not mask[n]:
                    out[i] = False
                    break
    return out


def _largest_island(mask, adjacency):
    """Keep only the biggest connected patch.

    A distance threshold picks up strays: a stray triangle on the far lip of a
    foramen is within 7mm of the sacral crest through the bone, and reads as a
    second, wrong answer.
    """
    seen = np.zeros(len(mask), dtype=bool)
    best = None
    for start in range(len(mask)):
        if not mask[start] or seen[start]:
            continue
        stack, group = [start], []
        seen[start] = True
        while stack:
            i = stack.pop()
            group.append(i)
            for n in adjacency[i]:
                if mask[n] and not seen[n]:
                    seen[n] = True
                    stack.append(n)
        if best is None or len(group) > len(best):
            best = group
    out = np.zeros(len(mask), dtype=bool)
    if best:
        out[best] = True
    return out


def tidy(mask, adjacency, rule):
    """Turns a threshold's ragged edge into a shape worth drawing.

    A hard distance test against a coarse mesh gives a sawtooth boundary and
    pinholes, because whole triangles are in or out. Closing (grow then shrink)
    fills the holes, opening (shrink then grow) drops the specks, and the
    largest-island pass removes anything left stranded. Subdividing the bone
    first is what makes these operate on a fine enough scale to read as smooth.
    """
    if not mask.any():
        return mask
    for _ in range(int(rule.get("close", 2))):
        mask = _dilate(mask, adjacency)
    for _ in range(int(rule.get("close", 2))):
        mask = _erode(mask, adjacency)
    for _ in range(int(rule.get("open", 1))):
        mask = _erode(mask, adjacency)
    for _ in range(int(rule.get("open", 1))):
        mask = _dilate(mask, adjacency)
    if rule.get("keepLargest", True) and mask.any():
        mask = _largest_island(mask, adjacency)
    return mask


def smoothed_normals(face_normals, adjacency, rounds):
    """Face normals averaged with their neighbours'.

    A "keep the faces pointing forward" test run on raw normals is a speckle
    generator: bone is bumpy, so on any real surface a scatter of individual
    triangles tilt past the threshold and drop out, punching holes through the
    middle of a band and nibbling its edge. Averaging first asks which way the
    SURFACE faces rather than which way one triangle happens to, which is the
    question the rule meant.
    """
    N = np.array([n[:] for n in face_normals], dtype=float)
    for _ in range(rounds):
        out = N.copy()
        for i, nbrs in enumerate(adjacency):
            if nbrs:
                out[i] = (N[i] + N[nbrs].sum(axis=0)) / (1 + len(nbrs))
        lens = np.linalg.norm(out, axis=1, keepdims=True)
        N = np.divide(out, lens, out=np.zeros_like(out), where=lens > 1e-9)
    return N


def _axis_of(points_np):
    """The bone's own long axis, from its vertices — first principal component."""
    mean = points_np.mean(axis=0)
    _, _, vt = np.linalg.svd(points_np - mean, full_matrices=False)
    return mean, vt[0]


def _unit(v):
    v = np.array(v, dtype=float)
    n = np.linalg.norm(v)
    return v / n if n else v


def ridge_seeds(verts_np, rule, mean, long_axis, extra_mask=None, bin_axis_override=None):
    """The extreme surface in `extreme`, swept in bins along `binAxis`.

    A crest IS an extreme: the linea aspera is the most posterior line down the
    back of the femur, and the iliac crest the highest line across the top of
    the ilium. Taking the extreme vertex per slice traces it without anyone
    having to say where it runs.
    """
    bin_axis = _unit(bin_axis_override if bin_axis_override is not None else (rule.get("binAxis") or long_axis))
    extreme = _unit(rule["extreme"])
    lo, hi = rule.get("range", [0.0, 1.0])
    bins = int(rule.get("bins", 24))

    # Optional: stay near a plane, for a midline ridge like the sacral crest
    # where the bone is wide and the extreme would otherwise wander laterally.
    mask = np.ones(len(verts_np), dtype=bool)
    if extra_mask is not None:
        mask &= extra_mask
    near = rule.get("nearPlane")
    if near:
        d = np.abs((verts_np - mean) @ _unit(near["normal"]))
        mask &= d <= near["within"]
    if not mask.any():
        return []

    t = (verts_np - mean) @ bin_axis
    # Measured across the CANDIDATES, not the whole bone: a ridge confined to a
    # span covers a small slice of an oblique axis, and binning over the bone's
    # full extent would leave almost every bin empty.
    t0, t1 = t[mask].min(), t[mask].max()
    span = t1 - t0
    if span <= 0:
        return []

    e = (verts_np - mean) @ extreme
    seeds = []
    for i in range(bins):
        a = t0 + span * (lo + (hi - lo) * i / bins)
        b = t0 + span * (lo + (hi - lo) * (i + 1) / bins)
        sel = mask & (t >= a) & (t < b)
        if not sel.any():
            continue
        idx = np.where(sel)[0]
        seeds.append(verts_np[idx[np.argmax(e[idx])]])
    return [mathutils.Vector(p) for p in seeds]


def _line(a, b, samples, trim):
    """Points along a chord, optionally only its middle."""
    lo, hi = trim
    return [a.lerp(b, lo + (hi - lo) * (i / (samples - 1))) for i in range(samples)]


def span_seeds(a, b, samples, snap, trim=(0.0, 1.0)):
    """A band between two anchors, every sample pulled back onto the bone.

    Snapping every sample and not only the ends is the point: the straight line
    between two anchors cuts through the bone wherever the feature curves, and
    the intertrochanteric line curves.

    `snap` may be None, for a feature that wraps the bone rather than sitting on
    one face of it — the femoral neck is a collar, and snapping its samples to
    the nearest surface would hug one side and drop the rest.
    """
    pts = _line(a, b, samples, trim)
    return [snap(p) for p in pts] if snap else pts


def trail_seeds(start, direction, length, samples, snap, offset=0.0):
    """A band running a fixed distance from one point, snapped to the bone.

    `offset` starts it short of the named point. The intertubercular sulcus
    begins BETWEEN the tubercles, but the tubercles' own anchors sit above them,
    so a trail from their midpoint would climb onto the humeral head.
    """
    d = mathutils.Vector(_unit(direction))
    pts = [start + d * (offset + length * i / (samples - 1)) for i in range(samples)]
    return [snap(p) for p in pts] if snap else pts


def fit_sphere(points_np):
    """Least-squares sphere through a patch of surface: centre and radius.

    The head of a bone IS a sphere, so fitting one finds its centre from the
    surface around it — which the anchor cannot, since a `.j` floats outside the
    bone and snapping it lands somewhere on the head's skin rather than at its
    middle. Measured on the femur this returns a 23mm radius, which is a
    femoral head.
    """
    A = np.hstack([2 * points_np, np.ones((len(points_np), 1))])
    b = (points_np ** 2).sum(axis=1)
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    centre = sol[:3]
    return centre, float(np.sqrt(max(sol[3] + (centre ** 2).sum(), 1e-9)))


def cap_mask(face_centres_np, rule, mean, long_axis=None, anchor=None):
    """The extreme slab: everything within `depth` of the furthest point along
    `direction`. The tibial plateau is the top of the tibia; the vertebral body
    is everything in front of the pedicles.

    `direction` may be the string "towardAnchor": the bone's own long axis,
    signed so the landmark's anchor lies at the positive end. That is the head
    of a metatarsal or metacarpal — the distal end of the bone, whichever way
    the bone happens to point. Fitting a sphere to one gave a collar round the
    neck instead, because a head that small is not sphere enough to fit.
    """
    direction = rule["direction"]
    if direction == "towardAnchor":
        d = _unit(long_axis)
        if anchor is not None and float(np.dot(np.array(anchor[:], dtype=float) - mean, d)) < 0:
            d = -d
    else:
        d = _unit(direction)
    p = (face_centres_np - mean) @ d
    return p >= (p.max() - rule["depth"])


def _snapper(bone_verts, vert_normals, facing):
    """Pulls a point onto the bone's surface.

    WITH `facing`, only vertices pointing that way are candidates. That is what
    separates the intertrochanteric LINE from the intertrochanteric CREST: they
    run between the same two trochanters, one across the front of the femur and
    one across the back, and the chord between the anchors passes through the
    bone — so an unfiltered snap lands on whichever surface happens to be
    nearer and mixes the two features together.
    """
    idx = range(len(bone_verts))
    if facing is not None:
        f = _unit(facing)
        idx = [i for i in idx if np.dot(np.array(vert_normals[i][:], dtype=float), f) > 0]
        if not idx:
            idx = range(len(bone_verts))
    tree = kdtree.KDTree(len(idx))
    for i in idx:
        tree.insert(bone_verts[i], i)
    tree.balance()

    def snap(p):
        co, _, _ = tree.find(p)
        return mathutils.Vector(co)

    return snap


def resolve_point(spec, anchors, bone_verts, verts_np, snap):
    """Where a rule's endpoint actually is.

    A `.j` anchor is where a LABEL starts, not where the feature is: the
    femoral head's anchor floats outside the head, so a chord drawn to it runs
    above the neck and picks out the neck's top rim instead of its collar.
    These forms let a rule name a point on the bone rather than a point near it.

      "Name.j"                      the raw anchor, as authored
      {"snap": "Name.j"}            the nearest surface point to it
      {"centroidNear": "Name.j",    the centre of the lump around it — the
       "radius": 0.03}              femoral head's real centre, for an axis
      {"midpoint": [specA, specB]}  halfway between two of the above
      {"bbox": [fx, fy, fz]}        a place in the bone's own bounding box, as
                                    fractions — for a bone whose anchors are
                                    nowhere near it. The atlas's tubercle
                                    anchors float 20mm below the vertebra.
    """
    if isinstance(spec, str):
        return anchors[spec]
    if "world" in spec:
        # A MEASURED PLACE, in world millimetres, for a feature that has no
        # anchor anywhere near it and is not at any fraction of the bone's box
        # worth naming — the bottom of the intercondylar notch, found by
        # profiling the back of the distal femur. Say where the number came
        # from in the rule's _why.
        return mathutils.Vector(spec["world"]) / 1000.0
    if "bbox" in spec:
        lo, hi = verts_np.min(axis=0), verts_np.max(axis=0)
        return mathutils.Vector(lo + (hi - lo) * np.array(spec["bbox"], dtype=float))
    if "offset" in spec:
        # A MEASURED CORRECTION to where an anchor lands, in world metres,
        # applied before the ball snaps it back onto the surface. The radial
        # tuberosity's anchor snaps to the lateral side of the bone when the
        # tuberosity is anteromedial; probing the slice at its height gives
        # the medial edge 12mm away, and this carries that number rather than
        # a guess. Keep the offset small and write down where it came from.
        base = resolve_point(spec["of"], anchors, bone_verts, verts_np, snap)
        return base + mathutils.Vector(spec["offset"])
    if "midpoint" in spec:
        a, b = (resolve_point(s, anchors, bone_verts, verts_np, snap) for s in spec["midpoint"])
        return (a + b) / 2
    if "snap" in spec:
        return snap(anchors[spec["snap"]])
    if "centroidNear" in spec:
        seed = snap(anchors[spec["centroidNear"]])
        d = np.linalg.norm(verts_np - np.array(seed[:], dtype=float), axis=1)
        near = verts_np[d <= spec.get("radius", 0.03)]
        if not len(near):
            return seed
        return mathutils.Vector(near.mean(axis=0))
    raise ValueError("unknown point spec: " + repr(spec))


def select_faces(bone_verts, vert_normals, face_centres, face_normals, rule, anchors, adjacency=None):
    """Which of the bone's faces belong to this landmark.

    Returns `(mask, seeds)`: a boolean mask over faces, and the 3-D centre-line
    the rule was grown from where it has one. THE CENTRE-LINE IS WORTH KEEPING —
    a crest is a line, and projecting that line per view gives a capsule that
    can be scored with rings, which an outline traced around it cannot. A `cap`
    or `sphere` has no centre-line and returns an empty list.
    """
    verts_np = np.array([v[:] for v in bone_verts], dtype=float)
    centres_np = np.array([c[:] for c in face_centres], dtype=float)
    mean, long_axis = _axis_of(verts_np)
    kind = rule["kind"]
    seeds = []
    # Every side-of-the-bone test below uses these, not the raw triangle normals.
    normals_np = (
        smoothed_normals(face_normals, adjacency, int(rule.get("smoothNormals", 4)))
        if adjacency is not None
        else np.array([n[:] for n in face_normals], dtype=float)
    )
    # A rule that says which way the feature faces snaps to that side too,
    # unless it deliberately opts out (a collar has no one side).
    snap_facing = rule.get("snapFacing", rule.get("facing"))
    snap = None if rule.get("snap") is False else _snapper(bone_verts, vert_normals, snap_facing)
    trim = tuple(rule.get("trim", [0.0, 1.0]))

    if kind == "box":
        # A PART OF A BONE WITH NO USABLE ANCHOR AND NO EXTREME TO FIND. The
        # pedicle is neither the top, the back nor the side of a vertebra — it
        # is the short bridge between body and arch — and the atlas's "pedicle"
        # anchor snaps to the tip of the transverse process. So the rule says
        # where it is, in fractions of the bone's own bounding box, from
        # numbers measured on the mesh.
        lo, hi = verts_np.min(axis=0), verts_np.max(axis=0)
        f = (centres_np - lo) / (hi - lo)
        mask = np.all((f >= np.array(rule["lo"], dtype=float)) & (f <= np.array(rule["hi"], dtype=float)), axis=1)
        seeds = []
    elif kind == "cap":
        anchor_pt = None
        if rule.get("from"):
            anchor_pt = _snapper(bone_verts, vert_normals, None)(anchors[rule["from"]])
        mask = cap_mask(centres_np, rule, mean, long_axis, anchor_pt)
    elif kind == "rim":
        # THE EDGE OF ANOTHER REGION. The anatomical neck is not a patch and not
        # a band at a fixed distance — it is precisely the line where the head's
        # articular surface stops, so it is defined as the boundary of the head
        # rather than guessed at with a radius. Taking a shell of the fitted
        # sphere instead covered a third of the proximal humerus, because on a
        # curved surface a few millimetres of radius is a wide swath of skin.
        if adjacency is None:
            raise ValueError("a rim needs face adjacency")
        inner, _ = select_faces(bone_verts, vert_normals, face_centres, face_normals,
                                rule["of"], anchors, None)
        band = np.zeros(len(face_centres), dtype=bool)
        for i, nbrs in enumerate(adjacency):
            for n in nbrs:
                if inner[i] != inner[n]:
                    band[i] = True
                    break
        for _ in range(int(rule.get("width", 3))):
            band = _dilate(band, adjacency)
        mask = band

        # A RIM IS A CLOSED LOOP, and a loop is a line worth scoring with rings.
        # Its faces have no order, so the centre-line is recovered by fitting a
        # plane through them, sorting by angle about their centre and taking the
        # median radius per sector — which is a circle on the bone, in order.
        ring = centres_np[band]
        if len(ring) >= 12:
            c = ring.mean(axis=0)
            _, _, vt = np.linalg.svd(ring - c, full_matrices=False)
            u, v, n = vt[0], vt[1], vt[2]
            rel = ring - c
            ang = np.arctan2(rel @ v, rel @ u)
            rad = np.linalg.norm(rel - np.outer(rel @ n, n), axis=1)
            sectors = int(rule.get("loopSamples", 24))
            loop = []
            for s in range(sectors):
                lo_a = -np.pi + 2 * np.pi * s / sectors
                hi_a = -np.pi + 2 * np.pi * (s + 1) / sectors
                sel = (ang >= lo_a) & (ang < hi_a)
                if not sel.any():
                    continue
                mid = (lo_a + hi_a) / 2
                r = float(np.median(rad[sel]))
                loop.append(c + u * (r * np.cos(mid)) + v * (r * np.sin(mid)))
            if len(loop) >= 6:
                loop.append(loop[0])  # close it, so the last segment is scored too
                seeds = [mathutils.Vector(p) for p in loop]
    elif kind == "shell":
        # THE RIM AROUND A HEAD. The anatomical neck is not a point and not a
        # patch: it is the groove encircling the articular surface, so it is the
        # band of bone lying just beyond the sphere the head was fitted to.
        seed = np.array(_snapper(bone_verts, vert_normals, None)(anchors[rule["from"]])[:], dtype=float)
        within = float(rule.get("fitRadius", 0.024))
        near = verts_np[np.linalg.norm(verts_np - seed, axis=1) <= within]
        if len(near) < 12:
            return np.zeros(len(face_centres), dtype=bool), []
        centre, radius = fit_sphere(near)
        d = np.linalg.norm(centres_np - centre, axis=1)
        mask = (d >= radius * float(rule.get("inner", 0.98))) & (d <= radius * float(rule.get("outer", 1.22)))
        away = centres_np - centre
        lens = np.linalg.norm(away, axis=1, keepdims=True)
        outward = np.divide(away, lens, out=np.zeros_like(away), where=lens > 1e-9)
        mask &= (outward * normals_np).sum(axis=1) > float(rule.get("outwardMin", 0.1))
    elif kind == "sphere":
        # THE HEAD OF A BONE. Fit a sphere to the surface around the anchor,
        # then keep everything on it: a head is the one landmark whose shape is
        # known in advance, so it needs no hand-tuned radius — the bone's own
        # curvature says how big it is.
        # `from` may be any point spec: the humeral head's own anchor sits in
        # the middle of the proximal humerus, and a sphere fitted round it took
        # in the tubercles and came out as the whole top of the bone.
        _from = rule["from"]
        _p = anchors[_from] if isinstance(_from, str) else resolve_point(
            _from, anchors, bone_verts, verts_np, _snapper(bone_verts, vert_normals, None))
        seed = np.array(_snapper(bone_verts, vert_normals, None)(_p)[:], dtype=float)
        within = float(rule.get("fitRadius", 0.03))
        near = verts_np[np.linalg.norm(verts_np - seed, axis=1) <= within]
        if len(near) < 12:
            return np.zeros(len(face_centres), dtype=bool), []
        centre, radius = fit_sphere(near)
        # A head's articular surface runs a little past the equator of the
        # sphere it was fitted to, so `grow` reaches slightly beyond it.
        keep = radius * float(rule.get("grow", 1.06))
        mask = np.linalg.norm(centres_np - centre, axis=1) <= keep
        # Everything inside the shaft is also within that radius; drop anything
        # whose normal points back toward the centre.
        away = centres_np - centre
        lens = np.linalg.norm(away, axis=1, keepdims=True)
        outward = np.divide(away, lens, out=np.zeros_like(away), where=lens > 1e-9)
        mask &= (outward * normals_np).sum(axis=1) > float(rule.get("outwardMin", 0.2))
    else:
        def point(spec):
            return resolve_point(spec, anchors, bone_verts, verts_np, snap or _snapper(bone_verts, vert_normals, None))

        if kind == "ridge":
            # A ridge confined between two anchors: "the most anterior line
            # BETWEEN the trochanters". Without the confinement the bins would
            # be spread over the whole femur and the crest of the shaft would
            # win; without the ridge it would be a band along the chord, which
            # is a blob rather than a line.
            extra, bin_axis = None, None
            span = rule.get("nearSpan")
            if span:
                a, b = point(span["from"]), point(span["to"])
                ab = np.array((b - a)[:], dtype=float)
                seg_len = np.linalg.norm(ab)
                if seg_len > 1e-9:
                    bin_axis = ab / seg_len
                    rel = verts_np - np.array(a[:], dtype=float)
                    t = np.clip(rel @ bin_axis, 0.0, seg_len)
                    perp = rel - np.outer(t, bin_axis)
                    extra = np.linalg.norm(perp, axis=1) <= span["within"]
            seeds = ridge_seeds(verts_np, rule, mean, long_axis, extra, bin_axis)
        elif kind == "span":
            seeds = span_seeds(point(rule["from"]), point(rule["to"]),
                               int(rule.get("samples", 13)), snap, trim)
        elif kind == "trail":
            start = point(rule["from"])
            if rule.get("midpointWith"):
                start = (start + point(rule["midpointWith"])) / 2
            direction = rule.get("direction") or (-long_axis)
            seeds = trail_seeds(start, direction, rule["length"], int(rule.get("samples", 11)),
                                snap, float(rule.get("offset", 0.0)))
        elif kind == "ball":
            p = point(rule["from"])
            seeds = [snap(p) if snap else p]
        else:
            raise ValueError("unknown region kind: " + kind)

        if not seeds:
            return np.zeros(len(face_centres), dtype=bool), []

        tree = kdtree.KDTree(len(seeds))
        for i, s in enumerate(seeds):
            tree.insert(s, i)
        tree.balance()
        width = rule["width"]
        nearest = [tree.find(c) for c in face_centres]
        mask = np.array([n[2] <= width for n in nearest], dtype=bool)

        # OUTWARD ONLY. A bone is a closed shell, so a collar drawn around an
        # axis catches the inside of the medullary cavity as well as the
        # surface — and the inner sleeve has more faces than the outer one, so
        # the largest-island pass then throws the visible half away and keeps
        # the half nobody can see.
        #
        # HOW "OUTWARD" IS MEASURED DEPENDS ON WHERE THE SEED IS. Around an
        # axis running through the bone it is "away from the seed line". Around
        # a BALL the seed sits ON the surface, so that vector is near zero for
        # exactly the faces at the middle of the patch and its direction is
        # noise — which punched a hole through the centre of the greater
        # trochanter. There, the question is really "is this the same face of
        # the bone as the seed", so it is asked against the seed's own normal.
        if rule.get("outward"):
            if kind == "ball":
                ref = _snapper(bone_verts, vert_normals, None)
                seed = seeds[0]
                best, ref_normal = None, None
                for i, v in enumerate(bone_verts):
                    d = (v - seed).length
                    if best is None or d < best:
                        best, ref_normal = d, np.array(vert_normals[i][:], dtype=float)
                mask &= (normals_np @ ref_normal) > rule.get("outwardMin", -0.15)
            else:
                for i, (co, _, _) in enumerate(nearest):
                    if not mask[i]:
                        continue
                    away = np.array(face_centres[i][:], dtype=float) - np.array(co[:], dtype=float)
                    n = np.linalg.norm(away)
                    if n > 1e-9 and np.dot(away / n, normals_np[i]) < 0:
                        mask[i] = False

    # A thin bone can put the far surface within `width` of the near one, so a
    # posterior ridge would pick up anterior faces. Keep only faces pointing the
    # way the feature does.
    facing = rule.get("facing")
    if facing is not None:
        mask &= (normals_np @ _unit(facing)) > rule.get("facingMin", 0.0)

    # A HALF-SPACE, measured from the bone's centre. A cap along one axis
    # cannot distinguish two things that both reach that extreme: the outermost
    # 24mm of a vertebra is the transverse process AND the lateral edge of the
    # body beneath it. "Posterior of the centre" is what separates them, and it
    # is a constraint any rule may want, so it lives here rather than in cap.
    for keep in rule.get("keepIf", []):
        # "world": measure from the world origin instead of the bone's centre,
        # for a cut whose position was worked out in world coordinates — the
        # line of the scapular spine, which is not level.
        p = (centres_np if keep.get("world") else (centres_np - mean)) @ _unit(keep["axis"])
        if "min" in keep:
            mask &= p >= float(keep["min"])
        if "max" in keep:
            mask &= p <= float(keep["max"])

    # A PAIRED FEATURE NEEDS BOTH OF ITS HALVES. There are two coccygeal
    # cornua, one either side of the midline, but the atlas names a single
    # anchor — so a rule grown from it marks one horn and leaves the other
    # unmarked and ungradeable. Mirroring the selection across the midline
    # picks up its twin. `polygons` is multi-part and grading ORs the rings, so
    # two separate patches are one correct answer.
    if rule.get("mirrorX"):
        tree = kdtree.KDTree(len(face_centres))
        for i, c in enumerate(face_centres):
            tree.insert(c, i)
        tree.balance()
        reach = float(rule.get("mirrorWithin", 0.004))
        twin = np.zeros(len(face_centres), dtype=bool)
        for i in np.where(mask)[0]:
            c = face_centres[i]
            co, idx, dist = tree.find(mathutils.Vector((-c[0], c[1], c[2])))
            if idx is not None and dist <= reach:
                twin[idx] = True
        mask |= twin

    if adjacency is not None:
        mask = tidy(mask, adjacency, rule)
    return mask, seeds
