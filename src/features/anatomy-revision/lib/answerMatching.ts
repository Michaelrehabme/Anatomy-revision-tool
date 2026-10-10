/**
 * Normalizes a typed answer: trims, lowercases, collapses internal
 * whitespace, and drops a leading article — fill-blank answers are often a
 * bare noun phrase ("femur") and students may reasonably type "the femur"
 * instead, which shouldn't count as a spelling mismatch.
 *
 * "the" goes wherever it falls. Names are written without it ("Transverse
 * ligament of atlas", "Distal Phalanges of Hand") and a student who types
 * "of the atlas" has named the same structure.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/ the(?= )/g, '');
}

/** Levenshtein edit distance (insert/delete/substitute), computed with a single-row DP. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(Math.min(prevRow[j] + 1, currentRow[j - 1] + 1, prevRow[j - 1] + cost));
    }
    prevRow = currentRow;
  }
  return prevRow[b.length];
}

/**
 * Checks a typed answer against a list of accepted strings, tolerant of a
 * single-character typo (insertion, deletion, or substitution) so students
 * aren't marked wrong for one mistyped letter.
 */
export function isAnswerMatch(input: string, accepted: string[], maxDistance = 1): boolean {
  const normalizedInput = normalize(input);
  if (!normalizedInput) return false;
  return accepted.some((candidate) => editDistance(normalizedInput, normalize(candidate)) <= maxDistance);
}

/** Words that say which of a pair, and so take the rest of their partner's name. */
const POSITION = /^(?:proximal|distal|medial|lateral|anterior|posterior|superior|inferior|middle|internal|external|upper|lower)$/i;
/** A plural the members of a list share: "alar and apical ligaments". */
const SHARED_NOUN = /^(?:joints|fossae|ligaments|phalanges)$/i;
/** The second of two muscles named by what tells them apart: "fibularis longus and brevis". */
const DISTINGUISHER = /^(?:brevis|longus|minor|major|medius|minimus|maximus|magnus|anterior|posterior)$/i;
/** A phrase, not a thing: "between the occipital condyles and the superior articular facets". */
const PHRASE = /^(?:between|around|above|below|via|at|on|in|of|with)\b/i;

/**
 * The separate things an authored answer names, one per box: "Gluteus
 * medius/minimus" is two muscles, "Sartorius, gracilis, semitendinosus" is
 * three, "gluteal tuberosity" is one. A blank with several is answered in
 * several boxes (the owner's call, 9 Oct 2026) rather than by typing the
 * list, punctuation and all, into one.
 *
 * Lists split at commas, "and" and slashes, and a member written short takes
 * the words it shares with its partner: "medius/minimus" share "Gluteus",
 * "proximal and distal tibiofibular joints" share the joints, "fibularis
 * longus and brevis" share the muscle. Nothing is borrowed without one of
 * those cues — "trapezius and rhomboid minor" is not a trapezius minor.
 * "…and other short external rotators" names nothing to type and is dropped,
 * and an answer that turns out to be a phrase is left whole.
 */
export function answerItems(answer: string): string[] {
  const items: string[] = [];
  for (const listed of answer.replace(/\s+all$/i, '').split(/,\s*/)) {
    const [left, right, ...more] = listed.split(/\s+(?:and|&)\s+/);
    let pair: string[];
    if (right === undefined || more.length) pair = [listed];
    else if (/^other\b/i.test(right)) pair = [left];
    else {
      const l = left.split(' ');
      const r = right.split(' ');
      if (l.length === 1 && r.length > 1 && POSITION.test(left)) pair = [[left, ...r.slice(1)].join(' '), right];
      else if (l.length === 1 && r.length > 1 && SHARED_NOUN.test(r[r.length - 1])) pair = [`${left} ${r[r.length - 1]}`, right];
      else if (r.length === 1 && l.length > 1 && DISTINGUISHER.test(right)) pair = [left, [...l.slice(0, -1), right].join(' ')];
      else pair = [left, right];
    }
    for (const part of pair) {
      const [first, ...alternatives] = part.split('/');
      // "ribs 1–8/9" is one range written two ways, not two things.
      if (!alternatives.length || alternatives.some((a) => !/^[a-z]/i.test(a))) {
        items.push(part);
        continue;
      }
      const head = first.split(' ').slice(0, -1).join(' ');
      // "middle/proximal phalanges": the short one is first, and takes the tail.
      const tail = alternatives[alternatives.length - 1].split(' ').slice(1).join(' ');
      items.push(!head && tail ? `${first} ${tail}` : first, ...alternatives.map((a) => (a.includes(' ') || !head ? a : `${head} ${a}`)));
    }
  }
  // "Anterior talofibular, calcaneofibular and posterior talofibular
  // ligaments": the noun the list ends on belongs to every member of it.
  const noun = items[items.length - 1]?.match(/ (ligaments?|joints|fossae|phalanges)$/i)?.[1];
  const named = noun ? items.map((item) => (item.split(' ').length <= 2 && !/ (?:ligaments?|joints?|fossae?|phalanges)$/i.test(item) ? `${item} ${noun}` : item)) : items;
  const seen = new Set<string>();
  const distinct = named
    .map((item) => item.trim().replace(/^the\s+/i, ''))
    .filter((item) => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()));
  return distinct.some((item) => PHRASE.test(item)) ? [answer] : distinct;
}

/**
 * What a box takes for one item: the item, the gym's word for the muscle, and
 * the name without the noun that only says what kind of thing it is.
 */
export function itemVariants(item: string): string[] {
  const variants = new Set([item, item.replace(/\bgluteus\b/gi, 'glute')]);
  for (const variant of [...variants]) variants.add(variant.replace(/ (?:ligaments?|muscles?)$/i, ''));
  return [...variants].filter(Boolean);
}
