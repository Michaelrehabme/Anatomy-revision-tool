# MSK image pipeline

Turns the Z-Anatomy 3D atlas into consistent muscle renders and tap-target
hotspots, driven by `muscles.json`.

## Run order

```bash
# 0. one-time: get the atlas
#    github.com/Z-Anatomy/Models-of-human-anatomy  (CC BY-SA 4.0)
#    install Z-Anatomy.zip as a Blender application template

# 1. dump the real object names out of the .blend
blender Z-Anatomy.blend --background --python dump_objects.py -- --out objects.json

# 2. check my TA2 mapping against those real names
python3 reconcile.py --objects objects.json --mapping ta2-mapping.json
#    -> ta2-mapping.resolved.json; fix anything printed as UNRESOLVED

# 3. render ONE region first and look at it before batching
blender Z-Anatomy.blend --background --python render_muscles.py -- \
    --mapping ta2-mapping.resolved.json --out ./renders --region shoulder-arm

# 4. trace masks into normalised hotspot polygons
python3 masks_to_svg.py --masks ./renders/masks --out hotspots.json

# 5. once the angle reads well, drop --region to do all five
```

## Why it's built this way

The masks and the regional base plate render from the **same camera**, so a
traced polygon overlays the plate exactly. Coordinates are normalised 0–1, so
one polygon set works at every screen size — no image maps, no fixed canvas.

Camera presets in `render_muscles.py` (`VIEWS`) are starting guesses. Tuning
them per region is the main manual work, and it's worth doing carefully: the
angle decides whether a muscle is visible at all. If `masks_to_svg.py` reports
an empty mask, that muscle is occluded at the current angle and needs either a
different view or a "peel back the superficial layer" plate of its own.

## Client-side hit testing

```ts
const inside = (pt: [number, number], poly: number[][]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

// tap -> normalise against the rendered <img> box -> test each muscle
const hitTest = (nx: number, ny: number, region: string) =>
  Object.entries(hotspots[region])
    .filter(([, h]) => h.polygons.some(p => inside([nx, ny], p)))
    .sort((a, b) => a[1].area - b[1].area)[0]?.[0]; // smallest wins when nested
```

Sorting by area matters: deltoid overlaps supraspinatus, and the student
tapping the smaller structure means the smaller structure.

`centroid` is there for label placement and for "where is X?" questions where
you reveal the answer with a pin rather than a filled shape.

## Licence obligations

Z-Anatomy is **CC BY-SA 4.0**, and ShareAlike attaches to renders derived from
it. Every image out of this pipeline must carry attribution and be released
BY-SA. Commercial use is fine — BY-SA permits it — but you can't lock the
images down. Your question engine, scheduling and UI are separate works and are
unaffected.

Suggested per-image credit, and populate `images.credit` / `images.licence` in
`muscles.json` as you go:

> Derived from Z-Anatomy (Gauthier Kervyn et al.), based on BodyParts3D
> (Database Center for Life Science). CC BY-SA 4.0.

I'm not a lawyer. If you're taking payment, have someone check the stack.

## Files

| File | Runs in | Does |
|---|---|---|
| `muscles.json` | — | 122 muscles: origin, insertion, nerve, actions + reverse indexes |
| `ta2-mapping.json` | — | muscle id → TA2 term (113/122 verified) |
| `dump_objects.py` | Blender | dumps real object names |
| `reconcile.py` | Python | mapping → concrete Blender object lists |
| `render_muscles.py` | Blender | base plates, masks, isolated renders |
| `masks_to_svg.py` | Python | masks → normalised hotspot polygons |
| `joints.json` | — | 10 joints: id, label, member bones, landmark membership |
| `render_joints.py` | Blender | per-joint turntable base plates + landmark pins/masks |
| `render_regions.py` | Blender | per-region (muscle) turntable base plates + masks |
| `joint_masks_to_hotspots.py` | Python | per-frame masks → normalised hotspot polygons (joints and regions both) |
| `convert_frames_to_webp.py` | Python | re-encodes shipped turntable frames PNG → WebP (~35x smaller; masks stay PNG, untouched) |
| `add_primary_joint.py` | Python | tags each muscle with a `primaryJoint` display label from its `actions` tags |
| `apply_joints.py` | Python | folds a joint render pass into `landmarks.json` + `msk-quiz.html` |
| `apply_regions.py` | Python | folds a region render pass into `msk-quiz.html` |

`dump_objects.py`, `render_muscles.py`, `render_joints.py` and
`render_regions.py` need Blender and the atlas. Everything else is plain
Python. All of it has now actually been run end-to-end in this environment
(Blender + the atlas are present locally) rather than left as reviewed
drafts - see `joints.json`'s 10 joints and every muscle region's turntable
under `renders/joints/` and `renders/regions/`.

Every structure and muscle now gets a drag-to-rotate turntable (24 frames)
instead of one fixed camera angle, with Anterior/Posterior/Side quick-jump
buttons and the highlighted structure/muscle tracked per frame. Landmarks
render against just their own joint's bones (tight framing); muscles render
against their whole region's base plate (a muscle can span more than one
joint) with a `primaryJoint` label for orientation. This also retired the
old single-camera-plus-manual-posterior-pass system
(`posterior_classification.json` / `apply_posterior.py` /
`merge_posterior_hotspots.py`, now removed) - every back view is just frame
12 of the same rotation, not a separately classified and rendered pass.
