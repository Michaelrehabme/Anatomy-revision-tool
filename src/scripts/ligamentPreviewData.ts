import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
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

const sharp = (await import('sharp')).default;

/**
 * JPEG, because six rotation sets of striped renders as PNG is 25MB and the
 * page cap is 16. The fibre lines are exactly what PNG compresses worst.
 * Quality 82 keeps the outlines crisp at the sizes the page shows.
 */
async function toJpegUri(rgba: Buffer, width: number, height: number): Promise<string> {
  const buf = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}

const out: any[] = [];
for (const s of SUBJECTS) {
  const dir = `${rendersDir}/${s.key}`;
  const hasFlat = existsSync(`${dir}/mask.png`);
  const hasFrames = existsSync(dir) && readdirSync(dir).some((n) => /^a\d{3}$/.test(n));
  if (!hasFlat && !hasFrames) {
    console.log(`skipped ${s.key}: no renders`);
    continue;
  }

  // The flat render, if there is one. With a rotation set it is only a
  // fallback; the best angle of the set becomes the subject's picture.
  const flatMask = hasFlat ? `${dir}/mask.png` : null;
  const mask = flatMask ? decodePng(flatMask) : { data: Buffer.alloc(4), width: 1, height: 1 };
  const binary = binariseAlpha(mask.data, mask.width, mask.height);
  const traced = maskToPolygons(binary, mask.width, mask.height, { minComponentPx: 60, epsilon: 1.5 });

  const images: Record<string, string> = {};
  for (const which of hasFlat ? (['context', 'highlight'] as const) : []) {
    const png = decodePng(`${dir}/${which}.png`);
    const small = downscaleOntoWhite(png.data, png.width, png.height, scaleTo);
    images[which] = await toJpegUri(small.rgba, small.width, small.height);
  }

  // A rotation set, if the renderer was given a list of angles: one folder
  // per angle under the subject. Each angle gets its own traced target, since
  // how much of the ligament is clickable changes with the view — that is the
  // point of measuring it per angle rather than shipping every angle blindly.
  const rotation: any[] = [];
  for (const dir2 of readdirSync(dir, { withFileTypes: true })) {
    if (!dir2.isDirectory() || !/^a\d{3}$/.test(dir2.name)) continue;
    // A render still in progress has written some of the three files; skip
    // the angle until all are there rather than fall over on the missing one.
    if (!['context', 'highlight', 'mask'].every((f) => existsSync(`${dir}/${dir2.name}/${f}.png`))) continue;
    const angle = Number(dir2.name.slice(1));
    const m = decodePng(`${dir}/${dir2.name}/mask.png`);
    const b = binariseAlpha(m.data, m.width, m.height);
    const t = maskToPolygons(b, m.width, m.height, { minComponentPx: 60, epsilon: 1.5 });
    const frameImages: Record<string, string> = {};
    for (const which of ['context', 'highlight'] as const) {
      const png = decodePng(`${dir}/${dir2.name}/${which}.png`);
      const small = downscaleOntoWhite(png.data, png.width, png.height, Math.min(scaleTo, 800));
      frameImages[which] = await toJpegUri(small.rgba, small.width, small.height);
    }
    rotation.push({
      angle,
      area: t.area,
      polygons: t.polygons,
      // Both pictures per angle, so the locate demo can rotate the unanswered
      // plate and the identify demo the highlighted one.
      context: frameImages.context,
      highlight: frameImages.highlight,
    });
  }
  rotation.sort((p, q) => p.angle - q.angle);

  const litPx = binary.reduce((n, v) => n + v, 0);
  const best = rotation.length ? rotation.reduce((a, b) => (b.area > a.area ? b : a)) : null;
  out.push({
    ...s,
    polygons: best ? best.polygons : traced.polygons,
    centroid: traced.centroid,
    area: best ? best.area : traced.area,
    bestAngle: best ? best.angle : null,
    maskPixels: litPx,
    maskShare: litPx / (mask.width * mask.height),
    images: best ? { context: best.context, highlight: best.highlight } : images,
    ...(rotation.length ? { rotation } : {}),
  });
  if (rotation.length) {
    console.log(
      `  rotation: ${rotation.map((r) => `${r.angle}°=${(r.area * 100).toFixed(2)}%`).join(' ')}`,
    );
  }
  console.log(
    `${s.key.padEnd(28)} ${traced.polygons.length} polygon(s), ` +
      `${traced.points} pts, ${(traced.area * 100).toFixed(2)}% of frame`,
  );
}

writeFileSync(outPath, JSON.stringify(out));
console.log(`\n${out.length} subject(s) -> ${outPath} (${(readFileSync(outPath).length / 1024 / 1024).toFixed(1)}MB)`);
