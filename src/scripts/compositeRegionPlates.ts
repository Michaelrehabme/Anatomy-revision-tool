/**
 * Composites the regional subject plate over the whole-body context plate.
 *
 * Rendering every muscle into one image gives a realistic figure with usable
 * landmarks, but buries the deep regions: back-core's erector spinae and
 * intercostals vanish behind latissimus dorsi and trapezius, and a muscle you
 * cannot see cannot carry a locate question. Rendering only the region's own
 * muscles keeps them visible but leaves the figure looking amputated.
 *
 * So both are rendered and combined here. The context plate provides the
 * surrounding body; wherever a region muscle is actually visible, the subject
 * plate is pasted on top instead.
 *
 * The paste mask is the union of that view's per-muscle masks — the exact same
 * files masksToHotspots.ts traces. That is what keeps the picture and the
 * hotspots in agreement: every pixel a student can see as a region muscle is a
 * pixel some hotspot claims, and vice versa. Deriving the mask any other way
 * (say, from the subject plate's alpha, which also contains bone) would let the
 * two drift apart.
 *
 * Usage:
 *   npx tsx src/scripts/compositeRegionPlates.ts --renders renders/regions-bones
 *     [--views anterior=0,lateral=6,posterior=12] [--out DIR] [--dilate 1]
 */
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
 * Grows the mask by `n` pixels. The masks are traced from the same renders, but
 * antialiased subject edges sit a fraction of a pixel outside the binary mask;
 * without a small dilation those edge pixels come from the context plate and
 * leave a faint outline around every muscle.
 */
function dilate(mask: Uint8Array, width: number, height: number, n: number): Uint8Array {
  let current = mask;
  for (let pass = 0; pass < n; pass++) {
    const next = new Uint8Array(current.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (current[i]) { next[i] = 1; continue; }
        for (let dy = -1; dy <= 1 && !next[i]; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (current[ny * width + nx]) { next[i] = 1; break; }
          }
        }
      }
    }
    current = next;
  }
  return current;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const root = args.renders ?? 'renders/regions-bones';
  const outDir = args.out ?? root;
  const dilatePasses = Number(args.dilate ?? '1');

  const views: [string, number][] = (args.views ?? 'anterior=0,lateral=6,posterior=12')
    .split(',')
    .map((pair) => {
      const [name, frame] = pair.split('=');
      return [name, Number(frame)];
    });

  let written = 0;
  for (const region of readdirSync(root)) {
    const regionDir = join(root, region);
    const maskRoot = join(regionDir, 'masks');
    if (!existsSync(maskRoot)) continue;

    for (const [, frame] of views) {
      const tag = String(frame).padStart(2, '0');
      const subjectPath = join(regionDir, `frame-${tag}.png`);
      const contextPath = join(regionDir, `context-${tag}.png`);
      if (!existsSync(subjectPath) || !existsSync(contextPath)) {
        console.error(`${region} frame-${tag}: missing subject or context plate`);
        continue;
      }

      const subject = decodePng(subjectPath);
      const context = decodePng(contextPath);
      if (subject.width !== context.width || subject.height !== context.height) {
        console.error(`${region} frame-${tag}: plate sizes differ`);
        continue;
      }

      const n = subject.width * subject.height;
      const union = new Uint8Array(n);
      let masks = 0;
      for (const muscle of readdirSync(maskRoot)) {
        const p = join(maskRoot, muscle, `frame-${tag}.png`);
        if (!existsSync(p)) continue;
        const m = decodePng(p);
        if (m.width !== subject.width || m.height !== subject.height) continue;
        for (let i = 0; i < n; i++) if (m.data[i * 4 + 3] > 128) union[i] = 1;
        masks++;
      }

      const paste = dilatePasses > 0 ? dilate(union, subject.width, subject.height, dilatePasses) : union;

      const out = new Uint8Array(n * 4);
      let pasted = 0;
      for (let i = 0; i < n; i++) {
        const src = paste[i] ? subject.data : context.data;
        if (paste[i]) pasted++;
        out[i * 4] = src[i * 4];
        out[i * 4 + 1] = src[i * 4 + 1];
        out[i * 4 + 2] = src[i * 4 + 2];
        out[i * 4 + 3] = src[i * 4 + 3];
      }

      mkdirSync(join(outDir, region), { recursive: true });
      const path = join(outDir, region, `composited-${tag}.png`);
      writeFileSync(path, encodePng(out, subject.width, subject.height));
      console.log(
        `${region.padEnd(16)} frame-${tag}  ${String(masks).padStart(2)} masks  ` +
          `${((100 * pasted) / n).toFixed(1)}% subject`,
      );
      written++;
    }
  }

  console.log(`\n${written} composited plate(s) -> ${outDir}`);
}

main();
