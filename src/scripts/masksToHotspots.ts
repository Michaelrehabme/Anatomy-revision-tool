/**
 * Converts the Blender per-muscle turntable masks into hotspot polygons for
 * locate-the-structure questions.
 *
 * Masks live at renders/regions/<region>/masks/<muscle>/frame-NN.png and are
 * pixel-aligned to deploy/renders/regions/<region>/frame-NN.webp, which is what
 * the app actually displays. Which frame is which view comes from VIEW_FRAMES
 * in data/occlusionOrder.ts (anterior 0, lateral 6, posterior 12).
 *
 * Usage:
 *   npx tsx src/scripts/masksToHotspots.ts --out hotspots.regions.json
 *
 * Flags:
 *   --masks DIR      Turntable mask root (default renders/regions).
 *   --views a,b,c    Views to emit (default anterior,lateral,posterior).
 *   --no-occlusion   Trace solo silhouettes without depth subtraction. For
 *                    comparing the tracer against the prototype viewer's own
 *                    polygons only — never for generating shippable data.
 *   --min-px N               Minimum visible pixels to keep (default 1500).
 *   --min-visible-fraction F Minimum share of its own silhouette (default 0.15).
 *   --max-vertices N         Vertex budget per structure (default 150).
 */
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from './lib/png';
import { binariseAlpha, maskToPolygons, subtractOccluders } from './lib/maskToPolygons';
import { OCCLUSION_ORDER, VIEW_FRAMES, regionImageId, type ViewName } from './data/occlusionOrder';

interface Options {
  masksRoot: string;
  outPath: string;
  views: ViewName[];
  occlusion: boolean;
  minPx: number;
  minVisibleFraction: number;
  maxVertices: number;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string, fallback: string): string => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : argv[index + 1];
  };

  return {
    masksRoot: get('--masks', 'renders/regions'),
    outPath: get('--out', 'hotspots.regions.json'),
    views: get('--views', 'anterior,lateral,posterior').split(',') as ViewName[],
    occlusion: !argv.includes('--no-occlusion'),
    minPx: Number(get('--min-px', '1500')),
    minVisibleFraction: Number(get('--min-visible-fraction', '0.15')),
    maxVertices: Number(get('--max-vertices', '150')),
  };
}

interface Row {
  structureId: string;
  originalPx: number;
  visiblePx: number;
  kept: boolean;
  reason: string;
  points: number;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.masksRoot)) {
    console.error(`Mask root not found: ${options.masksRoot}`);
    console.error('These renders are untracked build output — see .gitignore.');
    process.exit(1);
  }

  const images: Record<string, unknown> = {};
  const dropped: Record<string, string[]> = {};
  const keptSomewhere = new Set<string>();
  let totalKept = 0;

  for (const region of readdirSync(options.masksRoot)) {
    const maskRoot = join(options.masksRoot, region, 'masks');
    if (!existsSync(maskRoot)) continue;
    const available = new Set(readdirSync(maskRoot));

    for (const view of options.views) {
      const imageId = regionImageId(region, view);
      const order = OCCLUSION_ORDER[imageId];
      if (!order) {
        console.error(`No occlusion order for "${imageId}" — add one to src/scripts/data/occlusionOrder.ts`);
        process.exit(1);
      }

      const missing = order.filter((id) => !available.has(id));
      if (missing.length > 0) {
        console.error(`"${imageId}" lists muscles with no mask directory: ${missing.join(', ')}`);
        process.exit(1);
      }

      const frame = `frame-${String(VIEW_FRAMES[view]).padStart(2, '0')}.png`;
      const result = traceView(imageId, maskRoot, order, frame, options);

      images[imageId] = {
        filePath: `/anatomy/regions/${region}-${view}.webp`,
        width: result.width,
        height: result.height,
        panelStructureNames: result.panelStructureNames,
        hotspots: result.hotspots,
      };
      dropped[imageId] = result.dropped;
      result.panelStructureNames.forEach((id) => keptSomewhere.add(id));
      totalKept += result.panelStructureNames.length;
    }
  }

  writeFileSync(options.outPath, `${JSON.stringify({ schemaVersion: 2, normalised: true, images }, null, 2)}\n`);

  console.log(`\n${totalKept} hotspot(s) across ${Object.keys(images).length} view(s) -> ${options.outPath}`);
  printDeepGap(dropped, keptSomewhere);

  if (!options.occlusion) {
    console.log('\nWARNING: --no-occlusion output overlaps and must not be imported as content.');
  }
}

interface ViewResult {
  width: number;
  height: number;
  hotspots: Record<string, unknown>;
  panelStructureNames: string[];
  dropped: string[];
}

function traceView(
  imageId: string,
  maskRoot: string,
  order: string[],
  frame: string,
  options: Options,
): ViewResult {
  let covered: Uint8Array | null = null;
  let width = 0;
  let height = 0;

  const hotspots: Record<string, unknown> = {};
  const panelStructureNames: string[] = [];
  const droppedIds: string[] = [];
  const rows: Row[] = [];

  for (const structureId of order) {
    const maskPath = join(maskRoot, structureId, frame);
    if (!existsSync(maskPath)) {
      console.error(`Missing mask: ${maskPath}`);
      process.exit(1);
    }

    const decoded = decodePng(maskPath);
    if (covered === null) {
      width = decoded.width;
      height = decoded.height;
      covered = new Uint8Array(width * height);
    } else if (decoded.width !== width || decoded.height !== height) {
      console.error(`${maskPath} is ${decoded.width}x${decoded.height}, expected ${width}x${height}`);
      process.exit(1);
    }

    const binary = binariseAlpha(decoded.data, width, height);
    const { visible, visiblePx, originalPx } = options.occlusion
      ? subtractOccluders(binary, covered)
      : { visible: binary, visiblePx: countSet(binary), originalPx: countSet(binary) };

    const fraction = originalPx === 0 ? 0 : visiblePx / originalPx;
    let kept = true;
    let reason = '';
    if (visiblePx < options.minPx) {
      kept = false;
      reason = `only ${visiblePx}px visible`;
    } else if (fraction < options.minVisibleFraction) {
      kept = false;
      reason = `only ${(fraction * 100).toFixed(1)}% of its silhouette visible`;
    }

    let points = 0;
    if (kept) {
      const traced = maskToPolygons(visible, width, height, { maxVertices: options.maxVertices });
      if (traced.polygons.length === 0) {
        kept = false;
        reason = 'traced to no usable polygon';
      } else {
        points = traced.points;
        hotspots[structureId] = {
          polygons: traced.polygons,
          area: traced.area,
          centroid: traced.centroid,
          points: traced.points,
          size: [width, height],
        };
        panelStructureNames.push(structureId);
      }
    }

    if (!kept) droppedIds.push(structureId);
    rows.push({ structureId, originalPx, visiblePx, kept, reason, points });
  }

  printRegionTable(imageId, rows);
  return { width, height, hotspots, panelStructureNames, dropped: droppedIds };
}

function countSet(mask: Uint8Array): number {
  let total = 0;
  for (let i = 0; i < mask.length; i++) total += mask[i];
  return total;
}

function printRegionTable(imageId: string, rows: Row[]): void {
  console.log(`\n${imageId}`);
  console.log('  structure                        solid px   visible   %      pts  result');
  for (const row of rows) {
    const percent = row.originalPx === 0 ? 0 : (100 * row.visiblePx) / row.originalPx;
    const status = row.kept ? 'keep' : `drop (${row.reason})`;
    console.log(
      `  ${row.structureId.padEnd(32)}${String(row.originalPx).padStart(8)}` +
        `${String(row.visiblePx).padStart(10)}${percent.toFixed(1).padStart(7)}` +
        `${String(row.points).padStart(6)}  ${status}`,
    );
  }
  console.log(`  ${rows.filter((r) => r.kept).length} kept of ${rows.length}`);
}

/**
 * Muscles dropped from EVERY view they appear in are the ones a layered "deep"
 * render would unlock — they are never visible from outside.
 */
function printDeepGap(dropped: Record<string, string[]>, keptSomewhere: Set<string>): void {
  const droppedEverywhere = new Map<string, string[]>();

  for (const [imageId, ids] of Object.entries(dropped)) {
    for (const id of ids) {
      const views = droppedEverywhere.get(id) ?? [];
      views.push(imageId);
      droppedEverywhere.set(id, views);
    }
  }

  console.log('\nMuscles occluded in every view they were listed for');
  console.log('(these are what a superficial/deep layered render would unlock):');
  const rows = [...droppedEverywhere.entries()].filter(([id]) => !keptSomewhere.has(id));
  if (rows.length === 0) {
    console.log('  none');
    return;
  }
  for (const [id, views] of rows.sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${id.padEnd(32)} ${views.length} view(s): ${views.map((v) => v.replace('region-', '')).join(', ')}`);
  }
}

main();
