import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_STRUCTURES, ALL_IMAGES } from '../features/anatomy-revision/data/seed';
import { buildLocateQuestions } from '../features/anatomy-revision/lib/questionGenerators/locate';

/**
 * Works out which structures still cannot be pointed at, and groups them into
 * plates drawn close enough to aim at.
 *
 *   npx tsx src/scripts/generateSubRegionSpec.ts --out subregion-plates.spec.json
 *
 * WHY A CLOSER PLATE. The region plates and the skeleton plates frame a whole
 * limb, and at that scale the small structures are a few hundred pixels: the
 * lumbricals, the interossei, the scaphoid, the atlas. They were dropped rather
 * than traced, because a target a finger cannot hit is not a question. The
 * structures are fine; the framing is wrong for them. A hand drawn at forearm
 * scale cannot give the lumbricals a target, and at hand scale it can.
 *
 * WHAT GOES ON A PLATE IS MEASURED, NOT LISTED. The subjects start as exactly
 * the structures with no locate question that do have geometry, grouped by
 * their own subregion. Nothing is hand-picked.
 *
 * BUT AN EXISTING PLATE IS NEVER SHRUNK, and that is not a detail. Once a
 * plate's hotspots are in the seed, its structures HAVE locate questions, so a
 * naive re-run drops them from the "missing" set, rebuilds the plate with the
 * few stragglers and reframes the camera around them. The published image and
 * the masks traced from the old framing then disagree, and every hotspot on it
 * is wrong by the difference. So a plate already in the spec keeps its
 * subjects, and a re-run may only add.
 *
 * Bones and muscles sit on the same plate deliberately. A student looking at a
 * hand should be asked for the scaphoid and the opponens pollicis from the same
 * picture, which is also how a textbook plate works.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const outPath = args.out ?? 'subregion-plates.spec.json';

/** Plates already defined. Their subjects are kept even once answered. */
const existing = new Map<string, any>();
if (existsSync(outPath) && args.rebuild !== 'true') {
  for (const p of JSON.parse(readFileSync(outPath, 'utf8')).plates ?? []) existing.set(p.key, p);
}

const skel = JSON.parse(readFileSync(`${ROOT}/ta2-mapping-skeletal.resolved.json`, 'utf8'));
const muscles = JSON.parse(readFileSync(`${ROOT}/ta2-mapping.resolved.json`, 'utf8'));
const meshFor = new Map<string, string[]>();
for (const m of [...skel.mapping, ...muscles.mapping]) {
  if (m.blenderObjects?.length) meshFor.set(m.id, m.blenderObjects);
}

const answered = new Set(buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES).map((q) => q.targetStructureId));

interface Subject { id: string; name: string; kind: 'bone' | 'muscle'; objects: string[] }
interface Plate { region: string; subregion: string; subjects: Subject[] }
const plates = new Map<string, Plate>();
const noGeometry: string[] = [];

for (const s of ALL_STRUCTURES as any[]) {
  if (answered.has(s.id)) continue;
  const objects = meshFor.get(s.id);
  if (!objects) {
    noGeometry.push(`${s.id} (${s.category})`);
    continue;
  }

  // A muscle is drawn ON the skeleton; everything else IS the skeleton, so the
  // mask and the plate treat them differently. Landmarks that are really bones
  // — the scaphoid, the talus, the cuneiforms — go with the bones, because
  // that is what they are and a silhouette is what they have.
  const kind: 'bone' | 'muscle' = s.category === 'muscle' ? 'muscle' : 'bone';
  const key = `${s.region}__${s.subregion}`;
  const plate: Plate = plates.get(key) ?? { region: s.region, subregion: s.subregion, subjects: [] };
  plate.subjects.push({ id: s.id, name: s.name, kind, objects });
  plates.set(key, plate);
}

// Union with what the spec already defined, so a plate only ever grows.
for (const [key, prev] of existing) {
  const plate: Plate = plates.get(key) ?? { region: prev.region, subregion: prev.subregion, subjects: [] };
  const have = new Set(plate.subjects.map((s) => s.id));
  for (const s of prev.subjects as Subject[]) if (!have.has(s.id)) plate.subjects.push(s);
  plates.set(key, plate);
}

const emitted = [...plates.entries()]
  .map(([key, p]) => ({ key, ...p, subjects: [...p.subjects].sort((a, b) => a.id.localeCompare(b.id)) }))
  .sort((a, b) => b.subjects.length - a.subjects.length);

writeFileSync(
  outPath,
  JSON.stringify({ schemaVersion: 1, generated: new Date().toISOString(), plates: emitted }, null, 1),
);

const total = emitted.reduce((n, p) => n + p.subjects.length, 0);
console.log(`${emitted.length} plate(s), ${total} subject(s) -> ${outPath}`);
for (const p of emitted) {
  const bones = p.subjects.filter((s) => s.kind === 'bone').length;
  console.log(`  ${p.key.padEnd(30)} ${String(p.subjects.length).padStart(3)}  (${bones} bone, ${p.subjects.length - bones} muscle)`);
}
if (noGeometry.length) {
  console.log(`\n${noGeometry.length} missing with no geometry to draw, so not on any plate:`);
  console.log(`  ${noGeometry.join(', ')}`);
}
