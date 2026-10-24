import type { AnatomyStructure, NerveRef } from '../types/structure';
import { areasOf } from '../types/structure';
import { singular } from './answerMatching';

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

/**
 * Clinical names for attachment sites that the authored value does not use.
 *
 * A student is taught "pes anserinus" and "the Achilles", not "proximal
 * medial surface of the tibia" and "calcaneus via calcaneal tendon". Grading
 * is token-based, so an answer sharing no words with the authored value
 * scores zero however well the student knows the anatomy — the wrong failure
 * for a revision tool, because it teaches them to reproduce this dataset's
 * phrasing rather than to know the site.
 *
 * ONLY DEFINITIONAL EQUIVALENCES BELONG HERE — two names for one structure,
 * never a part for a whole. Gerdy's tubercle is deliberately absent: it is a
 * tubercle ON the lateral condyle of the tibia, so accepting it for extensor
 * digitorum longus's origin ("Lateral condyle of tibia") would mark a
 * narrower site correct than the question asked for, even though it is
 * exactly right for tensor fasciae latae. That needs a per-muscle decision,
 * not a global synonym.
 *
 * `when` matches the authored value; `accept` lists additional forms that
 * grade as correct for it. Adding a synonym never removes the authored
 * phrasing as an answer.
 */
export const ATTACHMENT_SYNONYMS: { when: RegExp; accept: string[] }[] = [
  {
    // Sartorius, gracilis and semitendinosus share this insertion, and the
    // dataset spells it three different ways across the three of them.
    when: /(proximal )?medial (surface|aspect) of (the )?tibia|pes anserinus/i,
    accept: ['pes anserinus'],
  },
  {
    // Named for Achilles in every clinic and for the calcaneus in every
    // textbook; one tendon either way.
    when: /achilles tendon|calcaneal tendon/i,
    accept: ['Achilles tendon', 'calcaneal tendon'],
  },
  {
    when: /intertubercular (sulcus|groove)|bicipital groove/i,
    accept: ['bicipital groove', 'intertubercular sulcus', 'intertubercular groove'],
  },
  {
    when: /radial tuberosity|bicipital tuberosity/i,
    accept: ['radial tuberosity', 'bicipital tuberosity'],
  },
  {
    when: /iliotibial (band|tract)/i,
    accept: ['iliotibial band', 'iliotibial tract'],
  },
  {
    when: /bicipital aponeurosis|lacertus fibrosus/i,
    accept: ['bicipital aponeurosis', 'lacertus fibrosus'],
  },
  {
    when: /thoracolumbar fascia|lumbodorsal fascia/i,
    accept: ['thoracolumbar fascia', 'lumbodorsal fascia'],
  },
];

/** Which limb's digits a value names, where the value itself does not say. */
export type Limb = 'hand' | 'foot';

/**
 * The names a student is taught for the same digit (owner, 24 Oct 2026): the
 * hallux is the big toe, the great toe, the first toe and digit 1, and the
 * dataset itself writes "big toe" for flexor hallucis longus and "digit 1"
 * for extensor hallucis brevis. Grading is token-based, so "distal phalanx
 * of the hallux" shared one word with the answer and failed.
 *
 * Every digit is folded to one token naming the limb and the number —
 * "toe1", "finger2-5" — on both sides of the comparison. The token carries a
 * digit, so the grader matches it exactly (isIdentifierToken): the 2nd
 * metacarpal is never the 3rd, the thumb is never the big toe, and the toes
 * 2-5 are never the fingers 2-5. The same rule as ATTACHMENT_SYNONYMS
 * applies: two names for one digit, never a part for a whole, so a bare
 * "distal phalanx" still does not answer "distal phalanx of big toe".
 *
 * "Digit" on its own names no limb. `limb` decides it: the answer key's own
 * limb when grading, the muscle's when the accepted forms are built
 * (limbExplicitForm).
 */
export function canonicalDigits(value: string, limb?: Limb): string {
  const kind = (word: string) => {
    if (word.startsWith('toe')) return 'toe';
    if (word.startsWith('finger')) return 'finger';
    return limb === 'foot' ? 'toe' : limb === 'hand' ? 'finger' : 'digit';
  };
  const n = (word: string) => NUMBER_WORDS[word] ?? word;
  const RANGE = String.raw`(\d)(?:st|nd|rd|th)?\s*(?:-|to|through)\s*(\d)(?:st|nd|rd|th)?`;
  const DIGIT_WORD = String.raw`(digit|toe|finger)s?`;
  return (
    value
      .toLowerCase()
      .replace(/[–—]/g, '-')
      .replace(/['’]/g, '')
      // Fractions of a bone: "medial third of the clavicle" is "Medial 1/3 clavicle".
      .replace(/\b(\d)\/(\d)(?:st|nd|rd|th|s)+\b/g, '$1/$2')
      .replace(/\btwo[\s-]thirds?\b/g, '2/3')
      .replace(/\b(?:(?:one|a)[\s-])?third(?!\s+(?:digit|toe|finger|metacarp|metatars|phalan|cuneiform|rib|vertebra))\b/g, '1/3')
      .replace(/\b(?:(?:one|a)[\s-])?half\b/g, '1/2')
      .replace(/\b(?:(?:one|a)[\s-])?quarter\b/g, '1/4')
      // Ordinals as numbers, so "first toe", "1st toe" and "toe 1" meet.
      .replace(/\b(first|second|third|fourth|fifth)\b/g, (w) => ORDINAL_WORDS[w])
      .replace(/\b(digits?|toes?|fingers?|metatarsals?|metacarpals?)\s+(one|two|three|four|five)\b/g, (_, w, num) => `${w} ${n(num)}`)
      .replace(/\b(\d)\s*(-|to|through)\s*(one|two|three|four|five)\b/g, (_, a, sep, num) => `${a} ${sep} ${n(num)}`)
      // Clinical shorthand: D1 is digit 1, D2-D5 the digits 2 to 5.
      .replace(/\bd([1-5])\s*-\s*d?([1-5])\b/g, 'digits $1-$2')
      .replace(/\bd([1-5])\b/g, 'digit $1')
      .replace(
        /\b(digits?|toes?|fingers?|metatarsals?|metacarpals?)\s+(i{1,3}|iv|v)(?:\s*(?:-|to)\s*(i{1,3}|iv|v))?\b/g,
        (_, w, a, b) => `${w} ${ROMAN[a]}${b ? `-${ROMAN[b]}` : ''}`,
      )
      // Digits with a name of their own.
      .replace(/\b(?:hallux|hallucis|great toe|big toe)\b/g, 'toe1')
      .replace(/\b(?:thumb|pollex|pollicis)\b/g, 'finger1')
      .replace(/\b(?:little|small|baby|pinky|pinkie) toe\b/g, 'toe5')
      .replace(/\b(?:(?:little|small) finger|pinky|pinkie)\b/g, 'finger5')
      .replace(/\b(?:index|pointer) finger\b/g, 'finger2')
      .replace(/\bmiddle finger\b/g, 'finger3')
      .replace(/\bring finger\b/g, 'finger4')
      .replace(/\bdigiti minimi\b/g, `${kind('digit')}5`)
      // The four besides the first: the lateral four toes, the medial four fingers.
      .replace(/\b(?:(?:four|4) )?lesser toes\b/g, 'toe2-5')
      // Lateral on the foot, medial on the hand: the other way round is the
      // four that include the first.
      .replace(/\blateral (?:four|4) (toe|digit)s\b/g, (m, w) => (kind(w) === 'toe' ? 'toe2-5' : m))
      .replace(/\bmedial (?:four|4) (finger|digit)s\b/g, (m, w) => (kind(w) === 'finger' ? 'finger2-5' : m))
      // "The four fingers" are the four besides the thumb.
      .replace(/(?<!lateral |medial )\b(?:four|4) fingers\b/g, 'finger2-5')
      // Numbered digits, as a range or one at a time, either way round.
      .replace(new RegExp(String.raw`\b${DIGIT_WORD}\s*${RANGE}\b`, 'g'), (_, w, a, b) => `${kind(w)}${a}-${b}`)
      .replace(new RegExp(String.raw`\b${RANGE}\s+${DIGIT_WORD}\b`, 'g'), (_, a, b, w) => `${kind(w)}${a}-${b}`)
      .replace(new RegExp(String.raw`\b${DIGIT_WORD}\s*(\d)(?![\d/-])\b`, 'g'), (_, w, a) => `${kind(w)}${a}`)
      .replace(new RegExp(String.raw`\b(\d)(?:st|nd|rd|th)?\s+${DIGIT_WORD}\b`, 'g'), (_, a, w) => `${kind(w)}${a}`)
      // Numbered metacarpals and metatarsals: "1st metatarsal" is "metatarsal 1".
      .replace(new RegExp(String.raw`\b${RANGE}\s+(metatarsal|metacarpal)s\b`, 'g'), (_, a, b, bone) => `${bone}s ${a}-${b}`)
      .replace(/\b(\d)(?:st|nd|rd|th)?\s+(metatarsal|metacarpal)(s?)\b/g, (_, a, bone, s) => `${bone}${s} ${a}`)
  );
}

const ORDINAL_WORDS: Record<string, string> = { first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th' };
const NUMBER_WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5' };
const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5' };

/**
 * Authored values that name two places in one string, and the two places
 * (owner, 24 Oct 2026: "multiple O's and I's presented in the same answer
 * box"). A question about a muscle's sites asks for each on its own: its own
 * button, its own typed box.
 *
 * Held here rather than split in muscles.raw.json because the published
 * diagnostic papers print a muscle's field as authored, and a published
 * paper is never edited (diagnosticPapers.ts). The Atlas and the fact cards
 * keep the authored sentence too.
 *
 * Each place in the source's own words, with the bone it shares with its
 * partner said where it would otherwise be lost ("Pubic crest & symphysis"
 * is the pubic symphysis). Left joined: a value whose "and" describes one
 * surface ("Anterior and medial surfaces of ulna", "Medial and lateral sides
 * of the base of the proximal phalanx"), one head's footprint behind a head
 * prefix (biceps brachii's long head, adductor pollicis's oblique head),
 * anconeus's "Lateral olecranon & proximal ulna" (split, "Proximal ulna" is
 * where brachialis inserts too, and was offered as a wrong answer to it), and
 * longus colli, whose bodies and transverse processes do not share the one
 * range the value gives them.
 */
export const SEPARATE_SITES: Record<string, string[]> = {
  'Superior angle & medial border of scapula': ['Superior angle of scapula', 'Medial border of scapula'],
  'Coronoid process & ulnar tuberosity': ['Coronoid process of ulna', 'Ulnar tuberosity'],
  'Pubic crest & symphysis': ['Pubic crest', 'Pubic symphysis'],
  'Lateral condyle and upper 2/3 of lateral tibia': ['Lateral condyle of tibia', 'Upper 2/3 of lateral tibia'],
  'Head & upper lateral fibula': ['Head of fibula', 'Upper lateral fibula'],
  'Upper posterior fibula & tibia': ['Upper posterior fibula', 'Upper posterior tibia'],
  'Medial & lateral femoral condyles': ['Medial femoral condyle', 'Lateral femoral condyle'],
  'Medial and lateral tubercles of calcaneus': ['Medial tubercle of calcaneus', 'Lateral tubercle of calcaneus'],
  'Medial and lateral sides of calcaneus': ['Medial side of calcaneus', 'Lateral side of calcaneus'],
  'Base of 2nd and 3rd metacarpals': ['Base of 2nd metacarpal', 'Base of 3rd metacarpal'],
  'Posterior surfaces of ulna and radius': ['Posterior surface of ulna', 'Posterior surface of radius'],
  'Sternum & costal cartilages 1–6': ['Sternum', 'Costal cartilages 1–6'],
};

/** The places one authored value names, head prefix stripped: one, or two where SEPARATE_SITES splits it. */
export function separateSites(raw: string): string[] {
  const canonical = stripHeadPrefix(raw);
  return SEPARATE_SITES[canonical] ?? [canonical];
}

/** The limb whose digits a structure's attachments name: its area's. */
export function limbOfStructure(structure: Pick<AnatomyStructure, 'areas' | 'subregion'>): Limb | undefined {
  const areas = areasOf(structure);
  if (areas.includes('ankle-foot')) return 'foot';
  if (areas.includes('wrist-hand')) return 'hand';
  return undefined;
}

/** The limb a value's digits belong to, when it names one. */
export function limbOfValue(value: string): Limb | undefined {
  const canonical = canonicalDigits(value);
  if (/toe\d|metatars|calcane|hallu/.test(canonical)) return 'foot';
  if (/finger\d|metacarp|pollic/.test(canonical)) return 'hand';
  return undefined;
}

/**
 * An authored value that writes "digit" for a toe, said with the limb: the
 * foot's "Proximal phalanx of digit 1" is "Proximal phalanx of big toe", and
 * its "Digits 2–4" are toes. Undefined when the value already says which, or
 * names no digit. Readable, because it is an accepted form and the hints
 * count from accepted forms (SlotHints).
 */
export function limbExplicitForm(value: string, limb: Limb): string | undefined {
  if (limbOfValue(value)) return undefined;
  const toe = limb === 'foot';
  const out = value
    .replace(/\bdigit\s+(?:1|I)\b/gi, toe ? 'big toe' : 'thumb')
    .replace(/\bdigit\s+(?:5|V)\b/gi, toe ? 'little toe' : 'little finger')
    .replace(/\b(d)igit(s?)\b/gi, (_, d: string, s: string) => {
      const word = toe ? `toe${s}` : `finger${s}`;
      return d === 'D' ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .replace(/\b(phalanx|phalanges)\s+(\d(?:\s*[–-]\s*\d)?)\b/gi, (_, p: string, d: string) => `${p} of ${toe ? 'toes' : 'fingers'} ${d}`);
  return out === value ? undefined : out;
}

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
  // The big toe is a toe: "Toe flexion" offered against abductor hallucis's
  // "Big toe flexion" is true of it. The hallux has its own tags (owner, 24
  // Oct 2026: "should be big toe abd") as the thumb does, but unlike the
  // thumb and the fingers it is still one of the toes.
  ['toe-flexion', 'big-toe-flexion'],
  ['toe-extension', 'big-toe-extension'],
  ['toe-abduction', 'big-toe-abduction'],
  ['toe-adduction', 'big-toe-adduction'],
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

/**
 * Lowercased content tokens, with en/em dashes and ampersands folded to their
 * typeable forms, each in the singular: "Medial and lateral tubercles of
 * calcaneus" was offered as a wrong origin of abductor hallucis, which arises
 * from the medial tubercle, because "tubercles" was not "tubercle" (found on
 * a phone, 11 Oct 2026).
 */
function contentTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !CONFLICT_STOPWORDS.has(t))
    .map(singular);
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
  // The same words under two different bracketed notes are one place:
  // "Iliotibial band (ITB)" and "Iliotibial band (inserting into the lateral
  // tibial condyle)" share no token of their notes and were two buttons.
  const unbracketed = (value: string) => contentTokens(value.replace(/\([^)]*\)/g, ' ')).join(' ');
  if (unbracketed(correct) && unbracketed(correct) === unbracketed(candidate)) return true;
  const setA = new Set(a);
  const setB = new Set(b);
  return a.every((t) => setB.has(t)) || b.every((t) => setA.has(t));
}
