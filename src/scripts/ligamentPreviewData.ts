import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { decodePng } from './lib/png';
import { binariseAlpha, maskToPolygons } from './lib/maskToPolygons';

/**
 * Packs the ligament preview renders and their traced hotspots into one file
 * the preview page can inline.
 *
 *   npx tsx src/scripts/ligamentPreviewData.ts --renders renders/ligaments \
 *       --out ligament-preview.data.json
 *
 * This is a preview, not a pipeline. It exists so the page can show a REAL
 * hotspot traced from a real mask rather than a hand-drawn rectangle — the
 * question the preview has to answer is whether a ligament is a clickable
 * target, and a mocked outline would dodge exactly that.
 *
 * The images go in as data URIs because an artifact page cannot fetch anything
 * from disk, so they are downscaled on the way — see downscaleOntoWhite for
 * why that is a box filter and not a shortcut.
 */

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const rendersDir = args.renders ?? 'renders/ligaments';
const outPath = args.out ?? 'ligament-preview.data.json';
const scaleTo = Number(args.width ?? 900);

/**
 * Box-filter downscale, composited onto white so the PNG can drop its alpha.
 *
 * The first preview used nearest-neighbour and it was the main reason the
 * pictures looked soft: sampling one pixel in every four throws away the
 * antialiasing the renderer spent its samples on, and the edges shimmer.
 * Averaging the whole box of source pixels each output pixel covers keeps
 * them. This is still not a resampling library, but at a 1600 → 900 shrink
 * it does not need to be.
 */
function downscaleOntoWhite(rgba: Buffer, w: number, h: number, target: number) {
  const scale = Math.min(1, target / w);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y / scale);
    const y1 = Math.min(h, Math.max(y0 + 1, Math.floor((y + 1) / scale)));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x / scale);
      const x1 = Math.min(w, Math.max(x0 + 1, Math.floor((x + 1) / scale)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const si = (sy * w + sx) * 4;
          const alpha = rgba[si + 3] / 255;
          // The renders are transparent-background; the page shows them on
          // white, so bake that in rather than ship an alpha channel.
          r += rgba[si] * alpha + 255 * (1 - alpha);
          g += rgba[si + 1] * alpha + 255 * (1 - alpha);
          b += rgba[si + 2] * alpha + 255 * (1 - alpha);
          n++;
        }
      }
      const di = (y * nw + x) * 4;
      out[di] = Math.round(r / n);
      out[di + 1] = Math.round(g / n);
      out[di + 2] = Math.round(b / n);
      out[di + 3] = 255;
    }
  }
  return { rgba: out, width: nw, height: nh };
}

interface Subject {
  key: string;
  name: string;
  joint: string;
  attaches: string[];
  visibility: number;
  treatment: string;
  note: string;
}

const SUBJECTS: Subject[] = JSON.parse(readFileSync(args.subjects ?? 'ligament-preview.subjects.json', 'utf8'));

const { encodePng } = await import('./lib/pngEncode');

const out: any[] = [];
for (const s of SUBJECTS) {
  const dir = `${rendersDir}/${s.key}`;
  if (!existsSync(`${dir}/mask.png`)) {
    console.log(`skipped ${s.key}: no renders`);
    continue;
  }

  const mask = decodePng(`${dir}/mask.png`);
  const binary = binariseAlpha(mask.data, mask.width, mask.height);
  const traced = maskToPolygons(binary, mask.width, mask.height, { minComponentPx: 60, epsilon: 1.5 });

  const images: Record<string, string> = {};
  for (const which of ['context', 'highlight'] as const) {
    const png = decodePng(`${dir}/${which}.png`);
    const small = downscaleOntoWhite(png.data, png.width, png.height, scaleTo);
    images[which] = 'data:image/png;base64,' + encodePng(small.rgba, small.width, small.height).toString('base64');
  }

  const litPx = binary.reduce((n, v) => n + v, 0);
  out.push({
    ...s,
    polygons: traced.polygons,
    centroid: traced.centroid,
    area: traced.area,
    maskPixels: litPx,
    maskShare: litPx / (mask.width * mask.height),
    images,
  });
  console.log(
    `${s.key.padEnd(28)} ${traced.polygons.length} polygon(s), ` +
      `${traced.points} pts, ${(traced.area * 100).toFixed(2)}% of frame`,
  );
}

writeFileSync(outPath, JSON.stringify(out));
console.log(`\n${out.length} subject(s) -> ${outPath} (${(readFileSync(outPath).length / 1024 / 1024).toFixed(1)}MB)`);
