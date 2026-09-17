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

/**
 * Which plate a structure belongs on, where its subregion gets it wrong.
 *
 * A PLATE'S CAMERA IS SET BY THE LARGEST SUBJECT ON IT, so one long muscle sets
 * the scale for everything else. Extensor digitorum runs from the lateral
 * epicondyle to four fingertips: put it on the hand plate and the hand plate
 * becomes a forearm plate, and the carpals it was built for go back to being
 * specks. That is the same failure this whole family exists to fix, arriving
 * from the other direction.
 *
 * The subregion cannot make the split, and should not be changed to: it groups
 * a structure by the joint it acts on, which is why every forearm muscle is
 * filed under wrist-hand. That is right for revision — a student picking
 * "Wrist & Hand" wants extensor digitorum — and wrong for framing. So the plate
 * key gains a third segment, its own slug, and the subregion stays as authored.
 *
 * Membership is by SPAN, not by name: a structure belongs on the closer plate
 * if it fits inside it. Everything here crosses the wrist or the ankle.
 */
const PLATE_OVERRIDE: Record<string, string> = {
  // Forearm: origin at or above the elbow, insertion in the hand.
  'abductor-pollicis-longus': 'forearm-hand__wrist-hand__forearm',
  'extensor-carpi-radialis-brevis': 'forearm-hand__wrist-hand__forearm',
  'extensor-digiti-minimi': 'forearm-hand__wrist-hand__forearm',
  'extensor-digitorum': 'forearm-hand__wrist-hand__forearm',
  'extensor-indicis': 'forearm-hand__wrist-hand__forearm',
  'extensor-pollicis-brevis': 'forearm-hand__wrist-hand__forearm',
  'extensor-pollicis-longus': 'forearm-hand__wrist-hand__forearm',
  'flexor-digitorum-superficialis': 'forearm-hand__wrist-hand__forearm',
  'flexor-pollicis-longus': 'forearm-hand__wrist-hand__forearm',
  // Pronator quadratus does not cross the wrist, but it is radius-to-ulna and
  // belongs with the forearm rather than inside a plate framed on the carpus.
  'pronator-quadratus': 'forearm-hand__wrist-hand__forearm',

  // Leg: origin at or below the knee, insertion in the foot.
  'extensor-hallucis-longus': 'lower-leg-foot__ankle-foot__leg',
  'flexor-digitorum-longus': 'lower-leg-foot__ankle-foot__leg',
  'peroneus-tertius': 'lower-leg-foot__ankle-foot__leg',

  // Not a scale split but a wrong shelf: the intercostals are filed under the
  // spine and live on the rib cage, which is what the torso plate already
  // frames. Sending them to the spine plate would widen it to the whole thorax.
  'internal-intercostals': 'back-core__torso',

  // A LAYER, NOT A SCALE. Moving the camera cannot reach a muscle that another
  // muscle is in front of: extensor indicis stayed at 2.7px on the forearm plate
  // because extensor digitorum lies over it, and adding flexor pollicis brevis
  // to the hand plate correctly buried opponens pollicis and the palmar
  // interossei under it. The answer is the one the region plates already use —
  // draw the deep layer with the superficial layer simply absent, so nothing is
  // in front of it because nothing in front of it is rendered.
  //
  // Membership is not a judgement call: deep-muscles.mapping.json is the list of
  // muscles the region plates could not give a hotspot to, measured rather than
  // classified. Its eight forearm-and-hand muscles are split here by span, the
  // same way the superficial ones were — three cross the forearm, five sit
  // inside the hand.
  'extensor-indicis': 'forearm-hand__wrist-hand__forearm-deep',
  'flexor-digitorum-profundus': 'forearm-hand__wrist-hand__forearm-deep',
  supinator: 'forearm-hand__wrist-hand__forearm-deep',
  'opponens-pollicis': 'forearm-hand__wrist-hand__hand-deep',
  'opponens-digiti-minimi-hand': 'forearm-hand__wrist-hand__hand-deep',
  'palmar-interossei': 'forearm-hand__wrist-hand__hand-deep',
  'lumbricals-hand': 'forearm-hand__wrist-hand__hand-deep',
  'flexor-digiti-minimi-brevis-hand': 'forearm-hand__wrist-hand__hand-deep',

  // A SCALE SPLIT RUNNING THE OTHER WAY. The forearm and the leg came off their
  // subregion because they were too long for it. The forefoot comes off because
  // it is too short: a foot plate is framed heel to toe, and the middle phalanx
  // of a toe is a third of a toe, which is a tenth of that. The plantar
  // interossei have the same problem from the same cause — they lie between the
  // metatarsal shafts, so they are drawn at metatarsal scale on a plate framed
  // for a calcaneus.
  //
  // The other four are not strays; they are what makes it a plate. A picture
  // offering two questions is a diagram, and a student looking at a forefoot
  // should be asked for the metatarsals and the dorsal interossei from it too.
  'phalanges-middle-foot': 'lower-leg-foot__ankle-foot__forefoot',
  'plantar-interossei': 'lower-leg-foot__ankle-foot__forefoot',
  'phalanges-proximal-foot': 'lower-leg-foot__ankle-foot__forefoot',
  'phalanges-distal-foot': 'lower-leg-foot__ankle-foot__forefoot',
  metatarsals: 'lower-leg-foot__ankle-foot__forefoot',
  'dorsal-interossei-foot': 'lower-leg-foot__ankle-foot__forefoot',

  // THE SAME SPLIT, AND A SECOND PROBLEM UNDER IT. "Intervertebral disc" is one
  // structure made of forty-seven meshes, C2 to the sacrum. Every spine plate
  // that carries it is framed on the whole column, so each disc is a line
  // between two blocks — but framing tighter cannot help while the framing box
  // is the structure's own geometry, because that box IS the whole column. The
  // plate frames on two named vertebrae instead; see PLATE_FRAME_ON.
  'intervertebral-disc': 'back-core__spine__lumbar',
  'l4-vertebra': 'back-core__spine__lumbar',
  'l5-vertebra': 'back-core__spine__lumbar',

  // BURIED, NOT SMALL — the other half of the problem, and the half a camera
  // cannot solve. These had no traced outline on ANY view of any plate, because
  // something drawn in front of them took every pixel. Quadratus plantae is
  // under flexor digitorum brevis across the whole sole; interspinales are under
  // multifidus along the whole spine. Moving the camera closer magnifies the
  // muscle in front of them just as faithfully.
  //
  // A DEEP PLATE IS NOT A DIFFERENT RENDERER. A sub-region plate draws its
  // SUBJECTS and nothing else in flesh — the backdrop is bare skeleton — so a
  // plate simply leaving the superficial layer off its subject list is a plate
  // with the superficial layer absent. The forearm and the hand already work
  // this way; the sole is the same shape of problem.
  //
  // Layer 1 of the sole (flexor digitorum brevis, abductor hallucis, abductor
  // digiti minimi) is the layer left off. Quadratus plantae and the lumbricals
  // are layer 2, adductor hallucis and opponens digiti minimi layer 3, and they
  // sit beside one another rather than over one another: the heel, the middle of
  // the sole, and the fifth metatarsal.
  'quadratus-plantae': 'lower-leg-foot__ankle-foot__foot-deep',
  'opponens-digiti-minimi-foot': 'lower-leg-foot__ankle-foot__foot-deep',
  'lumbricals-foot': 'lower-leg-foot__ankle-foot__foot-deep',
  'adductor-hallucis': 'lower-leg-foot__ankle-foot__foot-deep',

  // Interspinales need both fixes at once: multifidus off the subject list, and
  // the lumbar frame. They run the length of the column in six pieces, so like
  // the disc they cannot frame themselves — the L4–L5 plate already frames two
  // vertebrae, and the interspinalis between those two spinous processes is the
  // one worth asking about.
  interspinales: 'back-core__spine__lumbar',

  // PURE SCALE, in the one place left with none. Longus colli and longus capitis
  // are on the FRONTS of the cervical vertebral bodies, so nothing is in front of
  // them at all — they measured 1,693px and 471px only because the spine plate is
  // framed from the atlas to the coccyx. The coccyx is the same story at the other
  // end of that plate, and so is the sacrum it hangs off.
  'longus-colli': 'back-core__spine__cervical',
  'longus-capitis': 'back-core__spine__cervical',
  'cervical-vertebrae': 'back-core__spine__cervical',
  'atlas-c1': 'back-core__spine__cervical',
  'c7-vertebra': 'back-core__spine__cervical',
  coccyx: 'back-core__spine__sacrum',
  sacrum: 'back-core__spine__sacrum',
};

/**
 * Plates that override how much skeleton stands behind them.
 *
 * The renderer infers it: a plate split off for scale whose subjects carry a
 * side is a limb, and a limb plate drops the other side and the axial skeleton
 * with it. That inference is right for a forearm and wrong for every plate of
 * the trunk, because THE MUSCLES OF THE MIDLINE ARE PAIRED TOO. Interspinales,
 * multifidus, the intertransversarii, longus colli, the scalenes and the
 * intercostals all carry .l and .r, so each read as a limb and was drawn on one
 * side with the vertebrae dropped out from behind it — half a muscle floating
 * against nothing. 'full' means no side is picked and the whole skeleton stays.
 */
const PLATE_BACKDROP: Record<string, 'limb' | 'full'> = {
  'back-core__spine': 'full',
  'back-core__neck': 'full',
  'back-core__torso': 'full',
  'back-core__spine__cervical': 'full',
  'back-core__spine__lumbar': 'full',
  'back-core__spine__sacrum': 'full',
};

/**
 * The only bones an appendicular plate may draw.
 *
 * "Drop the other side and the axial skeleton" sounds like it leaves a limb, and
 * it does not: RIBS AND HIP BONES ARE PAIRED. They carry .l and .r exactly as a
 * radius does, so keeping the framed side keeps the near half of the trunk, and
 * the only reason that never showed is that a fitted frame was too narrow to
 * reach it. A turntable frame cannot be — it has to hold the subject at its
 * broadest angle — so the forearm plate came back with a rib cage and a femur
 * behind the arm, which is the thing the panels were fixed for two rounds ago.
 *
 * By region rather than by plate, because the answer is the same for every plate
 * of a limb: an arm plate draws the arm.
 */
const REGION_BONES: Record<string, string[]> = {
  'forearm-hand': [
    'humerus', 'radius', 'ulna', 'carpals', 'metacarpals',
    'phalanges-proximal-hand', 'phalanges-middle-hand', 'phalanges-distal-hand',
  ],
  'lower-leg-foot': [
    'femur', 'patella', 'tibia', 'fibula', 'tarsals', 'talus', 'calcaneus', 'navicular',
    'cuboid', 'medial-cuneiform', 'intermediate-cuneiform', 'lateral-cuneiform', 'metatarsals',
    'phalanges-proximal-foot', 'phalanges-middle-foot', 'phalanges-distal-foot',
  ],
};

/**
 * Which of a plate's subjects the camera is framed on, where the plate's own
 * subjects are the wrong ruler.
 *
 * This is only needed when a structure's geometry is scattered — one id, many
 * meshes, far apart. L4 and L5 put the camera on the L4–L5 disc; the discs above
 * and below stay in shot at the edges, and that is right rather than a leak,
 * because they are the same structure and carry the same answer.
 */
const PLATE_FRAME_ON: Record<string, string[]> = {
  'back-core__spine__lumbar': ['l4-vertebra', 'l5-vertebra'],
};

/** The plate key for a structure — its own subregion unless PLATE_OVERRIDE says otherwise. */
function plateKeyFor(structure: { id: string; region: string; subregion: string }): string {
  return PLATE_OVERRIDE[structure.id] ?? `${structure.region}__${structure.subregion}`;
}


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
  // An override says where a structure belongs, and that holds whether or not it
  // happens to be answerable somewhere else — a deep plate's companions are on it
  // precisely so the buried one is not the only muscle in the picture, and they
  // all have questions of their own already. Without this the table would also
  // unbuild itself: every structure it moved is answered now, so a rebuild from
  // scratch would drop them all back to their subregion.
  if (answered.has(s.id) && !PLATE_OVERRIDE[s.id]) continue;
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
  const key = plateKeyFor(s);
  // From the KEY, not from this structure: an override can move a structure to a
  // plate that is filed elsewhere, and the plate keeps its own shelf.
  const [keyRegion, keySubregion] = key.split('__');
  const plate: Plate = plates.get(key) ?? { region: keyRegion, subregion: keySubregion, subjects: [] };
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
  .map(([key, p]) => ({
    key,
    ...p,
    // From the table, not from the file on disk: the table is the authority and
    // a spec written before it existed simply has no frameOn to preserve.
    ...(PLATE_FRAME_ON[key] ? { frameOn: PLATE_FRAME_ON[key] } : {}),
    ...(PLATE_BACKDROP[key] ? { backdrop: PLATE_BACKDROP[key] } : {}),
    ...(REGION_BONES[p.region] ? { bones: REGION_BONES[p.region].flatMap((id) => meshFor.get(id) ?? []) } : {}),
    subjects: [...p.subjects].sort((a, b) => a.id.localeCompare(b.id)),
  }))
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
