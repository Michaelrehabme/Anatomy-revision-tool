import type { NerveRef } from '../types/structure';

/**
 * Value normalisation for OINA questions (CR-018). Where mcq.ts collapses a
 * whole field into one joined choice, OINA asks about each authored value on
 * its own — which means every wording inconsistency in the source data that
 * used to hide inside a joined blob now surfaces as a choice a student
 * cannot fairly answer. This module is the one place that knows how to turn
 * an authored value into a fair, comparable one.
 */

/**
 * Multi-headed muscles encode the head in a prose prefix — "Long head:
 * ischial tuberosity". Distractors drawn from other muscles never carry one,
 * so leaving it in would mark every prefixed choice as the answer by shape
 * alone. Verified against the source: colons appear in origin/insertion ONLY
 * in these prefixes (15 values across 8 muscles), so the anchor is safe — but
 * it must never be applied to actionText or notes, which use colons freely
 * ("Upper: elevates scapula; middle: ...").
 *
 * Note gemelli writes "Superior:"/"Inferior:" rather than "...head:", which
 * is why this anchors on the colon and not on the word "head". Anchoring on
 * "head" would also corrupt two innocent values — biceps femoris' insertion
 * "Head of the fibula" and peroneus longus' origin "Head & upper lateral
 * fibula".
 */
const HEAD_PREFIX = /^[A-Z][^:]{0,30}:\s*/;

/**
 * Pronator teres is the one muscle that marks its heads as a trailing
 * parenthetical instead of a prefix ("Medial epicondyle of humerus (humeral
 * head)"). Left in, it reads as a giveaway next to the bare "Medial
 * epicondyle of humerus" that flexor carpi radialis, palmaris longus and
 * flexor carpi ulnaris all authored — and those three share its
 * anterior-superficial group, so they are tier-one distractor candidates.
 * Deliberately narrow: every other trailing parenthetical in the data is
 * meaningful and must survive (ASIS, ITB, pes anserinus, bipennate, ...).
 */
const HEAD_SUFFIX = /\s*\((?=[^)]*\b(?:head|part|portion|belly)\b)[^)]*\)\s*$/i;

/** Strips head/part markers so a value can stand as a choice or a typed slot. */
export function stripHeadPrefix(value: string): string {
  const stripped = value.replace(HEAD_PREFIX, '').replace(HEAD_SUFFIX, '').trim();
  if (!stripped) return value.trim();
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/**
 * Kebab action tags render as sentence case — "knee-external-rotation"
 * becomes "Knee external rotation". Unlike JOINT_TYPE_LABELS this is a
 * mechanical mangle rather than a lookup, because unlike joint types the
 * action tags are uniformly region-then-movement and read correctly under it.
 */
export function humanizeActionTag(tag: string): string {
  const words = tag.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Action tags that name the same thing under different authoring
 * conventions. Same purpose as EQUIVALENT_MOVEMENT_GROUPS for joints: no
 * member may be offered as a distractor against a muscle carrying another
 * member, because "select every action of X" would then mark a student wrong
 * for an answer that is true.
 *
 * The stabilisation family is the live case — nothing in the UI tells a
 * student whether the author filed a deep hip rotator under
 * hip-stabilisation or pelvic-stabilisation. Inspiration is the other:
 * offering "Inspiration" against a scalene tagged accessory-inspiration
 * asserts something false.
 */
export const EQUIVALENT_ACTION_GROUPS: string[][] = [
  [
    'core-stabilisation',
    'spinal-stabilisation',
    'pelvic-stabilisation',
    'glenohumeral-stabilisation',
    'hip-stabilisation',
  ],
  ['inspiration', 'accessory-inspiration'],
];

/** True when two action tags are the same tag, or interchangeable per the groups above. */
export function actionsConflict(a: string, b: string): boolean {
  if (a === b) return true;
  return EQUIVALENT_ACTION_GROUPS.some((group) => group.includes(a) && group.includes(b));
}

/**
 * Nerve entries that are real content but cannot be an answer to "what nerve
 * innervates X?" under select-ALL semantics:
 *
 *  - "(sometimes)" — pectineus' accessory obturator nerve is present in
 *    roughly 10-15% of people. Requiring it would teach a falsehood.
 *  - bare root designations ("C3-C4", "C2-C3 (sensory)", "L1") — a nerve root
 *    is not a nerve name, and trapezius, sternocleidomastoid and levator
 *    scapulae all carry one alongside their actual nerve.
 *
 * Excluded from the correct set only; the values stay in the data and still
 * render in flashcards and fact panels via describeStructure.
 */
const EXCLUDED_NERVE = [/\(sometimes\)/i, /^[CTLS]\d/];

/**
 * Entries that pack two nerves into one authored string. Split by explicit
 * allowlist rather than a generic "&" rule, which would also shred legitimate
 * single attachments like "Superior angle & medial border of scapula". Every
 * target below already exists as its own authored entry elsewhere in the
 * data, so splitting makes the nerve index more consistent, not less.
 */
const NERVE_SPLITS: Record<string, string[]> = {
  'Dorsal & ventral rami': ['Dorsal rami', 'Ventral rami'],
  'Lateral & medial pectoral nerves': ['Lateral pectoral nerve', 'Medial pectoral nerve'],
  'Upper & lower subscapular nerves': ['Upper subscapular nerve', 'Lower subscapular nerve'],
};

/**
 * Same nerve, three authored spellings. Dorsal and posterior rami are the
 * same structure; without this, one is offered as a distractor against the
 * other and the question has two correct answers, only one of which counts.
 */
const NERVE_CANONICAL: Record<string, string> = {
  'Dorsal rami': 'Dorsal rami of spinal nerves',
  'Posterior rami of spinal nerves': 'Dorsal rami of spinal nerves',
};

/**
 * Qualifiers that scope a nerve to part of a muscle — "Tibial nerve (long
 * head)", "Median nerve (lateral half)", "Lateral plantar nerve (2nd-4th
 * lumbricals)". The nerve is the answer; which half of the muscle it reaches
 * is not what the question asked. Also folds the mid-string synonym form
 * ("Deep fibular (peroneal) nerve" to "Deep fibular nerve", which is how the
 * other four muscles it supplies are already authored) and "(CN XI)".
 */
function stripNerveQualifier(name: string): string {
  return name
    .replace(/\s*\((?:long|short|lateral|medial|humeral|ulnar|oblique|transverse|adductor|hamstring)\b[^)]*\)/gi, '')
    .replace(/\s*\((?:1st|2nd|3rd|4th|5th)[^)]*\)/gi, '')
    .replace(/\s*\(peroneal\)/gi, '')
    .replace(/\s*\(CN\s+[IVX]+\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * The canonical, answerable nerve names for a muscle: qualifiers stripped,
 * compounds split, non-nerves and hedges dropped, duplicates folded. Returns
 * an empty array for a muscle whose only entries were excluded — callers must
 * skip the nerve question rather than emit one with no correct answer.
 */
export function canonicalNerveNames(refs: NerveRef[]): string[] {
  const out: string[] = [];
  for (const ref of refs) {
    if (EXCLUDED_NERVE.some((pattern) => pattern.test(ref.name))) continue;
    for (const part of NERVE_SPLITS[ref.name] ?? [ref.name]) {
      const stripped = stripNerveQualifier(part);
      const canonical = NERVE_CANONICAL[stripped] ?? stripped;
      if (canonical && !out.includes(canonical)) out.push(canonical);
    }
  }
  return out;
}

const CONFLICT_STOPWORDS = new Set(['of', 'the', 'a', 'an', 'and', 'to', 'from', 'in', 'on', 'at', 'via', 'its']);

/** Lowercased content tokens, with en/em dashes and ampersands folded to their typeable forms. */
function contentTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !CONFLICT_STOPWORDS.has(t));
}

/**
 * True when a candidate distractor names the same place as the correct answer
 * in different words, and so cannot fairly be marked wrong — e.g. gemelli's
 * "Greater trochanter" against piriformis' "Greater trochanter of the femur",
 * or peroneus tertius' "Distal anterior fibula" against extensor digitorum
 * longus' "Anterior fibula".
 *
 * Token-subset rather than raw substring, so that genuine discriminations
 * survive: "Supraspinous fossa of scapula" and "Infraspinous fossa of
 * scapula" share every token but one and neither contains the other — which
 * is exactly the question worth asking.
 */
export function conflictsWith(correct: string, candidate: string): boolean {
  const a = contentTokens(correct);
  const b = contentTokens(candidate);
  if (a.length === 0 || b.length === 0) return true;
  const setA = new Set(a);
  const setB = new Set(b);
  return a.every((t) => setB.has(t)) || b.every((t) => setA.has(t));
}
