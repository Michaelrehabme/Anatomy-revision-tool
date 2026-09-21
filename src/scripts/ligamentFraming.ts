import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { isLigament } from '../features/anatomy-revision/types/structure';
import type { SubRegion } from '../features/anatomy-revision/types/region';

/**
 * Sets each ligament's camera frame and its visible skeleton, by area.
 *
 *   npx tsx src/scripts/ligamentFraming.ts --spec ligament-tranche1.spec.json
 *
 * WHY. The first tranche framed every ligament at a 110mm floor, which is
 * about the size of the joint it belongs to. That is tight enough to hide
 * everything that tells you WHERE you are: a wrist plate showed carpals and
 * straps with no thumb and no forearm in shot, and the reviewer could not
 * say which side of the wrist a ligament was on. A target you cannot orient
 * is not a question, however crisply it is traced.
 *
 * So the frame is now the size of the REGION rather than the joint — a whole
 * hand, a whole foot, the whole pelvis — and the student zooms in from there,
 * which the locate screen has supported since the rotation work. Zooming in
 * makes the hit box bigger on screen; starting wide is the only thing that
 * can make it identifiable.
 *
 * WHICH BONES GO WITH IT is the other half. An arm framed at 200mm hangs
 * beside the hip, so the femur walks into shot and the picture is confusing
 * in a new way. Naming the twenty bones of a hand to keep is shorter and far
 * more stable than naming the two hundred to drop.
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
const specPath = args.spec ?? 'ligament-tranche1.spec.json';

const CARPALS = ['Scaphoid bone.*', 'Lunate bone.*', 'Triquetrum bone.*', 'Pisiform bone.*',
  'Trapezium bone.*', 'Trapezoid bone.*', 'Capitate bone.*', 'Hamate bone.*'];
const TARSALS = ['Talus.*', 'Calcaneus.*', 'Navicular bone.*', 'Cuboid bone.*',
  'Medial cuneiform bone.*', 'Intermediate cuneiform bone.*', 'Lateral cuneiform bone.*'];

/**
 * Frame size in metres, and the bones worth showing at it.
 *
 * `frame` is the CEILING — the real size of the part: a hand is about 190mm
 * from wrist to fingertip, a foot 250mm, a pelvis 280mm across. `minFrame`
 * is the FLOOR, the least that still shows where you are. The renderer frames
 * each ligament at 2.6x its own span, clamped between the two, so a long
 * interosseous membrane still gets the whole forearm while an 11mm
 * acromioclavicular ligament is no longer a sliver on a 240mm shoulder. Both
 * are needed: the first tranche framed at 110mm could not be oriented, and
 * framing every ligament at the ceiling made the small ones unfindable.
 *
 * `keep` names Blender objects, and a pattern that names nothing drops
 * those bones with no error — "Sternum*" matched nothing, because the atlas
 * calls them "Manubrium of sternum" and "Body of sternum", so the shoulder
 * plates had no sternal body. renderLigamentPlates.py now warns about a
 * pattern that matches no bone. No area keeps the whole skeleton any more:
 * a hip plate with the arms, ribs and far femur in it was the "surrounding
 * bones don't render properly" complaint seen from the other side.
 */
const STERNUM = ['*of sternum', 'Xiphoid process'];
/**
 * The skull, bone by bone. The spine list kept only the occipital bone, so the
 * nuchal ligament's plate showed a floating occiput with the rest of the head
 * missing and the straps that attach to it hanging in space. Whole-bone names
 * only: the atlas's ".j" objects are labels for parts of a bone.
 */
const SKULL = ['Frontal bone', 'Occipital bone', 'Parietal bone*', 'Temporal bone*', 'Sphenoid bone', 'Ethmoid bone',
  'Mandible', 'Maxilla.*', 'Zygomatic bone*', 'Nasal bone.*', 'Lacrimal bone.*', 'Palatine bone*', 'Vomer',
  'Inferior nasal concha bone.*', 'Hyoid bone'];
const BY_AREA: Record<SubRegion, { minFrame: number; frame: number; keep: string[] }> = {
  'wrist-hand': {
    minFrame: 0.12,
    frame: 0.20,
    keep: ['Radius.*', 'Ulna.*', 'Humerus.*', ...CARPALS, '*metacarpal bone*', '*finger of hand*', 'Sesamoid bones of hand.*'],
  },
  'ankle-foot': {
    minFrame: 0.14,
    frame: 0.24,
    keep: ['Tibia.*', 'Fibula.*', ...TARSALS, '*metatarsal bone*', '*finger of foot*', 'Sesamoid bones of foot.*'],
  },
  elbow: { minFrame: 0.12, frame: 0.20, keep: ['Humerus.*', 'Radius.*', 'Ulna.*', 'Scapula.*'] },
  shoulder: {
    minFrame: 0.16,
    frame: 0.24,
    keep: ['Scapula.*', 'Clavicle.*', 'Humerus.*', ...STERNUM, '*rib*', 'Vertebra T*', 'Vertebra C7'],
  },
  knee: { minFrame: 0.14, frame: 0.20, keep: ['Femur.*', 'Tibia.*', 'Fibula.*', 'Patella.*'] },
  // The pelvis reads best whole, femurs included — they are what makes it a
  // hip rather than an abstract ring. The lumbar spine above it orients it.
  hip: { minFrame: 0.20, frame: 0.30, keep: ['Hip bone.*', 'Sacrum', 'Coccyx', 'Femur.*', 'Vertebra L*'] },
  // The atlas and axis are "Atlas (C1)" and "Axis (C2)" in the model, not
  // "Vertebra C1/C2", so 'Vertebra *' dropped the top of the neck.
  spine: { minFrame: 0.14, frame: 0.26, keep: ['Atlas (C1)', 'Axis (C2)', 'Vertebra *', 'Sacrum', 'Coccyx', ...SKULL, '*rib*'] },
  torso: {
    minFrame: 0.20,
    frame: 0.30,
    keep: ['*rib*', ...STERNUM, 'Vertebra T*', 'Vertebra C7', 'Vertebra L1', 'Clavicle.*', 'Scapula.*'],
  },
  neck: { minFrame: 0.14, frame: 0.22, keep: ['Atlas (C1)', 'Axis (C2)', 'Vertebra C*', 'Vertebra T1', 'Vertebra T2', ...SKULL, 'Clavicle.*', ...STERNUM] },
};

/**
 * TILTED VIEWS FOR THE FOOT. A foot's ligaments are read from above and below
 * as much as from the side — the plantar ligaments are only ever seen from
 * underneath — so every ankle-and-foot ligament also gets four frames on the
 * other axis: tilted up 45 degrees and straight down onto the dorsum (turned
 * from the posterior view, so the toes point up the picture), tilted down 45
 * degrees and straight up at the sole (turned from the anterior view, toes up
 * again). Each is [azimuth, elevation]. The publisher keeps the ones that trace.
 */
const FOOT_TILTS: [number, number][] = [[180, 45], [180, 90], [0, -45], [0, -90]];

/**
 * Ligaments whose area frame cannot show what they connect. The interosseous
 * membranes run the whole length of the forearm and the leg, and a membrane is
 * only legible with the joint at each end in shot: the elbow and the wrist,
 * the knee and the ankle. Their frame is fixed at the length of the segment,
 * and the bones of the far joint are added to the area's list.
 */
const OVERRIDES: Record<string, { frame?: number; keepExtra?: string[]; targetThickness?: number }> = {
  'interosseous-membrane-of-forearm': { frame: 0.36, keepExtra: [...CARPALS, '*metacarpal bone*', '*finger of hand*'] },
  'interosseous-membrane-of-leg': { frame: 0.48, keepExtra: [...TARSALS, '*metatarsal bone*', '*finger of foot*'] },
  // A midline sheet seen from behind is its own edge: at the standard 0.9mm it
  // drew as a hairline down the back of the neck. Thicker only shows edge-on.
  'nuchal-ligament': { targetThickness: 0.0025 },
};

const spec = JSON.parse(readFileSync(`${ROOT}/${specPath}`, 'utf8'));
const byId = new Map(ALL_STRUCTURES.filter(isLigament).map((l) => [l.id, l]));

let changed = 0;
for (const entry of spec.ligaments as { key: string; subregion?: SubRegion; frame?: number; minFrame?: number; keep?: string[]; tilts?: [number, number][]; tiltCutaway?: string[]; targetThickness?: number }[]) {
  // A second-tranche entry is not seeded yet, so it carries its own subregion.
  const lig = byId.get(entry.key) ?? (entry.subregion ? { subregion: entry.subregion } : undefined);
  if (!lig?.subregion) {
    console.log(`  ${entry.key}: no subregion, left alone`);
    continue;
  }
  const rule = BY_AREA[lig.subregion];
  entry.frame = rule.frame;
  entry.minFrame = rule.minFrame;
  entry.keep = rule.keep;
  const override = OVERRIDES[entry.key];
  if (override?.frame) {
    entry.frame = override.frame;
    entry.minFrame = override.frame;
  }
  if (override?.keepExtra) entry.keep = [...rule.keep, ...override.keepExtra];
  if (override?.targetThickness) entry.targetThickness = override.targetThickness;
  else delete entry.targetThickness;
  if (lig.subregion === 'ankle-foot') {
    entry.tilts = FOOT_TILTS;
    // Looking down on the foot, the leg stands in the way; the upward tilts
    // draw it cut away, as an atlas's dorsal view does.
    entry.tiltCutaway = ['Tibia.*', 'Fibula.*'];
  } else {
    delete entry.tilts;
    delete entry.tiltCutaway;
  }
  changed++;
}

spec.note =
  'Eight angles each, left side. Each ligament is framed at 2.6x its span, clamped between minFrame (enough ' +
  'to orient) and frame (the size of the part); `keep` names the bones worth showing. Set by ' +
  'src/scripts/ligamentFraming.ts.';
writeFileSync(`${ROOT}/${specPath}`, JSON.stringify(spec, null, 1));

const tally = new Map<string, number>();
for (const entry of spec.ligaments as { key: string }[]) {
  const sub = byId.get(entry.key)?.subregion ?? (entry as { subregion?: SubRegion }).subregion;
  if (sub) tally.set(sub, (tally.get(sub) ?? 0) + 1);
}
console.log(`framed ${changed} of ${spec.ligaments.length} ligaments -> ${specPath}`);
for (const [sub, n] of [...tally.entries()].sort()) {
  const r = BY_AREA[sub as SubRegion];
  console.log(`  ${sub.padEnd(12)} ${String(n).padStart(2)} ligament(s)  frame ${(r.minFrame * 1000).toFixed(0)}-${(r.frame * 1000).toFixed(0)}mm  ${r.keep.length} keep patterns`);
}
