/**
 * Converts a binary mask raster into normalised hotspot polygons.
 *
 * HOLES ARE DISCARDED, NOT EMITTED. lib/hotspot/pointInPolygon.ts resolves a
 * multi-part structure with pointInAnyPolygon, which ORs the rings together —
 * it has no even-odd winding rule. An emitted hole ring would therefore ADD
 * its area to the hit region instead of subtracting it, and would also inflate
 * the stored `area` that drives smallest-wins overlap resolution. Only outer
 * boundaries are traced.
 *
 * The I/O lives in masksToHotspots.ts; everything here operates on plain
 * Uint8Array rasters so it can be tested on synthetic shapes.
 */
import { polygonsArea, polygonsCentroid, simplifyRing } from '../../features/anatomy-revision/lib/hotspot/polygonGeometry';

/** One byte per pixel: 1 = foreground, 0 = background. */
export type BinaryMask = Uint8Array;

/**
 * Alpha > 128 cleanly separates these masks: a measured histogram of one
 * shoulder mask is 1,946,026 px at alpha 0 and 11,826 at alpha 255, with only
 * a few hundred antialiased pixels in between.
 */
export function binariseAlpha(rgba: Buffer, width: number, height: number, threshold = 128): BinaryMask {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    if (rgba[i * 4 + 3] > threshold) mask[i] = 1;
  }
  return mask;
}

export interface SubtractionResult {
  visible: BinaryMask;
  visiblePx: number;
  originalPx: number;
}

/**
 * Removes from `mask` every pixel already claimed by a shallower structure,
 * and adds what survives to `covered` so deeper structures see it too.
 * Mutates `covered` — callers walk the occlusion order superficial-first.
 */
export function subtractOccluders(mask: BinaryMask, covered: Uint8Array): SubtractionResult {
  const visible = new Uint8Array(mask.length);
  let originalPx = 0;
  let visiblePx = 0;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) continue;
    originalPx++;
    if (covered[i] === 0) {
      visible[i] = 1;
      visiblePx++;
    }
  }

  for (let i = 0; i < visible.length; i++) {
    if (visible[i] === 1) covered[i] = 1;
  }

  return { visible, visiblePx, originalPx };
}

export interface MaskToPolygonsOptions {
  /** Components smaller than this are speckle from subtraction, not anatomy. */
  minComponentPx?: number;
  /** Douglas-Peucker tolerance, in mask pixels before normalisation. */
  epsilon?: number;
  maxVertices?: number;
}

export interface TracedPolygons {
  polygons: number[][][];
  area: number;
  centroid: [number, number];
  points: number;
}

export function maskToPolygons(
  mask: BinaryMask,
  width: number,
  height: number,
  options: MaskToPolygonsOptions = {},
): TracedPolygons {
  const { minComponentPx = 200, epsilon = 2, maxVertices = 150 } = options;

  const opened = morphologicalOpen(mask, width, height);
  const components = connectedComponents(opened, width, height, minComponentPx);

  const rings: number[][][] = [];
  for (const component of components) {
    const traced = traceOuterBoundary(component.mask, width, height, component.startIndex);
    if (traced.length < 3) continue;

    const budget = Math.max(
      8,
      Math.round(maxVertices * (component.pixels / Math.max(1, totalPixels(components)))),
    );
    const simplified = simplifyRing(traced, { epsilon, maxVertices: budget });
    if (simplified.length < 3) continue;

    rings.push(simplified.map(([x, y]) => [round5(x / width), round5(y / height)]));
  }

  return {
    polygons: rings,
    area: polygonsArea(rings),
    centroid: polygonsCentroid(rings),
    points: rings.reduce((total, ring) => total + ring.length, 0),
  };
}

function totalPixels(components: Component[]): number {
  return components.reduce((total, c) => total + c.pixels, 0);
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/**
 * Erode then dilate with a 3x3 structuring element. Occlusion subtraction
 * leaves 1px slivers along every occluder border; traced directly they become
 * long thin spaghetti rings that survive simplification and wreck the area.
 */
function morphologicalOpen(mask: BinaryMask, width: number, height: number): BinaryMask {
  return dilate(erode(mask, width, height), width, height);
}

function erode(mask: BinaryMask, width: number, height: number): BinaryMask {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 0) continue;
      if (allNeighboursSet(mask, width, height, x, y)) out[y * width + x] = 1;
    }
  }
  return out;
}

function allNeighboursSet(mask: BinaryMask, width: number, height: number, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      // Treat outside-the-image as background so edge-touching shapes erode inward.
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false;
      if (mask[ny * width + nx] === 0) return false;
    }
  }
  return true;
}

function dilate(mask: BinaryMask, width: number, height: number): BinaryMask {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 0) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

interface Component {
  mask: BinaryMask;
  pixels: number;
  startIndex: number;
}

/**
 * 8-connected foreground labelling. Paired with 4-connected background (which
 * is what tracing outer boundaries only gives us), this is the standard
 * combination that avoids the checkerboard connectivity paradox.
 *
 * Iterative flood fill — components reach ~226k pixels, far past the stack
 * depth a recursive fill would survive.
 */
function connectedComponents(
  mask: BinaryMask,
  width: number,
  height: number,
  minComponentPx: number,
): Component[] {
  const seen = new Uint8Array(mask.length);
  const components: Component[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 0 || seen[start] === 1) continue;

    const componentMask = new Uint8Array(mask.length);
    const stack = [start];
    seen[start] = 1;
    let pixels = 0;
    let topLeft = start;

    while (stack.length > 0) {
      const index = stack.pop()!;
      componentMask[index] = 1;
      pixels++;
      if (index < topLeft) topLeft = index;

      const x = index % width;
      const y = (index - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbour = ny * width + nx;
          if (mask[neighbour] === 1 && seen[neighbour] === 0) {
            seen[neighbour] = 1;
            stack.push(neighbour);
          }
        }
      }
    }

    if (pixels >= minComponentPx) {
      components.push({ mask: componentMask, pixels, startIndex: topLeft });
    }
  }

  return components;
}

// Clockwise 8-neighbourhood, starting due west.
const NEIGHBOUR_OFFSETS: [number, number][] = [
  [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1],
];

/**
 * Moore-neighbour boundary tracing with Jacob's stopping criterion: stop when
 * the start pixel is re-entered from the same direction it was first entered.
 * Chosen over marching squares because it yields an ordered, already-closed
 * ring directly, with no segment-stitching pass.
 */
function traceOuterBoundary(
  mask: BinaryMask,
  width: number,
  height: number,
  startIndex: number,
): number[][] {
  const at = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;

  const startX = startIndex % width;
  const startY = (startIndex - startX) / width;

  const boundary: number[][] = [];
  let currentX = startX;
  let currentY = startY;
  // Scanning found the top-left-most pixel, so the west neighbour is background.
  let backtrackDirection = 0;

  for (let guard = 0; guard < width * height * 8; guard++) {
    boundary.push([currentX, currentY]);

    let foundX = -1;
    let foundY = -1;
    let foundDirection = -1;
    for (let step = 1; step <= 8; step++) {
      const direction = (backtrackDirection + step) % 8;
      const [dx, dy] = NEIGHBOUR_OFFSETS[direction];
      if (at(currentX + dx, currentY + dy)) {
        foundX = currentX + dx;
        foundY = currentY + dy;
        foundDirection = direction;
        break;
      }
    }

    // Isolated pixel with no foreground neighbour.
    if (foundDirection === -1) break;

    // Stop on the FIRST return to the start pixel. Walking until the start is
    // re-entered from the same direction would lap the boundary twice, and a
    // doubly-traced ring both doubles its shoelace area and cancels its own
    // even-odd parity, so every interior point would test as outside.
    if (foundX === startX && foundY === startY) break;

    // Re-enter the backtrack cell relative to the new pixel, rotated to face back.
    backtrackDirection = (foundDirection + 4 + 1) % 8;
    currentX = foundX;
    currentY = foundY;
  }

  return boundary;
}
