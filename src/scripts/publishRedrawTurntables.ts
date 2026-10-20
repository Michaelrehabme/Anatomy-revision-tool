import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { viewForAngle } from './lib/viewForAngle';

/**
 * Publishes the redrawn ligaments (owner, 20 Oct 2026) as turntables for
 * their Atlas card: one webp per angle in public/anatomy/redraws/, and the
 * list images.seed.ts builds them from.
 *
 *   npx tsx src/scripts/publishRedrawTurntables.ts --in renders/redraw-turn --open open.json
 *
 * WHY TURNTABLES. The first redraws were two or three views stitched into one
 * panel, which the card cannot turn (owner: "why do we no longer get the 12
 * image rotating view?"). renderMusclePanels.py renders each ligament at every
 * 30 degrees; here all its frames are cropped to ONE box, the union of what
 * each shows, so the bones do not jump as the student turns, and named
 * "-aNNN" so lib/rotationFrames.ts groups them.
 *
 * ATLAS ONLY. The owner asked for these on the Atlas for now; the card prefers
 * them (StructureCardBody), and the flashcards keep the ligament plates, which
 * come first in the image list.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const IN = join(ROOT, args.in ?? 'renders/redraw-turn');
const OUT = join(ROOT, 'public/anatomy/redraws');
const OPEN: Record<string, number> = args.open ? JSON.parse((await import('node:fs')).readFileSync(join(ROOT, args.open), 'utf8')) : {};
const LONGEST = 1200;
mkdirSync(OUT, { recursive: true });

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const rows: string[] = [];

for (const id of readdirSync(IN).sort()) {
  const dir = join(IN, id);
  const frames = readdirSync(dir).filter((f) => /^view-\d+\.png$/.test(f)).sort();
  const s = byId.get(id);
  if (!s || frames.length < 2) {
    console.warn(`skip ${id}: ${s ? 'fewer than two frames' : 'no such structure'}`);
    continue;
  }
  // The union of every frame's opaque area, so all crop to the same box.
  let box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  let size = { width: 0, height: 0 };
  for (const f of frames) {
    const { data, info } = await sharp(join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    size = { width: info.width, height: info.height };
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 8) {
          if (x < box.left) box.left = x;
          if (x > box.right) box.right = x;
          if (y < box.top) box.top = y;
          if (y > box.bottom) box.bottom = y;
        }
      }
    }
  }
  const pad = 16;
  const left = Math.max(0, box.left - pad);
  const top = Math.max(0, box.top - pad);
  const width = Math.min(size.width, box.right + pad) - left;
  const height = Math.min(size.height, box.bottom + pad) - top;
  const scale = Math.min(1, LONGEST / Math.max(width, height));
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);
  const angles: number[] = [];
  for (const f of frames) {
    const angle = (Number(f.replace(/\D/g, '')) * 15) % 360;
    angles.push(angle);
    await sharp(join(dir, f))
      .extract({ left, top, width, height })
      .resize(outW, outH)
      .flatten({ background: '#ffffff' })
      .webp({ quality: 82 })
      .toFile(join(OUT, `${id}-a${String(angle).padStart(3, '0')}.webp`));
  }
  const open = OPEN[id] ?? angles[0];
  const ordered = [open, ...angles.filter((a) => a !== open)];
  const views = ordered.map((a) => `{ angle: ${a}, view: '${viewForAngle(a, false)}' }`).join(', ');
  rows.push(
    `  { structureId: ${JSON.stringify(id)}, name: ${JSON.stringify(s.name)}, region: '${s.region}', subregion: '${s.subregion}', ` +
      `width: ${outW}, height: ${outH}, frames: [${views}] },`,
  );
  console.log(`${id}: ${frames.length} frames, ${outW}x${outH}, opens at ${open}`);
}

const out = `import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishRedrawTurntables.ts
 *
 * The redrawn ligaments' Atlas turntables (public/anatomy/redraws/): one row
 * per ligament, its frames in the order the card opens them, the first being
 * the view the owner's slides use.
 */
export interface RedrawTurntable {
  structureId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  width: number;
  height: number;
  frames: { angle: number; view: ViewType }[];
}

export const REDRAW_TURNTABLES: RedrawTurntable[] = [
${rows.join('\n')}
];
`;
const target = join(ROOT, 'src/features/anatomy-revision/data/seed/redrawTurntables.generated.ts');
writeFileSync(target, out.replace(/\n/g, '\r\n'));
console.log(`${rows.length} turntables -> ${target}`);
if (!existsSync(OUT)) throw new Error('no output');
