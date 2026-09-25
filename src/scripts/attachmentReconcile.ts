import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed';
import {
  isBone,
  isJoint,
  isLandmark,
  isLigament,
  isMuscle,
  reviewedAttachmentIds,
  type AnatomyStructure,
} from '../features/anatomy-revision/types/structure';

/**
 * Reconciles every bone and landmark attachment/articulation claim against the
 * sources this repo already holds, at the most precise level each can support.
 *
 *   npx tsx src/scripts/attachmentReconcile.ts --selftest
 *   npx tsx src/scripts/attachmentReconcile.ts --write attachment-reconcile.json
 *
 * SUPERSEDES boneReciprocity.ts, which matched at one level only and so
 * reported 116 claims as unsupported that its sources did in fact corroborate —
 * just not at the granularity the seed states them.
 *
 * THE MISMATCH THIS EXISTS TO FIX. The seed records an attachment against the
 * LANDMARK ("supraspinous ligament attaches along the spinous processes"). The
 * ligament dataset records the same attachment against the BONE ("supraspinous
 * ligament -> thoracic-vertebrae, lumbar-vertebrae"). Both are true and neither
 * is wrong; they describe one fact at two levels of detail. So corroboration is
 * graded, and the level is always stated rather than glossed:
 *
 *   exact  — the source names THIS landmark, or a site on THIS bone
 *   parent — the source places the structure on the bone this landmark sits on
 *   spinal — for a level-agnostic spinal feature (a lamina exists at every
 *            level and has no single parent bone), the source places it on a
 *            vertebra
 *
 * An 'exact' hit evidences the claim as written. A 'parent' or 'spinal' hit
 * evidences that the attachment EXISTS, not that it is at the named feature,
 * and the review row says so. That distinction is the whole point: rounding it
 * away would be the same error as the first screen, which accepted "deltoid
 * tuberosity of humerus" as evidence for a claim about the femur.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const muscles = ALL_STRUCTURES.filter(isMuscle);
const ligaments = ALL_STRUCTURES.filter(isLigament);
const joints = ALL_STRUCTURES.filter(isJoint);
const bones = ALL_STRUCTURES.filter(isBone);
const landmarks = ALL_STRUCTURES.filter(isLandmark);

/** Vertebral bones, for the level-agnostic spinal features. */
const VERTEBRAL = new Set([
  'cervical-vertebrae',
  'thoracic-vertebrae',
  'lumbar-vertebrae',
  'atlas-c1',
  'axis-c2',
  'c7-vertebra',
  'l4-vertebra',
  'l5-vertebra',
  'sacrum',
  'coccyx',
]);

const ORDINALS: [RegExp, string][] = [
  [/\bfirst\b/g, '1st'], [/\bsecond\b/g, '2nd'], [/\bthird\b/g, '3rd'], [/\bfourth\b/g, '4th'],
  [/\bfifth\b/g, '5th'], [/\bsixth\b/g, '6th'], [/\bseventh\b/g, '7th'], [/\beighth\b/g, '8th'],
  [/\bninth\b/g, '9th'], [/\btenth\b/g, '10th'], [/\beleventh\b/g, '11th'], [/\btwelfth\b/g, '12th'],
];

/**
 * Lowercase, unwrap parentheticals, singularise and put ordinals in one form.
 * "Fibularis (peroneus) longus" and "Twelfth Rib" were each blocking matches
 * that the sources plainly supported.
 */
function norm(text: string): string {
  let s = text.toLowerCase().replace(/\(([^)]*)\)/g, ' $1 ');
  for (const [re, to] of ORDINALS) s = s.replace(re, to);
  return s
    .replace(/\bligamenta\b/g, 'ligament')
    .replace(/\bflava\b/g, 'flavum')
    .replace(/\bjoints\b/g, 'joint')
    .replace(/\bprocesses\b/g, 'process')
    .replace(/\bligaments\b/g, 'ligament')
    .replace(/\bmuscles\b/g, 'muscle')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The distinctive words of a name, for loose but non-trivial matching. */
function keyWords(name: string): string[] {
  const STOP = new Set(['ligament', 'muscle', 'process', 'of', 'the', 'and', 'bone', 'joint', 'left', 'right']);
  const words = norm(name).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
  // "Hip Joint" reduces to nothing once 'joint' is dropped and 'hip' is three
  // letters. Falling back to the whole name keeps short names matchable
  // instead of silently matching everything or nothing.
  return words.length > 0 ? words : norm(name).split(' ').filter((w) => w.length > 2);
}

/** Does `text` name this structure? Every distinctive word of the name must appear. */
function names(text: string, s: AnatomyStructure): boolean {
  const hay = norm(text);
  for (const candidate of [s.name, ...(s.aliases ?? [])]) {
    const words = keyWords(candidate);
    if (words.length === 0) continue;
    if (words.every((w) => hay.includes(w))) return true;
  }
  return false;
}

type Level = 'exact' | 'parent' | 'spinal';

interface Row {
  structure: string;
  kind: 'bone' | 'landmark';
  field: 'attachments' | 'articulations';
  claim: string;
  status: 'supported' | 'unsupported';
  level?: Level;
  by?: string;
}

const landmarkParent = new Map<string, string>();
for (const l of landmarks) if (l.parentBoneId) landmarkParent.set(l.id, l.parentBoneId);

/** bone id -> the landmarks that sit on it. A deck site naming one of these
 *  ("Anterior superior iliac spine") is a site on that bone ("pelvis"). */
const boneLandmarks = new Map<string, AnatomyStructure[]>();
for (const l of landmarks) {
  if (!l.parentBoneId) continue;
  boneLandmarks.set(l.parentBoneId, [...(boneLandmarks.get(l.parentBoneId) ?? []), l]);
}

/** Every id a source may name and still be talking about this structure. */
function acceptableIds(s: AnatomyStructure): { exact: Set<string>; parent: Set<string>; spinal: boolean } {
  const exact = new Set<string>([s.id]);
  const parent = new Set<string>();
  if (isLandmark(s)) {
    const p = landmarkParent.get(s.id);
    if (p) parent.add(p);
    // A level-agnostic spinal feature has no single parent bone.
    const spinal = !p && /vertebr|spinous|transverse-process|pedicle|lamina|articular-process|foramen|disc/.test(s.id);
    return { exact, parent, spinal };
  }
  return { exact, parent, spinal: false };
}

/** Does the deck place this muscle on the structure, and at what level? */
function deckLevel(m: (typeof muscles)[number], s: AnatomyStructure): { level: Level; site: string } | null {
  const sites = [...(m.origin ?? []), ...(m.insertion ?? [])];
  const { parent, spinal } = acceptableIds(s);

  for (const site of sites) if (names(site, s)) return { level: 'exact', site };

  // A site naming a feature OF this bone is a site on this bone.
  if (isBone(s)) {
    for (const lm of boneLandmarks.get(s.id) ?? []) {
      for (const site of sites) if (names(site, lm)) return { level: 'exact', site };
    }
  }

  for (const pid of parent) {
    const bone = ALL_STRUCTURES.find((x) => x.id === pid);
    if (!bone) continue;
    for (const site of sites) if (names(site, bone)) return { level: 'parent', site };
  }

  if (spinal) {
    for (const vid of VERTEBRAL) {
      const v = ALL_STRUCTURES.find((x) => x.id === vid);
      if (!v) continue;
      for (const site of sites) if (names(site, v)) return { level: 'spinal', site };
    }
  }
  return null;
}

/** Does a source-checked ligament attach to the structure, and at what level? */
function ligamentLevel(claim: string, s: AnatomyStructure): { level: Level; by: string } | null {
  const { parent, spinal } = acceptableIds(s);
  for (const l of ligaments) {
    if (!names(claim, l)) continue;
    const ids = reviewedAttachmentIds(l);
    if (ids.includes(s.id)) return { level: 'exact', by: `${l.name} (source-checked) attaches to ${s.id}` };
    if (isBone(s)) {
      const own = (boneLandmarks.get(s.id) ?? []).find((lm) => ids.includes(lm.id));
      if (own) return { level: 'exact', by: `${l.name} (source-checked) attaches to ${own.id}, a feature of this bone` };
    }
    for (const pid of parent) {
      if (ids.includes(pid)) return { level: 'parent', by: `${l.name} (source-checked) attaches to ${pid}, the bone this landmark sits on` };
    }
    if (spinal && ids.some((i) => VERTEBRAL.has(i))) {
      return { level: 'spinal', by: `${l.name} (source-checked) attaches to ${ids.filter((i) => VERTEBRAL.has(i)).join(', ')}` };
    }
  }
  return null;
}

function checkAttachment(s: AnatomyStructure, claim: string, kind: Row['kind']): Row {
  const named = muscles.filter((m) => names(claim, m) || (m.groups ?? []).some((g) => norm(claim).includes(norm(g))) || ((m as { partOf?: string }).partOf ? norm(claim).includes(norm((m as { partOf?: string }).partOf!)) : false));

  for (const m of named) {
    const hit = deckLevel(m, s);
    if (hit) return { structure: s.id, kind, field: 'attachments', claim, status: 'supported', level: hit.level, by: `${m.name}: "${hit.site}"` };
  }

  const lig = ligamentLevel(claim, s);
  if (lig) return { structure: s.id, kind, field: 'attachments', claim, status: 'supported', level: lig.level, by: lig.by };

  return {
    structure: s.id,
    kind,
    field: 'attachments',
    claim,
    status: 'unsupported',
    by: named.length ? `names ${named.map((m) => m.name).join(', ')}, but no deck site places any of them here or on this bone` : 'names no muscle or source-checked ligament this repo holds',
  };
}

const rows: Row[] = [];

if (process.argv.includes('--selftest')) {
  const FALSE_PAIRS: [string, string][] = [
    ['femur', 'Deltoid insertion — deltoid tuberosity'],
    ['humerus', 'Gluteus maximus insertion — gluteal tuberosity'],
    ['acromion', 'Soleus origin'],
    ['olecranon', 'Piriformis insertion'],
    ['greater-trochanter', 'Flexor carpi ulnaris origin'],
  ];
  let leaked = 0;
  for (const [id, claim] of FALSE_PAIRS) {
    const s = ALL_STRUCTURES.find((x) => x.id === id)!;
    const r = checkAttachment(s, claim, isBone(s) ? 'bone' : 'landmark');
    const bad = r.status === 'supported';
    console.log(`${bad ? 'LEAKED  ' : 'rejected'}  ${id} :: ${claim}${bad ? ` -> [${r.level}] ${r.by}` : ''}`);
    if (bad) leaked += 1;
  }
  console.log(`\n${leaked} of ${FALSE_PAIRS.length} false claims passed`);
  process.exit(leaked === 0 ? 0 : 1);
}

for (const b of bones) {
  for (const claim of b.attachments ?? []) rows.push(checkAttachment(b, claim, 'bone'));
  for (const claim of b.articulations ?? []) {
    const j = joints.find((x) => names(claim, x));
    rows.push(
      j
        ? { structure: b.id, kind: 'bone', field: 'articulations', claim, status: 'supported', level: 'exact', by: `${j.id} articulates [${(j.articulatingStructureIds ?? []).join(', ')}]` }
        : { structure: b.id, kind: 'bone', field: 'articulations', claim, status: 'unsupported', by: 'names no joint this repo holds as a structure' },
    );
  }
}

for (const l of landmarks) {
  for (const claim of l.attachments ?? []) rows.push(checkAttachment(l, claim, 'landmark'));
}

const n = (p: (r: Row) => boolean) => rows.filter(p).length;
console.log(`attachment and articulation claims reconciled: ${rows.length}`);
console.log(`  supported, exact  : ${n((r) => r.level === 'exact')}`);
console.log(`  supported, parent : ${n((r) => r.level === 'parent')}   (the attachment exists; the named feature is not itself corroborated)`);
console.log(`  supported, spinal : ${n((r) => r.level === 'spinal')}`);
console.log(`  unsupported       : ${n((r) => r.status === 'unsupported')}`);

const idx = process.argv.indexOf('--write');
if (idx >= 0) {
  const out = `${ROOT}/${process.argv[idx + 1] ?? 'attachment-reconcile.json'}`;
  writeFileSync(out, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), rows }, null, 1));
  console.log(`\nWrote ${out}`);
}
