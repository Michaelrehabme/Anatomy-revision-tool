import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from './lib/png';
import { binariseAlpha, maskToPolygons } from './lib/maskToPolygons';

/**
 * Which rendered ligaments traced, for seeding the second tranche.
 *
 *   npx tsx src/scripts/tracedLigaments.ts --renders renders/ligaments-t2-studio --out renders/tranche2-traced.json
 *   npx tsx src/scripts/generateLigamentSeed.ts --min-visible 0 --traced renders/tranche2-traced.json
 *
 * A ligament traced if at least MIN_ANGLES of its angles have a target mask
 * over the publisher's MIN_TARGET_AREA, traced with the publisher's own
 * settings — the same test publishLigamentPlates.ts applies, run before the
 * ligament is seeded (the publisher refuses anything unseeded). One angle is
 * not enough to turn: a rotation set needs two frames.
 */
const args = process.argv.slice(2);
const argOf = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const root = argOf('renders') ?? 'renders/ligaments-t2-studio';
const out = argOf('out') ?? 'renders/tranche2-traced.json';
const MIN_TARGET_AREA = Number(argOf('min-area') ?? 0.0002);
const MIN_ANGLES = Number(argOf('min-angles') ?? 2);

const traced: string[] = [];
const report: string[] = [];
for (const id of readdirSync(root).filter((d) => existsSync(join(root, d)) && !d.includes('.')).sort()) {
  const angles = readdirSync(join(root, id)).filter((n) => /^a\d{3}$/.test(n));
  if (!angles.length) continue; // not a ligament's render folder
  let ok = 0;
  let best = 0;
  for (const angle of angles) {
    const maskPath = join(root, id, angle, 'mask.png');
    if (!existsSync(maskPath)) continue;
    const mask = decodePng(maskPath);
    const t = maskToPolygons(binariseAlpha(mask.data, mask.width, mask.height), mask.width, mask.height, {
      minComponentPx: 60,
      epsilon: 1.5,
    });
    if (t.polygons.length && t.area >= MIN_TARGET_AREA) ok++;
    best = Math.max(best, t.area);
  }
  const verdict = ok >= MIN_ANGLES;
  if (verdict) traced.push(id);
  report.push(`${verdict ? 'traced ' : 'hidden '} ${id.padEnd(56)} ${ok}/${angles.length} angles, best ${(best * 100).toFixed(3)}%`);
}
writeFileSync(out, JSON.stringify(traced, null, 1));
for (const line of report) console.log(line);
console.log(`${traced.length} of ${report.length} ligament(s) traced -> ${out}`);
