import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Turns the candidate list from generateLigamentSeed.ts --candidates into a
 * render spec for renderLigamentPlates.py, then ligamentFraming.ts sets each
 * entry's frame and bones.
 *
 *   npx tsx src/scripts/generateLigamentSeed.ts --min-visible 0 --candidates renders/tranche2-candidates.json
 *   npx tsx src/scripts/buildLigamentTrancheSpec.ts --candidates renders/tranche2-candidates.json --out ligament-tranche2.spec.json
 *   npx tsx src/scripts/ligamentFraming.ts --spec ligament-tranche2.spec.json
 *
 * Left side, eight angles, like the first tranche. A ligament the survey saw
 * less than GHOST_BELOW of from any angle is inside a joint or under a bone,
 * so the bones it attaches to are GHOSTED — drawn see-through, as the femur is
 * for the ACL — rather than left to hide it. Nothing here decides what gets
 * seeded: that is whatever traces once rendered.
 */
const GHOST_BELOW = 0.2;
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const args = process.argv.slice(2);
const argOf = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const candidatesPath = argOf('candidates') ?? 'renders/tranche2-candidates.json';
const outPath = argOf('out') ?? 'ligament-tranche2.spec.json';

interface Candidate { id: string; name: string; subregion: string; best: number; meshes: string[]; attachmentBones: string[] }
const { candidates } = JSON.parse(readFileSync(candidatesPath, 'utf8')) as { candidates: Candidate[] };

const leftSide = (names: string[]) => {
  const left = names.filter((n) => /\.(o\d?)?l$/.test(n));
  return left.length ? left : names.filter((n) => !/\.(o\d?)?[lr]$/.test(n));
};
const toLeft = (bone: string) => bone.replace(/\.r$/, '.l');

const ligaments = candidates
  .map((c) => {
    const objects = leftSide(c.meshes);
    const ghost = c.best < GHOST_BELOW ? [...new Set(c.attachmentBones.map(toLeft))] : [];
    return { key: c.id, name: c.name, subregion: c.subregion, objects, angles: ANGLES, ...(ghost.length ? { ghost } : {}) };
  })
  .filter((l) => l.objects.length > 0);

writeFileSync(
  outPath,
  JSON.stringify({ schemaVersion: 1, note: 'Second tranche; framed by ligamentFraming.ts.', ligaments }, null, 1),
);
console.log(`${ligaments.length} ligament(s) -> ${outPath} (${ligaments.filter((l) => 'ghost' in l).length} with ghosted attachment bones)`);
