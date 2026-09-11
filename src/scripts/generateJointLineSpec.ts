/**
 * Builds the input renderJointMasks.py reads: for each joint, the Blender
 * meshes of the two bones that form it.
 *
 *   npx tsx src/scripts/generateJointLineSpec.ts --out joint-lines.spec.json
 *
 * WHY A SEPARATE STEP. The bone names live in the TypeScript seed
 * (articulatingStructureIds) and the mesh names live in the skeletal mapping
 * JSON; Blender's Python can read neither. This joins them and writes a flat
 * file the renderer can load without knowing anything about the app.
 *
 * A joint is emitted only when BOTH bones resolve to meshes. The alternative —
 * emitting a partial pair — would render a mask against nothing and produce an
 * empty hotspot that looks like a tracing failure rather than missing content.
 * Joints that drop out are listed on stderr with the part that is missing.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed';
import { isJoint } from '../features/anatomy-revision/types/structure';

interface SkeletalEntry {
  id: string;
  blenderObjects: string[];
}

/**
 * Which articulation is meant, when the two bones touch in more than one place.
 * Tibia and fibula meet at both ends, as do radius and ulna; without a hint the
 * nearest-point search picks whichever happens to be marginally closer, which
 * is a coin toss between two real joints. "min" means the lower of the two in
 * world space (Z is up), "max" the upper.
 *
 * Only joints whose bone pair is genuinely ambiguous need an entry here.
 */
const Z_PREFER: Record<string, 'min' | 'max'> = {
  'distal-radioulnar-joint': 'min',
  'proximal-radioulnar-joint': 'max',
  'distal-tibiofibular-joint': 'min',
  'proximal-tibiofibular-joint': 'max',
};

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      out[argv[i].slice(2)] = argv[i + 1];
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const outPath = args.out ?? 'joint-lines.spec.json';
const mappingPath = args.mapping ?? 'ta2-mapping-skeletal.resolved.json';

const mapping: SkeletalEntry[] = JSON.parse(readFileSync(mappingPath, 'utf8')).mapping;
const meshesFor = new Map(mapping.map((m) => [m.id, m.blenderObjects]));

const joints = ALL_STRUCTURES.filter(isJoint);
const emitted: unknown[] = [];
const skipped: string[] = [];

for (const joint of joints) {
  const parts = joint.articulatingStructureIds ?? [];

  // Pairwise only. A joint naming three or more parts (the elbow complex, the
  // carpals) has no single "the two bones", and forcing a pair would pick one
  // arbitrarily — those need authoring, not inference.
  if (parts.length !== 2) {
    skipped.push(`${joint.id}: ${parts.length} articulating parts, need exactly 2`);
    continue;
  }

  const [aId, bId] = parts;
  const aObjects = meshesFor.get(aId) ?? [];
  const bObjects = meshesFor.get(bId) ?? [];

  const missing = [
    aObjects.length === 0 ? aId : null,
    bObjects.length === 0 ? bId : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    skipped.push(`${joint.id}: no meshes for ${missing.join(', ')}`);
    continue;
  }

  emitted.push({
    id: joint.id,
    name: joint.name,
    a: { id: aId, objects: aObjects },
    b: { id: bId, objects: bObjects },
    ...(Z_PREFER[joint.id] ? { zPrefer: Z_PREFER[joint.id] } : {}),
  });
}

writeFileSync(
  outPath,
  JSON.stringify({ schemaVersion: 1, generated: new Date().toISOString(), joints: emitted }, null, 2),
);

console.log(`${emitted.length} joint(s) -> ${outPath}`);
if (skipped.length > 0) {
  console.error(`\n${skipped.length} joint(s) not emitted:`);
  for (const s of skipped) console.error(`  ${s}`);
}
