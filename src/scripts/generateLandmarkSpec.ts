import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_STRUCTURES, ALL_IMAGES } from '../features/anatomy-revision/data/seed';

/**
 * Builds the input renderLandmarkMarkers.py reads: for each landmark, its
 * parent bone, the anchor that marks it, and how big it really is.
 *
 *   npx tsx src/scripts/generateLandmarkSpec.ts --out landmark-markers.spec.json
 *
 * WHY SIZE IS IN THE SPEC. The target a student aims at is the landmark's own
 * size, and the camera has to be close enough for that to be worth aiming at:
 * a 7mm spine on a whole hip bone is smaller than a fingertip on a phone. The
 * renderer works out the frame from the radius here, so a small landmark is
 * looked at more closely rather than given an unfairly generous target.
 *
 * SIZES ARE BY CLASS, AND THEY ARE THE PART TO ARGUE WITH. Z-Anatomy models a
 * landmark as a point, so there is nothing to measure — a tubercle and a
 * trochanter are both one anchor. The radii below are typical adult dimensions
 * for each kind of feature, matched on the name. They are a starting point for
 * an anatomist to correct, not a measurement.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Radius in metres, matched against the landmark's name, first hit wins. */
const SIZE_CLASSES: [RegExp, number, string][] = [
  [/\btrochanter\b/i, 0.020, 'a broad prominence'],
  [/\b(crest|ala|fossa|arch|border|margin|surface|plateau|shaft|body)\b/i, 0.018, 'a broad area or edge'],
  [/\b(acromion|olecranon|malleolus|condyle|head|base|angle)\b/i, 0.014, 'a large process or end'],
  [/\b(tuberosity|tubercle|epicondyle|process|protuberance|eminence)\b/i, 0.010, 'a discrete prominence'],
  [/\b(spine|line|ridge|groove|sulcus|notch|neck|cornu|cornua|hiatus)\b/i, 0.008, 'a narrow feature'],
  [/\b(foramen|foramina|facet|canal|tubercle of|styloid|dens|pedicle|lamina)\b/i, 0.006, 'a small feature'],
];
const DEFAULT_RADIUS = 0.010;

/**
 * Landmarks whose anchor Z-Anatomy names differently from us. Without these the
 * name match misses and the landmark falls back to highlighting its whole bone.
 */
const ANCHOR_ALIASES: Record<string, string[]> = {
  'spinous-process': ['Spinous process.j'],
  'transverse-process': ['Transverse process.j'],
  'vertebral-foramen': ['Vertebral foramen.j'],
  'intervertebral-foramen': ['Intervertebral foramen.j'],
  'sacral-promontory': ['Promontory.j'],
  'dens-odontoid-process': ['Dens axis.j'],
  'manubrium': ['Manubrium of sternum.j'],
  'jugular-notch': ['Jugular notch of occipital bone.j'],
  'costal-margin': ['Costal arch.j'],
  'coccygeal-cornua': ['Coccygeal horn.j'],
  'lamina': ['Lamina of vertebral arch.j'],
  'pedicle': ['Pedicle of vertebral arch.j'],
  'pars-interarticularis': ['Pars interarticularis of vertebral arch.j'],
  'superior-articular-process': ['Superior articular process of vertebra.j'],
  'inferior-articular-process': ['Inferior articular process of vertebra.j'],
  'auricular-surface': ['Auricular surface of ilium.j'],
  // Named exactly as we name them; the earlier miss was the PARENT, not the
  // anchor — each of these hangs off a grouped bone (carpals, tarsals) whose
  // nearest point is on some other bone of the group.
  'hook-of-hamate': ['Hook of hamate bone.j'],
  'scaphoid-tubercle': ['Tubercle of scaphoid bone.j'],
  'calcaneal-tuberosity': ['Calcaneal tuberosity.j'],
  'navicular-tuberosity': ['Tuberosity of navicular bone.j'],
  'sacral-hiatus': ['Sacral hiatus.j'],
  'sacral-cornua': ['Sacral horn.j'],
  'xiphoid-process': ['Xiphoid process.j'],
  'anterior-arch-atlas': ['Anterior arch of atlas.j'],
  'posterior-arch-atlas': ['Posterior arch of atlas.j'],
  'lateral-mass-atlas': ['Lateral mass.j'],
  'superior-costal-facet': ['Superior costal facet.j'],
  'inferior-costal-facet': ['Inferior costal facet.j'],
  'transverse-costal-facet': ['Transverse costal facet.j'],
  // Z-Anatomy names one anchor for a row, not one per digit. Pointed at a
  // specific bone below, the snap guard decides whether it is close enough to
  // be that digit's; if not it is rejected rather than drawn on the wrong one.
  'base-of-first-metacarpal': ['Metacarpal base.j'],
  'head-of-first-metacarpal': ['Head of metacarpal bone.j'],
  'base-of-fifth-metatarsal': ['Base of metatarsal bone.j'],
  'head-of-first-metatarsal': ['Head of metatarsal bone.j'],
};

/**
 * Parents given as Z-Anatomy meshes rather than structure ids, for landmarks
 * whose bone the seed has no separate entry for: an individual metacarpal, a
 * single thoracic vertebra. Without these the parent is a whole grouped bone
 * and the landmark snaps to whichever member happens to be nearest.
 */
const PARENT_MESH_OVERRIDE: Record<string, string[]> = {
  'base-of-first-metacarpal': ['First metacarpal bone.l', 'First metacarpal bone.r'],
  'head-of-first-metacarpal': ['First metacarpal bone.l', 'First metacarpal bone.r'],
  'base-of-fifth-metatarsal': ['Fifth metatarsal bone.l', 'Fifth metatarsal bone.r'],
  'head-of-first-metatarsal': ['First metatarsal bone.l', 'First metatarsal bone.r'],
  // A costal facet exists on every thoracic vertebra; T6 stands for them, the
  // way L4 stands for the lumbar features.
  'superior-costal-facet': ['Vertebra T6'],
  'inferior-costal-facet': ['Vertebra T6'],
  'transverse-costal-facet': ['Vertebra T6'],
  'bifid-spinous-process': ['Vertebra C4'],
};

/**
 * Landmarks that exist at every spinal level. Their parentBoneId names the
 * generic group, which has no single mesh, so the render needs one level
 * chosen — L4, the same level the facet and intervertebral joints use, so a
 * student meets the same vertebra throughout.
 *
 * This is a rendering choice, not a content one: the seed still says a pedicle
 * belongs to a vertebra, which is what a student should be told.
 */
const PARENT_OVERRIDE: Record<string, string> = {
  'vertebral-body': 'l4-vertebra',
  'vertebral-foramen': 'l4-vertebra',
  'spinous-process': 'l4-vertebra',
  'transverse-process': 'l4-vertebra',
  'pedicle': 'l4-vertebra',
  'lamina': 'l4-vertebra',
  'superior-articular-process': 'l4-vertebra',
  'inferior-articular-process': 'l4-vertebra',
  'intervertebral-foramen': 'l4-vertebra',
  // These hang off a grouped bone whose nearest point is on a different member.
  'hook-of-hamate': 'hamate',
  'scaphoid-tubercle': 'scaphoid',
  'calcaneal-tuberosity': 'calcaneus',
  'navicular-tuberosity': 'navicular',
};

/**
 * Not landmarks this pipeline can honestly draw. The anatomical snuffbox is a
 * hollow bounded by tendons, not a point on a bone; the ankle mortise is a
 * joint space, already drawn as talocrural-joint. Marking either with a point
 * on a bone would teach something false.
 */
const EXCLUDE = new Set(['anatomical-snuffbox', 'ankle-mortise']);

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const outPath = args.out ?? 'landmark-markers.spec.json';

/**
 * Landmarks already in the spec are kept, and a re-run may only add.
 *
 * The filter below is "landmarks whose only image is an AI slide", which is how
 * the set was found in the first place — but once a landmark has been rendered
 * it has a real image and stops matching. A naive re-run would emit only the
 * stragglers, and publishLandmarks reads this file for every landmark's name
 * and region, so everything already published would be dropped on the next
 * publish. Same trap the sub-region plates fell into.
 */
const existing = new Map<string, any>();
if (existsSync(outPath) && args.rebuild !== 'true') {
  for (const l of JSON.parse(readFileSync(outPath, 'utf8')).landmarks ?? []) existing.set(l.id, l);
}

const skel = JSON.parse(readFileSync(`${ROOT}/ta2-mapping-skeletal.resolved.json`, 'utf8'));
const z = JSON.parse(readFileSync(`${ROOT}/src/scripts/data/zAnatomyObjects.json`, 'utf8'));
const mapping = new Map<string, any>(skel.mapping.map((m: any) => [m.id, m]));
const byImage = new Map(ALL_IMAGES.map((i) => [i.id, i]));
const isAI = (i: any) => /AI/i.test(JSON.stringify(i.credit ?? ''));
const norm = (s: string) =>
  s.toLowerCase().replace(/\.[a-z]{1,2}$/, '').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const jAnchors: string[] = z.objects.filter((o: string) => o.trim().endsWith('.j')).map((o: string) => o.trim());

function radiusFor(name: string): [number, string] {
  for (const [re, r, why] of SIZE_CLASSES) if (re.test(name)) return [r, why];
  return [DEFAULT_RADIUS, 'unclassified'];
}

const landmarks: unknown[] = [];
const fallback: string[] = [];
const noParent: string[] = [];

for (const s of ALL_STRUCTURES as any[]) {
  if (s.category !== 'landmark') continue;
  const imgs = (s.imageIds ?? []).map((id: string) => byImage.get(id)).filter(Boolean) as any[];
  // Only the ones whose sole image is an AI slide need replacing.
  if (!(imgs.length > 0 && imgs.every(isAI))) continue;

  if (EXCLUDE.has(s.id)) continue;

  const parentId = PARENT_OVERRIDE[s.id] ?? s.parentBoneId;
  const parentObjects =
    PARENT_MESH_OVERRIDE[s.id] ?? (parentId ? (mapping.get(parentId)?.blenderObjects ?? []) : []);
  if (parentObjects.length === 0) {
    noParent.push(s.id);
    continue;
  }

  const listed = (mapping.get(s.id)?.anchorObjects ?? []).filter((o: string) => o.endsWith('.j'));
  const names = [s.name, ...(s.aliases ?? [])].map(norm);
  const guessed = jAnchors.filter((o) => names.includes(norm(o)));
  const anchors = [...new Set([...(ANCHOR_ALIASES[s.id] ?? []), ...listed, ...guessed])];

  if (anchors.length === 0) {
    // No anchor: nothing to point at, so the whole parent bone is the answer.
    // That is the agreed fallback, and it is a different render — recorded here
    // so the count is honest rather than silently dropped.
    fallback.push(s.id);
    continue;
  }

  const [radius, why] = radiusFor(s.name);
  landmarks.push({
    id: s.id,
    name: s.name,
    // Carried through so publishLandmarks can file the image in the right Area
    // without importing the seed, which imports the module it writes.
    region: s.region,
    subregion: s.subregion,
    parent: parentId,
    parentObjects,
    anchors,
    radius,
    sizeNote: why,
  });
}

const seen = new Set(landmarks.map((l: any) => l.id));
for (const [id, prev] of existing) if (!seen.has(id)) landmarks.push(prev);
landmarks.sort((a: any, b: any) => a.id.localeCompare(b.id));

writeFileSync(
  outPath,
  JSON.stringify({ schemaVersion: 1, generated: new Date().toISOString(), landmarks }, null, 1),
);

console.log(`${landmarks.length} landmark(s) -> ${outPath}`);
if (fallback.length) console.log(`\n${fallback.length} need the whole-bone fallback (no anchor):\n  ${fallback.join(', ')}`);
if (noParent.length) console.log(`\n${noParent.length} have no parent bone with meshes:\n  ${noParent.join(', ')}`);
