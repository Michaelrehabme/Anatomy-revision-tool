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

/**
 * Per-joint camera and tolerance overrides, set by looking at the output.
 *
 * `band` is the contact tolerance AND, through the contact bounding box, what
 * the camera frames — so tightening one without opening `margin` zooms past the
 * point of context. Both of these needed the pairing: at the default 0.012 the
 * band read as a broad patch over the whole articular surface rather than a
 * line along it.
 */
/**
 * Joints whose articulatingStructureIds are too coarse to derive a line from.
 *
 * carpometacarpal-joint-thumb names `carpals + metacarpals` — eight bones
 * against five — so the band comes out along the whole carpometacarpal row and
 * nothing distinguishes the thumb. The thumb joint is trapezium against the
 * first metacarpal, and both exist in the model.
 *
 * The seed is left alone on purpose. articulatingStructureIds is content: it is
 * what a student is told the joint forms between, and "the carpals and the
 * metacarpals" is a fair thing to say at whole-bone level (see that field's own
 * note in structures.joints.seed.ts). This is the renderer needing to be more
 * specific than the teaching is, which is a mapping concern, not a content one.
 *
 * Each side is either a structure id the skeletal mapping resolves, or a
 * Z-Anatomy mesh name used verbatim — the individual metacarpals are meshes in
 * the model but are only grouped as one structure in the seed.
 */
const PART_OVERRIDE: Record<string, { a: string[]; b: string[] }> = {
  'carpometacarpal-joint-thumb': {
    a: ['trapezium'],
    b: ['First metacarpal bone.l', 'First metacarpal bone.r'],
  },
  'carpometacarpal-joint-2': {
    a: ['trapezoid'],
    b: ['Second metacarpal bone.l', 'Second metacarpal bone.r'],
  },
  'carpometacarpal-joint-3': {
    a: ['capitate'],
    b: ['Third metacarpal bone.l', 'Third metacarpal bone.r'],
  },
  // Four and five share the hamate, so only the metacarpal separates them.
  'carpometacarpal-joint-4': {
    a: ['hamate'],
    b: ['Fourth metacarpal bone.l', 'Fourth metacarpal bone.r'],
  },
  'carpometacarpal-joint-5': {
    a: ['hamate'],
    b: ['Fifth metacarpal bone.l', 'Fifth metacarpal bone.r'],
  },
};

const TUNING: Record<string, { band?: number; margin?: number; frame?: number }> = {
  'glenohumeral-joint': { band: 0.005 },
  'humeroulnar-joint': { band: 0.005, margin: 6 },

  // The carpometacarpal joints need a far wider frame than anything else here.
  // The camera frames the contact region, and theirs is roughly a hundredth of
  // the hand — at the default the render is two unrecognisable white shapes
  // filling the frame, which is no use as a locate image: the student has to be
  // able to see it IS a hand before picking a joint out of it.
  // `frame` rather than `margin`: these five contact regions differ sevenfold
  // in size, so a multiplier that frames a hand for the thumb frames two white
  // shapes for the fifth. 0.15 world units is a hand.
  //
  // Their bands also need a wider tolerance. The carpals are coarsely meshed
  // where they meet the metacarpals — the fifth found six contact vertices at
  // the default — and a band of two faces is a handful of pixels once the
  // camera pulls back far enough to show the hand.
  'carpometacarpal-joint-thumb': { frame: 0.15, band: 0.03 },
  'carpometacarpal-joint-2': { frame: 0.15, band: 0.03 },
  'carpometacarpal-joint-3': { frame: 0.15, band: 0.04 },
  'carpometacarpal-joint-4': { frame: 0.15, band: 0.04 },
  'carpometacarpal-joint-5': { frame: 0.15, band: 0.05 },
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

  const override = PART_OVERRIDE[joint.id];
  const [aId, bId] = override ? [override.a.join('+'), override.b.join('+')] : parts;

  /** A structure id the mapping knows, or a mesh name to pass through verbatim. */
  const resolve = (names: string[]): string[] =>
    names.flatMap((n) => meshesFor.get(n) ?? [n]);

  const aObjects = override ? resolve(override.a) : (meshesFor.get(aId) ?? []);
  const bObjects = override ? resolve(override.b) : (meshesFor.get(bId) ?? []);

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
    ...(TUNING[joint.id] ?? {}),
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
