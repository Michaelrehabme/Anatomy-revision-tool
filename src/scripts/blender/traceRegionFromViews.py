"""Traces a landmark region on the bone from outlines drawn on its pictures.

    blender atlas/Z-Anatomy/Startup.blend --background \
      --python src/scripts/blender/traceRegionFromViews.py -- \
      --meta renders/landmarks/greater-tubercle-humerus/meta.json \
      --outlines landmark-region-points/greater-tubercle-humerus.outlines.json \
      --object Humerus.r --join view-06 \
      --out landmark-region-points/greater-tubercle-humerus.json

WHY. An outline drawn on one picture only says what the bone looks like from
that side. The greater tubercle was traced on the anterior and posterior
pictures from Gray's figs 207-208, but Gray's has no lateral plate, and a
lateral hitbox guessed on its own did not match (owner, 16 Nov 2026). Here the
outlines are projected back onto the bone through the cameras the pictures
were rendered with (renderLandmarkMarkers.py records them in meta.json), the
two patches are joined across the side of the bone between them (the faces
the `--join` camera sees, inside the patches' height and depth), and the
result is saved as surface points. A `points` rule in
landmark-regions.rules.json then grows the region from them, so every view,
the lateral one included, marks the same piece of bone.
"""
import bpy, bmesh, json, sys, argparse, mathutils
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--meta", required=True)
ap.add_argument("--outlines", required=True, help="{view-NN: [[x,y],...]} in render pixels")
ap.add_argument("--object", required=True)
ap.add_argument("--join", default="", help="view whose camera-facing faces bridge the patches")
ap.add_argument("--facing", type=float, default=0.15, help="min normal toward a camera")
ap.add_argument("--join-facing", type=float, default=0.35)
ap.add_argument("--close", type=int, default=2)
ap.add_argument("--head-anchor", default="", help="e.g. 'Head of humerus': drop the articular sphere")
ap.add_argument("--head-reach", type=float, default=0.022, help="faces this near the anchor fit the sphere")
ap.add_argument("--head-lateral", type=float, default=0.0, help="keep the sphere's lateral cap beyond this fraction of r")
ap.add_argument("--top-gap", type=float, default=0.0, help="leave this band under the bone's summit (m)")
ap.add_argument("--head-tol", type=float, default=0.002, help="how near the sphere counts as on it")
ap.add_argument("--out", required=True)
a = ap.parse_args(argv)

meta = json.load(open(a.meta))
outlines = json.load(open(a.outlines))
# "Humerus.l,Humerus.r": the copy the pictures show is the one nearest the
# landmark's anchor, which meta.json records.
anchor = mathutils.Vector(meta["anchor"])
ob = min((bpy.data.objects[n] for n in a.object.split(",")),
         key=lambda o: (o.matrix_world @ (sum((mathutils.Vector(c) for c in o.bound_box), mathutils.Vector()) / 8) - anchor).length)
print(f"[trace] bone: {ob.name}", flush=True)

bm = bmesh.new()
me = ob.data.copy()
me.transform(ob.matrix_world)
bm.from_mesh(me)
bpy.data.meshes.remove(me)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
for _ in range(2):
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
bm.faces.ensure_lookup_table()
centres = np.array([f.calc_center_median()[:] for f in bm.faces])
normals = np.array([f.normal[:] for f in bm.faces])
def neighbours():
    out = [set() for _ in bm.faces]
    for e in bm.edges:
        fs = [f.index for f in e.link_faces]
        for i in fs:
            out[i].update(j for j in fs if j != i)
    return [list(s) for s in out]


adj = neighbours()


def project(view):
    cam = meta["views"][view]["camera"]
    M = mathutils.Matrix(cam["matrixWorld"])
    inv = np.array(M.inverted())
    rot = np.array(M.inverted().to_3x3())
    pc = centres @ inv[:3, :3].T + inv[:3, 3]
    nc = normals @ rot.T
    s, res = cam["orthoScale"], cam["res"]
    px = (pc[:, 0] / s + 0.5) * res
    py = (1 - (pc[:, 1] / s + 0.5)) * res
    return px, py, nc[:, 2]


def inside(px, py, poly):
    poly = np.array(poly, dtype=float)
    x0, y0 = poly[:, 0], poly[:, 1]
    x1, y1 = np.roll(x0, -1), np.roll(y0, -1)
    res = np.zeros(len(px), dtype=bool)
    for i in range(len(poly)):
        cond = ((y0[i] > py) != (y1[i] > py))
        xint = (x1[i] - x0[i]) * (py - y0[i]) / ((y1[i] - y0[i]) or 1e-9) + x0[i]
        res ^= cond & (px < xint)
    return res


sel = np.zeros(len(centres), dtype=bool)
for view, poly in ((k, v) for k, v in outlines.items() if not k.startswith("_")):
    px, py, toward = project(view)
    hit = inside(px, py, poly) & (toward > a.facing)
    print(f"[trace] {view}: {hit.sum()} faces inside the outline", flush=True)
    sel |= hit

if a.join:
    _, _, toward = project(a.join)
    lo, hi = centres[sel].min(axis=0), centres[sel].max(axis=0)
    band = (toward > a.join_facing)
    for k in (1, 2):  # within the patches' depth (y) and height (z)
        band &= (centres[:, k] >= lo[k]) & (centres[:, k] <= hi[k])
    print(f"[trace] join through {a.join}: {(band & ~sel).sum()} faces added", flush=True)
    sel |= band

for _ in range(a.close):  # close small gaps: grow then shrink
    sel = sel | np.array([any(sel[j] for j in adj[i]) for i in range(len(sel))])
for _ in range(a.close):
    sel = sel & np.array([all(sel[j] for j in adj[i]) for i in range(len(sel))])

# OFF THE ARTICULAR HEAD. The head is a near-perfect sphere and the tubercle
# is not on it: fit a sphere to the bone around the head's anchor, then drop
# every face lying on that sphere and facing out of it. What is left stops at
# the anatomical neck, where the articular surface ends.
if a.head_anchor:
    cands = [o for o in bpy.data.objects if o.name.startswith(a.head_anchor)]
    centre_bone = centres.mean(axis=0)
    ha = min(cands, key=lambda o: np.linalg.norm(np.array(o.matrix_world.translation) - centre_bone))
    hp = np.array(ha.matrix_world.translation)
    # The .j anchor is a label position off the bone: snap it to the surface first.
    hp = centres[np.argmin(np.linalg.norm(centres - hp, axis=1))]
    near = np.linalg.norm(centres - hp, axis=1) < a.head_reach
    pts, nrm = centres[near], normals[near]
    print(f"[trace] head anchor {ha.name} at {np.round(hp*1000,1)} mm; {len(pts)} faces near it", flush=True)
    keep = np.ones(len(pts), dtype=bool)
    for it in range(5):
        A = np.c_[2 * pts[keep], np.ones(keep.sum())]
        b = (pts[keep] ** 2).sum(axis=1)
        sol = np.linalg.lstsq(A, b, rcond=None)[0]
        c, R = sol[:3], float(np.sqrt(max(sol[3] + (sol[:3] ** 2).sum(), 0)))
        d = np.linalg.norm(pts - c, axis=1)
        radial = ((pts - c) / np.maximum(d, 1e-9)[:, None] * nrm).sum(axis=1)
        new_keep = (np.abs(d - R) < 0.003) & (radial > 0.7)
        print(f"[trace]   fit {it}: r={R*1000:.1f} mm on {keep.sum()} faces", flush=True)
        if new_keep.sum() < 50:
            break
        keep = new_keep
    dist = np.linalg.norm(centres - c, axis=1)
    radial = ((centres - c) / dist[:, None] * normals).sum(axis=1)
    head = (np.abs(dist - R) < a.head_tol) & (radial > 0.8)
    if a.head_lateral:
        # The tubercle can sit on the same sphere at its lateral pole; the
        # articular surface is the dome and the medial side of it. `lateral` is
        # the direction the join camera looks from.
        cam = meta["views"][a.join]["camera"]
        lat = np.array(mathutils.Matrix(cam["matrixWorld"]).col[2][:3])     # camera +Z points back at the viewer
        lat /= np.linalg.norm(lat)
        head &= ((centres - c) @ lat) < a.head_lateral * R
    print(f"[trace] head sphere r={R*1000:.1f} mm; {(sel & head).sum()} faces of the region on it removed", flush=True)
    sel &= ~head

# BELOW THE TOP OF THE HEAD. In Gray's fig. 207 the tubercle's upper facet sits
# a few millimetres below the summit of the head; in this model the two meet at
# the top of the side view, so a band under the summit is left unmarked.
if a.top_gap:
    sel &= centres[:, 2] < centres[:, 2].max() - a.top_gap
    print(f"[trace] kept below {a.top_gap*1000:.0f} mm under the summit", flush=True)

# EACH DRAWN VIEW STAYS EXACTLY AS DRAWN. The join and the closing add faces
# that the front or back camera can also see; any face a drawing camera sees
# must lie inside that drawing, so the anterior and posterior views match the
# reference and only the side between them is new.
for view, poly in ((k, v) for k, v in outlines.items() if not k.startswith("_")):
    px, py, toward = project(view)
    sel &= ~((toward > a.facing) & ~inside(px, py, poly))

# the largest connected piece
seen = np.zeros(len(sel), dtype=bool)
best = []
for i in np.where(sel)[0]:
    if seen[i]:
        continue
    stack, comp = [i], []
    seen[i] = True
    while stack:
        k = stack.pop()
        comp.append(k)
        for j in adj[k]:
            if sel[j] and not seen[j]:
                seen[j] = True
                stack.append(j)
    if len(comp) > len(best):
        best = comp
pts = centres[best]
lo, hi = pts.min(axis=0), pts.max(axis=0)
print(f"[trace] region: {len(best)} faces, extent mm x {1000*(hi[0]-lo[0]):.1f} y {1000*(hi[1]-lo[1]):.1f} z {1000*(hi[2]-lo[2]):.1f}", flush=True)
json.dump({"_why": "Surface points of the traced region (traceRegionFromViews.py); see landmark-regions.rules.json.",
           "object": ob.name, "points": [[round(float(c), 5) for c in p] for p in pts]},
          open(a.out, "w"))
bm.free()
