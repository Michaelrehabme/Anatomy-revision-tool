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

`dump_objects.py` and `render_muscles.py` need Blender and the atlas, so I
couldn't execute them here — treat them as reviewed drafts, not tested code.
`masks_to_svg.py` and `reconcile.py` are plain Python and were tested.
