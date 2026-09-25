import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { isMuscle } from '../features/anatomy-revision/types/structure';
import type { SubRegion } from '../features/anatomy-revision/types/region';

/**
 * Writes the spec renderMusclePlates.py renders every muscle from.
 *
 *   npx tsx src/scripts/generateMusclePlateSpec.ts
 *
 * WHY THE MUSCLES GET PLATES AT ALL. Every other family — bones, sub-regions,
 * landmarks, ligaments, joints — is drawn by a script that calls boneLook.py
 * and turns on a turntable. The muscles are still on the panel renders of 9
 * and 18 September: one flat frame each, a lower resolution, their own
 * lighting, and nothing to turn. 122 of the 464 structures the app asks about
 * are therefore asked on a visibly poorer picture than the rest, which is the
 * "consistency across images is key" complaint, still open.
 *
 * WHAT CHANGES, beyond the look:
 *
 *   TWELVE FRAMES. The same thirty-degree turntable as the joints and the
 *   sub-region plates, so one muscle is one locate question and one identify
 *   question that the student can turn (lib/rotationFrames.ts), instead of
 *   three fixed views.
 *
 *   THE MUSCLE IN CONTEXT, NOT ALONE. The old panels drew one muscle red on a
 *   bare skeleton. That answers "which structure is highlighted?" by being the
 *   only soft tissue in the picture, and it is not what a muscle looks like in
 *   a book. Every other muscle in frame is drawn too, and the target is picked
 *   out of them — which is also the atlas picture the user asked for.
 *
 *   THE SUPERFICIAL LAYER COMES OFF A DEEP MUSCLE. Subscapularis under the
 *   scapula, the deep hip rotators under gluteus maximus, the plantar
 *   intrinsics: drawn with everything else in place they are invisible, which
 *   is exactly why they have no hotspot on the region plates today. So a deep
 *   target is drawn with the superficial layer removed, as an atlas plate
 *   does it.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = `${ROOT}/muscle-plates.spec.json`;

interface Mapped {
  id: string;
  name: string;
  region: string;
  blenderObjects?: string[];
}

const mapping: Mapped[] = JSON.parse(
  readFileSync(`${ROOT}/ta2-mapping.resolved.json`, 'utf8'),
).mapping;

/**
 * HOW DEEP EACH MUSCLE LIES, 0 for the layer you see first.
 *
 * A plate draws the target and everything at ITS depth or deeper, so a depth-2
 * muscle is drawn with both layers above it taken off. Two values were not
 * enough. The body is layered three, four and five deep in the places the
 * dataset cares most about — the back, the abdominal wall, the forearm, the
 * sole of the foot — and with one "deep" bucket the buried muscles simply
 * traded who was hiding them: 43 of the 122 came out under 1.5% of their own
 * frame at their best angle, 22 of them muscles the deep bucket had already
 * "fixed". Rectus abdominis, which the owner flagged, was one: 7 angles of 12,
 * never more than 0.53%, because the external oblique is drawn over it.
 *
 * The ranks are anatomy, not measurement — the sole of the foot has four named
 * layers and this is them — but every one was checked against the measured
 * figures from the first full run, and the cross-check below fails the build if
 * a muscle the region plates could not see is left at depth 0.
 */
const DEPTH: Record<string, number> = {
  // --- shoulder: deltoid and the big sheets, then the cuff under them, then
  // subscapularis, which is under the scapula as well.
  'infraspinatus': 1, 'supraspinatus': 1, 'teres-major': 1, 'teres-minor': 1,
  'rhomboid-major': 1, 'rhomboid-minor': 1, 'levator-scapulae': 1,
  'pectoralis-minor': 1, 'coracobrachialis': 1,
  'subscapularis': 2,

  // --- arm
  'brachialis': 1,

  // --- forearm and hand: the outcropping group, then the deep group under it,
  // then the intrinsics, then the interossei between the metacarpals.
  'extensor-carpi-radialis-brevis': 1, 'extensor-digiti-minimi': 1,
  'flexor-digitorum-superficialis': 1, 'abductor-pollicis-longus': 1,
  'extensor-pollicis-brevis': 1, 'extensor-pollicis-longus': 1,
  'abductor-pollicis-brevis': 1, 'abductor-digiti-minimi-hand': 1,
  'flexor-pollicis-brevis': 1, 'flexor-digiti-minimi-brevis-hand': 1,
  'supinator': 2, 'flexor-digitorum-profundus': 2, 'flexor-pollicis-longus': 2,
  'pronator-quadratus': 2, 'extensor-indicis': 2, 'opponens-pollicis': 2,
  'opponens-digiti-minimi-hand': 2, 'adductor-pollicis': 2, 'lumbricals-hand': 2,
  'palmar-interossei': 3, 'dorsal-interossei-hand': 3,

  // --- hip: gluteus maximus and the adductor front, then medius and the
  // iliopsoas, then minimus and the short external rotators under both.
  'gluteus-medius': 1, 'adductor-brevis': 1, 'iliacus': 1,
  // Psoas major is the posterior abdominal wall, behind rectus abdominis and
  // the obliques — at their depth it came back on 10 angles of 12 but never
  // above 0.75% of its frame, still drawn under the belly wall.
  'psoas-major': 2,
  'gluteus-minimus': 2, 'piriformis': 2, 'obturator-internus': 2,
  'obturator-externus': 2, 'gemelli': 2, 'quadratus-femoris': 2,
  'adductor-magnus': 2,

  // --- knee
  'semimembranosus': 1,
  'vastus-intermedius': 2, 'popliteus': 2,

  // --- leg and foot. The sole is the classic four layers; the dorsum's two
  // short extensors sit under the long tendons.
  'soleus': 1, 'plantaris': 1, 'peroneus-brevis': 1, 'peroneus-tertius': 1,
  'extensor-hallucis-longus': 1, 'extensor-digitorum-brevis': 1,
  'extensor-hallucis-brevis': 1,
  'abductor-hallucis': 1, 'flexor-digitorum-brevis': 1, 'abductor-digiti-minimi-foot': 1,
  'tibialis-posterior': 2, 'flexor-digitorum-longus': 2, 'flexor-hallucis-longus': 2,
  'quadratus-plantae': 2, 'lumbricals-foot': 2,
  'flexor-hallucis-brevis': 3, 'adductor-hallucis': 3,
  'flexor-digiti-minimi-brevis-foot': 3, 'opponens-digiti-minimi-foot': 3,
  'plantar-interossei': 4, 'dorsal-interossei-foot': 4,

  // --- back: splenius under trapezius, erector spinae under splenius,
  // transversospinalis under erector spinae, and the segmental pair deepest.
  'splenius-capitis': 1, 'splenius-cervicis': 1, 'external-intercostals': 1,
  'iliocostalis': 2, 'longissimus': 2, 'spinalis': 2,
  'internal-intercostals': 2, 'longus-capitis': 2, 'longus-colli': 2,
  'semispinalis': 3, 'multifidus': 3, 'rotatores': 3,
  // Both lie behind the erector spinae and the transversus, not beside them:
  // level with those they measured 0.34% and 1.38% of their own frames.
  'diaphragm': 3,
  'interspinales': 4, 'intertransversarii': 4,

  // --- neck
  'scalene-anterior': 1, 'scalene-middle': 1, 'scalene-posterior': 1,

  // --- abdominal wall, outside in. Rectus abdominis is at 1 because the
  // external oblique's aponeurosis is drawn over it, which is what the owner
  // saw: "rectus abdominis still has a very small highlighted area".
  'internal-oblique': 1, 'rectus-abdominis': 1,
  'transversus-abdominis': 2, 'quadratus-lumborum': 3,
};

/**
 * SHEETS THAT WRAP A MUSCLE RATHER THAN LIE OVER IT, cut away on that muscle's
 * plate only.
 *
 * Depth cannot express these. Z-Anatomy models the internal oblique together
 * with its aponeurosis, and the aponeurosis IS the front of the rectus sheath:
 * rectus abdominis is inside the internal oblique's tendon, not deeper than
 * the muscle. At the same depth the sheath is drawn over it, and the owner saw
 * the result — "why is rectus abdominis still so covered" — cyan only above the
 * costal margin, where the sheath stops. An atlas draws rectus with the
 * anterior sheath opened, and so does this. The transversus goes with it: its
 * aponeurosis joins the anterior sheath below the arcuate line.
 */
const CUTAWAY: Record<string, string[]> = {
  'rectus-abdominis': ['internal-oblique', 'transversus-abdominis'],
  // The same sheet, one layer down: the transversus is modelled with its
  // aponeurosis spread across the whole front of the abdomen, so at psoas's
  // depth it still covered everything above the inguinal ligament.
  'psoas-major': ['transversus-abdominis'],
};

/**
 * The measured cross-check. deep-muscles.mapping.json is exactly the muscles
 * that ended up with no locate hotspot on the region plates — the measured
 * answer to "invisible under the layer in front of it" — so any muscle in it
 * that the table above leaves in the top layer is a mistake in the table.
 */
const MEASURED_DEEP = new Set<string>(
  (JSON.parse(readFileSync(`${ROOT}/deep-muscles.mapping.json`, 'utf8')).mapping as Mapped[]).map(
    (m) => m.id,
  ),
);

/**
 * The least frame that says where you are, per area, in metres.
 *
 * A muscle is framed at 1.45x its own span with this as the floor, and no
 * ceiling: a muscle IS the length of its segment, so unlike a ligament there
 * is nothing to clamp — rectus femoris at its own span is a thigh, which is
 * the right picture. The floor is what stops opponens pollicis being rendered
 * as 20mm of thenar eminence with no hand around it, and it is the 150mm
 * minimum the landmark panels settled on for the same reason (memory:
 * landmark panel framing).
 */
const MIN_FRAME: Record<SubRegion, number> = {
  'wrist-hand': 0.17,
  'ankle-foot': 0.19,
  elbow: 0.17,
  shoulder: 0.2,
  knee: 0.2,
  hip: 0.26,
  spine: 0.22,
  torso: 0.26,
  neck: 0.18,
};

/** Every thirty degrees, the turntable the joints and sub-region plates use. */
const ANGLES = Array.from({ length: 12 }, (_, i) => i * 30);

const muscles = ALL_STRUCTURES.filter(isMuscle);
const byId = new Map(muscles.map((m) => [m.id, m] as const));

/**
 * Which side a set of Blender objects is framed on.
 *
 * FRAMED ON ONE SIDE, BOTH SIDES HIGHLIGHTED. A bilateral muscle exists twice,
 * and the union of the two frames the whole torso between them — the failure
 * renderMusclePanels.py records as "their union frames the torso". So the
 * camera is framed on the left copy, and the right copy is carried as a twin:
 * drawn and highlighted only where it genuinely falls in shot, which is the
 * rule the user set for joints ("IF A JOINT IS ON BOTH SIDES THEN BOTH SIDES
 * NEED HIGHLIGHTING") and the ligament plates already follow.
 */
function split(objects: string[]): { objects: string[]; twins: string[]; side: string | null } {
  const left = objects.filter((n) => n.endsWith('.l'));
  const right = objects.filter((n) => n.endsWith('.r'));
  if (left.length === 0 || right.length === 0) return { objects, twins: [], side: null };
  // A part with no side belongs to whichever copy is framed, not to neither:
  // dropping it would quietly leave a belly out of the muscle being asked
  // about. Nothing in the dataset has one today; this is so nothing can.
  const midline = objects.filter((n) => !n.endsWith('.l') && !n.endsWith('.r'));
  return { objects: [...left, ...midline], twins: right, side: '.l' };
}

interface Entry {
  key: string;
  name: string;
  region: string;
  subregion: SubRegion;
  objects: string[];
  twins: string[];
  side: string | null;
  /** 0 is the layer you see first; a plate draws this depth and everything deeper. */
  layer: number;
  /** Muscles not drawn on this plate whatever their depth: a sheath around it. */
  hide?: string[];
  minFrame: number;
  angles: number[];
}

const entries: Entry[] = [];
const skipped: string[] = [];

for (const m of mapping) {
  const structure = byId.get(m.id);
  const objects = m.blenderObjects ?? [];
  const layer = DEPTH[m.id] ?? 0;

  if (!structure) {
    skipped.push(`${m.id}: not in the seed`);
    continue;
  }
  if (objects.length === 0) {
    skipped.push(`${m.id}: no Blender objects`);
    continue;
  }
  const subregion = structure.subregion;
  if (!subregion) {
    skipped.push(`${m.id}: no subregion, cannot place the image in an Area`);
    continue;
  }

  entries.push({
    key: m.id,
    name: structure.name,
    region: structure.region,
    subregion,
    ...split(objects),
    layer,
    ...(CUTAWAY[m.id] ? { hide: CUTAWAY[m.id] } : {}),
    minFrame: MIN_FRAME[subregion],
    angles: ANGLES,
  });
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      note:
        'Twelve angles each, framed on the left side at 1.45x the muscle’s span with a per-area ' +
        'floor. `layer` 1 is a deep muscle: the renderer draws no layer-0 muscle in front of it, and ' +
        'a muscle object the atlas has but this list does not is treated as layer 0. Written by ' +
        'src/scripts/generateMusclePlateSpec.ts.',
      muscles: entries,
    },
    null,
    1,
  )}\n`,
);

const tally = new Map<string, { n: number; deep: number }>();
for (const e of entries) {
  const row = tally.get(e.subregion) ?? { n: 0, deep: 0 };
  row.n++;
  if (e.layer >= 1) row.deep++;
  tally.set(e.subregion, row);
}

console.log(`${entries.length} muscle(s), ${entries.length * ANGLES.length} frames -> muscle-plates.spec.json`);
console.log(
  `${entries.reduce((n, e) => n + e.objects.length + e.twins.length, 0)} muscle object(s), ` +
    `${entries.filter((e) => e.layer === 1).length} deep`,
);
for (const [sub, row] of [...tally.entries()].sort()) {
  console.log(
    `  ${sub.padEnd(12)} ${String(row.n).padStart(3)} muscle(s)  ${String(row.deep).padStart(2)} deep  ` +
      `floor ${(MIN_FRAME[sub as SubRegion] * 1000).toFixed(0)}mm`,
  );
}
// The cross-check: a muscle the region plates could not see at all must not be
// left in the layer you see first.
const missed = entries.filter((e) => MEASURED_DEEP.has(e.key) && e.layer === 0);
if (missed.length > 0) {
  console.error(`
${missed.length} muscle(s) with no hotspot on the region plates are still at depth 0:`);
  for (const e of missed) console.error(`  ${e.key}`);
  process.exit(1);
}
const unknown = [...Object.keys(DEPTH), ...Object.keys(CUTAWAY), ...Object.values(CUTAWAY).flat()]
  .filter((id) => !entries.some((e) => e.key === id));
if (unknown.length > 0) {
  console.error(`
DEPTH or CUTAWAY names ${unknown.length} muscle(s) the dataset does not have: ${unknown.join(', ')}`);
  process.exit(1);
}
const byDepth = new Map<number, number>();
for (const e of entries) byDepth.set(e.layer, (byDepth.get(e.layer) ?? 0) + 1);
console.log(
  'depth ' + [...byDepth.entries()].sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d}: ${n}`).join('  '),
);
const bilateral = entries.filter((e) => e.twins.length > 0).length;
console.log(`${bilateral} bilateral (framed left, twin highlighted where in shot)`);
if (skipped.length > 0) {
  console.error(`\n${skipped.length} skipped:`);
  for (const s of skipped) console.error(`  ${s}`);
}
