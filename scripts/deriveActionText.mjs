/**
 * Re-derives every muscle's `actionText` from the dataset's own action tags.
 *
 * WHY THIS IS A SCRIPT AND NOT A ONE-OFF EDIT. The sentences it writes replaced
 * prose taken from a lecturer's teaching deck (see the muscle dataset section of
 * docs/BACKLOG-STORE-MONETISATION.md). The defence against that being a
 * derivative work is that the replacements are BUILT from facts the dataset
 * already holds — the 64-term `actions` vocabulary, and each muscle's own
 * recorded attachments — and never from the old prose, which this script does
 * not read. A claim like that is only checkable if the derivation can be re-run,
 * so it lives here rather than in someone's shell history.
 *
 * Usage:
 *   node scripts/deriveActionText.mjs                 # report only
 *   node scripts/deriveActionText.mjs <path> --apply  # write
 *
 * Re-running it is safe and idempotent: the output depends only on `actions`,
 * `origin` and `insertion`, so it reproduces byte-for-byte until those change.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] ?? 'src/features/anatomy-revision/data/source/muscles.raw.json';
const APPLY = process.argv.includes('--apply');

/** tag -> [verb, object]. A null object means the phrase stands alone. */
const TAG = {
  'accessory-inspiration': ['assists', 'inspiration'],
  'inspiration': ['drives', 'inspiration'],
  'expiration': ['drives', 'expiration'],
  'ankle-dorsiflexion': ['dorsiflexes', 'the ankle'],
  'ankle-plantarflexion': ['plantarflexes', 'the ankle'],
  'core-stabilisation': ['stabilises', 'the core'],
  'elbow-extension': ['extends', 'the elbow'],
  'elbow-flexion': ['flexes', 'the elbow'],
  'finger-abduction': ['abducts', 'the fingers'],
  'finger-adduction': ['adducts', 'the fingers'],
  'finger-extension': ['extends', 'the fingers'],
  'finger-flexion': ['flexes', 'the fingers'],
  'finger-opposition': ['opposes', 'the little finger'],
  'foot-eversion': ['everts', 'the foot'],
  'foot-inversion': ['inverts', 'the foot'],
  'forearm-pronation': ['pronates', 'the forearm'],
  'forearm-supination': ['supinates', 'the forearm'],
  'glenohumeral-stabilisation': ['stabilises', 'the glenohumeral joint'],
  'hip-abduction': ['abducts', 'the hip'],
  'hip-adduction': ['adducts', 'the hip'],
  'hip-extension': ['extends', 'the hip'],
  'hip-external-rotation': ['externally rotates', 'the hip'],
  'hip-flexion': ['flexes', 'the hip'],
  'hip-internal-rotation': ['internally rotates', 'the hip'],
  'hip-stabilisation': ['stabilises', 'the hip'],
  'knee-extension': ['extends', 'the knee'],
  'knee-external-rotation': ['externally rotates', 'the knee'],
  'knee-flexion': ['flexes', 'the knee'],
  'knee-internal-rotation': ['internally rotates', 'the knee'],
  'neck-extension': ['extends', 'the neck'],
  'neck-flexion': ['flexes', 'the neck'],
  'neck-lateral-flexion': ['laterally flexes', 'the neck'],
  'neck-rotation': ['rotates', 'the neck'],
  'pelvic-stabilisation': ['stabilises', 'the pelvis'],
  'radial-deviation': ['radially deviates', 'the wrist'],
  'ulnar-deviation': ['ulnarly deviates', 'the wrist'],
  'scapular-depression': ['depresses', 'the scapula'],
  'scapular-downward-rotation': ['downwardly rotates', 'the scapula'],
  'scapular-elevation': ['elevates', 'the scapula'],
  'scapular-protraction': ['protracts', 'the scapula'],
  'scapular-retraction': ['retracts', 'the scapula'],
  'scapular-upward-rotation': ['upwardly rotates', 'the scapula'],
  'shoulder-abduction': ['abducts', 'the shoulder'],
  'shoulder-adduction': ['adducts', 'the shoulder'],
  'shoulder-extension': ['extends', 'the shoulder'],
  'shoulder-external-rotation': ['externally rotates', 'the shoulder'],
  'shoulder-flexion': ['flexes', 'the shoulder'],
  'shoulder-internal-rotation': ['internally rotates', 'the shoulder'],
  'spinal-extension': ['extends', 'the spine'],
  'spinal-stabilisation': ['stabilises', 'the spine'],
  'thumb-abduction': ['abducts', 'the thumb'],
  'thumb-adduction': ['adducts', 'the thumb'],
  'thumb-extension': ['extends', 'the thumb'],
  'thumb-flexion': ['flexes', 'the thumb'],
  'thumb-opposition': ['opposes', 'the thumb'],
  'toe-abduction': ['abducts', 'the toes'],
  'toe-adduction': ['adducts', 'the toes'],
  'toe-extension': ['extends', 'the toes'],
  'toe-flexion': ['flexes', 'the toes'],
  'trunk-flexion': ['flexes', 'the trunk'],
  'trunk-lateral-flexion': ['laterally flexes', 'the trunk'],
  'trunk-rotation': ['rotates', 'the trunk'],
  'wrist-extension': ['extends', 'the wrist'],
  'wrist-flexion': ['flexes', 'the wrist'],
};

function list(items) {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "Flexes and externally rotates the hip" — verbs sharing an object are merged. */
function actionsSentence(tags) {
  const groups = [];
  for (const tag of tags) {
    const entry = TAG[tag];
    if (!entry) throw new Error(`no phrase for tag: ${tag}`);
    const [verb, object] = entry;
    const existing = groups.find((g) => g.object === object);
    if (existing) existing.verbs.push(verb);
    else groups.push({ object, verbs: [verb] });
  }
  const phrases = groups.map((g) => `${list(g.verbs)} ${g.object}`);
  // "Extends the hip and flexes and internally rotates the knee" has two ANDs
  // doing different jobs and reads as a mistake. Once any group has merged
  // verbs of its own, separate the groups with semicolons instead.
  const anyMerged = groups.some((g) => g.verbs.length > 1);
  return anyMerged && phrases.length > 1 ? phrases.join('; ') : list(phrases);
}

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Attachment strings are written as standalone labels ("Iliac fossa of the
 * pelvis"), so they carry no determiner and read wrong inside a clause —
 * "arises from iliac fossa". Add one unless the string already starts with a
 * determiner, a possessive-ish word, or a vertebral level like "T12".
 */
function withDeterminer(s) {
  if (/^(the|a|an|its|their|each|both)/i.test(s)) return s;
  if (/^(medial|lateral|anterior|posterior|superior|inferior|proximal|distal|plantar|dorsal|palmar)/i.test(s)) return `the ${s}`;
  if (/^[A-Z]?\d|^[CTLS]\d/.test(s)) return s; // "T12 and all lumbar...", "5th metatarsal" handled below
  return `the ${s}`;
}

/**
 * The seven muscles a flat list of tags actively misdescribes.
 *
 * Their tag sets hold opposing actions on one joint — the deltoid both flexes
 * and extends the shoulder — which is true of the muscle and false of any of
 * its fibres, so joining the tags produces a sentence that reads as nonsense.
 * Three are multi-part (deltoid, trapezius, pectoralis major) and four act on
 * two different joints of the same digit.
 *
 * These are written out from standard anatomy — the fibre groups of the
 * deltoid and the lumbricals' MCP-flexion-with-IP-extension are in every
 * textbook — rather than generated, and rather than taken from the source
 * deck. Everything they say is recoverable from the muscle's own attachments.
 */
const OVERRIDES = {
  deltoid:
    'Abducts the shoulder; the anterior fibres also flex and internally rotate it, ' +
    'the posterior fibres extend and externally rotate it.',
  trapezius:
    'Upper fibres elevate the scapula, middle fibres retract it and lower fibres depress it; ' +
    'upper and lower acting together rotate it upwards.',
  'pectoralis-major':
    'Adducts and internally rotates the shoulder; the clavicular head flexes it and the ' +
    'sternocostal head extends it from a flexed position.',
  'lumbricals-hand':
    'Flexes the metacarpophalangeal joints of digits 2–5 while extending their interphalangeal joints.',
  'lumbricals-foot':
    'Flexes the metatarsophalangeal joints of toes 2–5 while extending their interphalangeal joints.',
  'dorsal-interossei-foot':
    'Abducts the toes, flexing the metatarsophalangeal joints while extending the interphalangeal joints.',
  'plantar-interossei':
    'Adducts the toes, flexing the metatarsophalangeal joints while extending the interphalangeal joints.',
};

function strip(s) {
  return String(s).replace(/\.$/, '').trim();
}

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const muscles = Array.isArray(raw) ? raw : raw.muscles || Object.values(raw)[0];

// Which tag-sets more than one muscle shares. Those need a discriminator, or
// "what is the action of vastus lateralis?" offers three identical choices.
const byTagSet = new Map();
for (const m of muscles) {
  const key = (m.actions || []).slice().sort().join('|');
  if (!byTagSet.has(key)) byTagSet.set(key, []);
  byTagSet.get(key).push(m);
}

const report = [];
let discriminated = 0;

for (const m of muscles) {
  const tags = m.actions || [];
  let sentence;

  if (tags.length === 0) {
    // Nothing to build from; leave such a muscle for a human rather than invent.
    report.push({ id: m.id, name: m.name, old: m.actionText, next: null, note: 'NO TAGS — skipped' });
    continue;
  }

  if (OVERRIDES[m.id]) {
    report.push({ id: m.id, name: m.name, old: m.actionText, next: OVERRIDES[m.id], note: 'hand-written (opposing actions)' });
    continue;
  }

  sentence = actionsSentence(tags);
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  const group = byTagSet.get(tags.slice().sort().join('|'));
  let note = '';
  if (group.length > 1) {
    // Prefer whichever attachment actually differs within the group.
    const ins = (x) => strip((x.insertion || [])[0] || '');
    const ori = (x) => strip((x.origin || [])[0] || '');
    const insDistinct = new Set(group.map(ins)).size === group.length;
    const oriDistinct = new Set(group.map(ori)).size === group.length;

    if (insDistinct && ins(m)) {
      sentence += `; inserts on ${withDeterminer(lowerFirst(ins(m)))}`;
      note = 'discriminated by insertion';
    } else if (oriDistinct && ori(m)) {
      sentence += `; arises from ${withDeterminer(lowerFirst(ori(m)))}`;
      note = 'discriminated by origin';
    } else if (ins(m)) {
      sentence += `; inserts on ${withDeterminer(lowerFirst(ins(m)))}`;
      note = 'discriminated by insertion (group not fully distinct)';
    }
    if (note) discriminated += 1;
  }

  report.push({ id: m.id, name: m.name, old: m.actionText, next: `${sentence}.`, note });
}

const collisions = new Map();
for (const r of report) {
  if (!r.next) continue;
  collisions.set(r.next, (collisions.get(r.next) || 0) + 1);
}
const duplicates = [...collisions.entries()].filter(([, n]) => n > 1);

console.log(`muscles: ${muscles.length}`);
console.log(`rewritten: ${report.filter((r) => r.next).length}`);
console.log(`skipped (no tags): ${report.filter((r) => !r.next).length}`);
console.log(`needed a discriminator: ${discriminated}`);
console.log(`DUPLICATE sentences after rewrite: ${duplicates.length}`);
duplicates.forEach(([s, n]) => console.log(`   x${n}: ${s}`));

// Old-vs-new for review. Written next to the script rather than into the data
// directory, where it would sit beside the seed looking like part of it.
const REPORT = path.join('scripts', 'deriveActionText.report.json');
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(`
report: ${REPORT}`);

if (APPLY) {
  for (const r of report) {
    if (!r.next) continue;
    const m = muscles.find((x) => x.id === r.id);
    m.actionText = r.next;
  }
  fs.writeFileSync(SRC, `${JSON.stringify(raw, null, 2)}\n`);
  console.log('\nAPPLIED to', SRC);
}
