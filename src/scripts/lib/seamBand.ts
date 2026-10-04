import { decodePng } from './png';
import { binariseAlpha, type BinaryMask } from './maskToPolygons';

/**
 * The seam between two bones, from the masks renderJointMasks.py writes.
 *
 * Shared by jointLineHotspots.ts (one joint a plate) and publishGapPlates.ts
 * (several gaps on one plate): the recipe for "where do these two bones meet
 * on screen" is one fact, and the second script began as a copy of the first.
 */

/**
 * Grow by `steps` pixels using a 3x3 element. Repeated 3x3 dilation is a
 * chamfer rather than a true disc, so a diagonal grows by about 1.4x `steps` —
 * irrelevant at the pad sizes used here, and cheaper than a distance transform.
 */
export function dilateBy(mask: BinaryMask, width: number, height: number, steps: number): BinaryMask {
  let current = mask;
  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(current.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (current[y * width + x] === 0) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            next[ny * width + nx] = 1;
          }
        }
      }
    }
    current = next;
  }
  return current;
}

export function intersect(a: BinaryMask, b: BinaryMask): BinaryMask {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] && b[i] ? 1 : 0;
  return out;
}

/**
 * THE SEAM WHERE THE TWO BONES MEET ON SCREEN.
 *
 * A joint reads as a LINE in a picture — the Chopart line runs clean across the
 * foot, the knee line across the knee. Deriving the band from the contact
 * SURFACES gave a line only where the articulation happened to be edge-on: seen
 * face-on, a curved surface projects as a region, and the patellofemoral band
 * came out as the whole back of the patella. 46 of 71 published bands were
 * blobs of that kind.
 *
 * What a student points at is the seam: the pixels where this bone's visible
 * silhouette runs into its partner's. Dilating each silhouette by `seam` and
 * intersecting finds exactly that, and does it in the picture rather than in
 * three dimensions, so it follows whatever the camera can actually see.
 *
 * Two silhouettes can also meet where the bones merely OVERLAP — the earlier 2D
 * attempt drew the whole distal fibula on a lateral ankle for that reason — so
 * the seam is kept only where the contact surface, generously dilated, says the
 * two bones articulate. The surface is the evidence; the seam is the shape.
 */
export function seamBand(
  a: BinaryMask,
  b: BinaryMask,
  contact: BinaryMask,
  width: number,
  height: number,
  seam: number,
  gate: number,
): BinaryMask {
  const touching = intersect(dilateBy(a, width, height, seam), dilateBy(b, width, height, seam));
  // The gate grows with the reach: a seam that had to span a 70px gap sits
  // that much further from the surfaces it bridges, and a fixed gate rejected
  // the whole pubic symphysis for sitting in the middle of its own joint space.
  return intersect(touching, dilateBy(contact, width, height, gate + seam));
}

export function countSet(mask: BinaryMask): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

export function loadMask(path: string): { mask: BinaryMask; width: number; height: number } {
  const png = decodePng(path);
  return {
    mask: binariseAlpha(png.data, png.width, png.height),
    width: png.width,
    height: png.height,
  };
}

/**
 * THE SEAM, ONLY WHERE THE TWO BONES ARE THE SAME DISTANCE AWAY.
 *
 * The contact gate above stops a seam being drawn where two bones overlap far
 * from their joint. It cannot stop one being drawn NEXT to the joint, along an
 * edge where one bone simply stands in front of the other. Depth can tell the
 * two apart in principle: either side of a joint seen square-on the two
 * visible surfaces are level, and across an occlusion edge the far bone is
 * however far behind it happens to be. `depthA` and `depthB` are each bone's
 * distance from the camera in metres at every pixel it is visible in
 * (renderJointMasks.py, spec field `depth`); for each seam pixel this compares
 * the nearest visible pixel of each bone and drops the pixel when they differ
 * by more than `maxGap`.
 *
 * A MEASURE BEFORE IT IS A FILTER. It was written to test one suspect band and
 * cleared it (publishGapPlates.ts tells the story), and the same run showed
 * that small curved bones are routinely several millimetres out of level at a
 * perfectly real joint. So nothing applies it as a gate by default: the
 * publisher uses it to report how much of each seam is level, and a spec has
 * to ask for `maxDepthGap` to cut by it.
 */
export function depthGate(
  band: BinaryMask,
  a: BinaryMask,
  b: BinaryMask,
  depthA: Float32Array,
  depthB: Float32Array,
  width: number,
  height: number,
  reach: number,
  maxGap: number,
): BinaryMask {
  const out = new Uint8Array(band.length);
  const nearest = (mask: BinaryMask, depth: Float32Array, x: number, y: number): number | null => {
    let best = Infinity;
    let value: number | null = null;
    for (let dy = -reach; dy <= reach; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -reach; dx <= reach; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        const d = dx * dx + dy * dy;
        if (d >= best || !mask[ny * width + nx]) continue;
        best = d;
        value = depth[ny * width + nx];
      }
    }
    return value;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!band[i]) continue;
      const za = nearest(a, depthA, x, y);
      const zb = nearest(b, depthB, x, y);
      if (za === null || zb === null) continue;
      if (Math.abs(za - zb) <= maxGap) out[i] = 1;
    }
  }
  return out;
}
