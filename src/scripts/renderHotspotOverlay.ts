/**
 * Draws generated hotspot polygons over their region render so the occlusion
 * order can be checked by eye.
 *
 * The occlusion orders in data/occlusionOrder.ts are anatomical judgement, and
 * a wrong order fails silently: a polygon sitting over the wrong muscle still
 * grades consistently against itself, so no test catches it. The only way to
 * find that is to look at the picture.
 *
 * Usage:
 *   npx tsx src/scripts/renderHotspotOverlay.ts --renders DIR --out DIR
 *
 * Flags:
 *   --renders DIR  PNG copies of the region renders, named <region>-<view>.png.
 *   --hotspots F   Converter output (default hotspots.regions.json).
 *   --out DIR      Where to write <region>-<view>-overlay.png.
 *   --only ID      Render just one image id (e.g. region-shoulder-arm-anterior).
 *   --solo         One file per structure instead of all polygons at once.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from './lib/png';
import { encodePng } from './lib/pngEncode';

/** Distinct, high-contrast hues; index cycles if a view has more structures. */
const PALETTE: [number, number, number][] = [
  [228, 26, 28], [55, 126, 184], [77, 175, 74], [152, 78, 163],
  [255, 127, 0], [166, 86, 40], [247, 129, 191], [23, 190, 207],
  [188, 189, 34], [127, 127, 127], [31, 119, 180], [214, 39, 40],
  [148, 103, 189], [140, 86, 75], [227, 119, 194], [44, 160, 44],
];

interface HotspotEntry {
  polygons: number[][][];
  area: number;
  centroid: [number, number];
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? next : true;
  }
  return out;
}

/** Even-odd fill of one ring, in pixel space. */
function fillRing(
  rgba: Uint8Array,
  width: number,
  height: number,
  ring: number[][],
  colour: [number, number, number],
  alpha: number,
): void {
  const pts = ring.map(([x, y]) => [x * width, y * height]);
  let minY = height;
  let maxY = 0;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(height - 1, Math.ceil(maxY)); y++) {
    const centre = y + 0.5;
    const crossings: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > centre !== yj > centre) {
        crossings.push(xj + ((centre - yj) / (yi - yj)) * (xi - xj));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil(crossings[k] - 0.5));
      const to = Math.min(width - 1, Math.floor(crossings[k + 1] - 0.5));
      for (let x = from; x <= to; x++) {
        const o = (y * width + x) * 4;
        rgba[o] = Math.round(rgba[o] * (1 - alpha) + colour[0] * alpha);
        rgba[o + 1] = Math.round(rgba[o + 1] * (1 - alpha) + colour[1] * alpha);
        rgba[o + 2] = Math.round(rgba[o + 2] * (1 - alpha) + colour[2] * alpha);
      }
    }
  }
}

function strokeRing(
  rgba: Uint8Array,
  width: number,
  height: number,
  ring: number[][],
  colour: [number, number, number],
): void {
  const put = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const o = (y * width + x) * 4;
    rgba[o] = colour[0];
    rgba[o + 1] = colour[1];
    rgba[o + 2] = colour[2];
    rgba[o + 3] = 255;
  };

  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    let x0 = Math.round(ax * width);
    let y0 = Math.round(ay * height);
    const x1 = Math.round(bx * width);
    const y1 = Math.round(by * height);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    for (;;) {
      // 3px nib so the outline survives being looked at scaled-down.
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) put(x0 + ox, y0 + oy);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
}

/** Solid crosshair at the stored centroid — where a "tap here" probe lands. */
function drawCentroid(
  rgba: Uint8Array,
  width: number,
  height: number,
  centroid: [number, number],
  colour: [number, number, number],
): void {
  const cx = Math.round(centroid[0] * width);
  const cy = Math.round(centroid[1] * height);
  for (let d = -14; d <= 14; d++) {
    for (const [x, y] of [[cx + d, cy], [cx, cy + d]] as [number, number][]) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const o = (y * width + x) * 4;
      rgba[o] = colour[0];
      rgba[o + 1] = colour[1];
      rgba[o + 2] = colour[2];
      rgba[o + 3] = 255;
    }
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rendersDir = String(args.renders ?? 'renders-png');
  const outDir = String(args.out ?? 'hotspot-overlays');
  const hotspotsPath = String(args.hotspots ?? 'hotspots.regions.json');
  const only = typeof args.only === 'string' ? args.only : null;

  const file = JSON.parse(readFileSync(hotspotsPath, 'utf8')) as {
    images: Record<string, { hotspots: Record<string, HotspotEntry> }>;
  };
  mkdirSync(outDir, { recursive: true });

  for (const [imageId, entry] of Object.entries(file.images)) {
    if (only && imageId !== only) continue;
    const stem = imageId.replace(/^region-/, '');
    const renderPath = join(rendersDir, `${stem}.png`);
    if (!existsSync(renderPath)) {
      console.error(`skip ${imageId}: no render at ${renderPath}`);
      continue;
    }

    const base = decodePng(renderPath);
    const ids = Object.keys(entry.hotspots);

    if (args.solo) {
      for (let i = 0; i < ids.length; i++) {
        const rgba = flatten(base);
        paint(rgba, base.width, base.height, entry.hotspots[ids[i]], PALETTE[0]);
        const path = join(outDir, `${stem}--${ids[i]}.png`);
        writeFileSync(path, encodePng(rgba, base.width, base.height));
      }
      console.log(`${imageId}: ${ids.length} solo overlays -> ${outDir}`);
      continue;
    }

    const rgba = flatten(base);
    ids.forEach((id, i) => paint(rgba, base.width, base.height, entry.hotspots[id], PALETTE[i % PALETTE.length]));
    const path = join(outDir, `${stem}-overlay.png`);
    writeFileSync(path, encodePng(rgba, base.width, base.height));
    console.log(`${imageId}: ${ids.length} polygons -> ${path}`);
    ids.forEach((id, i) => {
      const c = PALETTE[i % PALETTE.length];
      console.log(`    rgb(${String(c[0]).padStart(3)},${String(c[1]).padStart(3)},${String(c[2]).padStart(3)})  ${id}`);
    });
  }
}

/** Composites the render onto white so transparent margins read as page. */
function flatten(base: { width: number; height: number; data: Buffer }): Uint8Array {
  const out = new Uint8Array(base.width * base.height * 4);
  for (let i = 0; i < base.width * base.height; i++) {
    const a = base.data[i * 4 + 3] / 255;
    out[i * 4] = Math.round(base.data[i * 4] * a + 255 * (1 - a));
    out[i * 4 + 1] = Math.round(base.data[i * 4 + 1] * a + 255 * (1 - a));
    out[i * 4 + 2] = Math.round(base.data[i * 4 + 2] * a + 255 * (1 - a));
    out[i * 4 + 3] = 255;
  }
  return out;
}

function paint(
  rgba: Uint8Array,
  width: number,
  height: number,
  entry: HotspotEntry,
  colour: [number, number, number],
): void {
  for (const ring of entry.polygons) fillRing(rgba, width, height, ring, colour, 0.45);
  for (const ring of entry.polygons) strokeRing(rgba, width, height, ring, colour);
  drawCentroid(rgba, width, height, entry.centroid, colour);
}

main();
