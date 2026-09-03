/**
 * Stitches the per-view muscle panel renders into one image per muscle.
 *
 * renderMusclePanels.py emits <muscle>/view-NN.png, one per azimuth. The panel
 * images the app loads are a single file each, laid out as a row of views the
 * way the retired AI crops were — that side-by-side comparison is most of what
 * makes a panel readable, since one angle rarely shows a muscle's extent.
 *
 * Alpha is preserved rather than flattened so the panel sits on whatever the
 * card background happens to be, matching the regional renders.
 *
 * Usage:
 *   npx tsx src/scripts/compositePanels.ts --in renders/panels --out renders/panels-composited
 */
import { readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from './lib/png';
import { encodePng } from './lib/pngEncode';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      out[argv[i].slice(2)] = argv[i + 1];
    }
  }
  return out;
}

/**
 * Crops fully-transparent margins, keeping `pad` pixels of breathing room.
 * The camera frames each muscle's own bounding box with generous slack so
 * surrounding bone stays in shot, which leaves a lot of empty canvas; trimming
 * it lets the subject fill the card instead of floating in the middle of it.
 */
function trimTransparent(
  rgba: Uint8Array,
  width: number,
  height: number,
  pad: number,
): { data: Uint8Array; width: number; height: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { data: rgba, width, height };

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const src = ((minY + y) * width + minX) * 4;
    out.set(rgba.subarray(src, src + w * 4), y * w * 4);
  }
  return { data: out, width: w, height: h };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const inDir = args.in ?? 'renders/panels';
  const outDir = args.out ?? 'renders/panels-composited';
  const gap = Number(args.gap ?? '0');

  if (!existsSync(inDir)) {
    console.error(`Panel render root not found: ${inDir}`);
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  let written = 0;
  for (const muscle of readdirSync(inDir)) {
    const dir = join(inDir, muscle);
    if (!statSync(dir).isDirectory()) continue;

    const views = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
    if (views.length === 0) {
      console.error(`${muscle}: no view renders`);
      continue;
    }

    // Trim each view to its own content BEFORE composing. Trimming only the
    // finished strip leaves every view's empty side margins in place, which
    // makes the result far wider than it is tall; the Muscle Card scales the
    // panel with object-contain inside a roughly square box, so a 3:1 strip
    // renders at about a third of the height it could and wastes the card.
    const decoded = views
      .map((f) => decodePng(join(dir, f)))
      .map((d) => trimTransparent(new Uint8Array(d.data), d.width, d.height, 8));

    // Pad each back to a common height so they sit on a shared baseline rather
    // than each floating at its own vertical offset.
    const height = Math.max(...decoded.map((d) => d.height));
    const width = decoded.reduce((n, d) => n + d.width, 0) + gap * (decoded.length - 1);
    const canvas = new Uint8Array(width * height * 4);

    let xOffset = 0;
    for (const view of decoded) {
      const yOffset = Math.floor((height - view.height) / 2);
      for (let y = 0; y < view.height; y++) {
        const src = y * view.width * 4;
        const dst = ((y + yOffset) * width + xOffset) * 4;
        canvas.set(view.data.subarray(src, src + view.width * 4), dst);
      }
      xOffset += view.width + gap;
    }

    const cropped = trimTransparent(canvas, width, height, 24);
    const path = join(outDir, `${muscle}.png`);
    writeFileSync(path, encodePng(cropped.data, cropped.width, cropped.height));
    console.log(
      `${muscle.padEnd(24)} ${views.length} views -> ${cropped.width}x${cropped.height}` +
        ` (from ${width}x${height})`,
    );
    written++;
  }

  console.log(`\n${written} panel(s) -> ${outDir}`);
}

main();
