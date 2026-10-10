import { containerIds } from '../attachmentSites';
import {
  areasOf,
  isBone,
  isJoint,
  isLandmark,
  isLigament,
  isMuscle,
  reviewedAttachmentIds,
  type AnatomyStructure,
} from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { LocateQuestion } from '../../types/question';
import { createRng, shuffle, type Rng } from '../rng';

/**
 * A LOCATE QUESTION ASKED IN WORDS — "Which of these describes where the
 * acromion sits?" (docs/accessibility-locate.md, option B).
 *
 * WHO IT IS FOR. Someone who cannot see the plate cannot tap it, and the list
 * of names that used to stand in for the tap tested nothing about where a
 * structure is: the prompt had just given the name. This asks the same
 * structure a spatial question a screen reader can read: four descriptions of
 * what a structure joins, lies on or sits between, one of them true.
 *
 * NOTHING HERE IS WRITTEN. Every option is a label and a list of values the
 * seed already holds and already grades against: a muscle's `origin` and
 * `insertion`, a ligament's reviewed `attachmentStructureIds`, a landmark's
 * `parentBoneId`, `attachments` and `articulations`, a joint's
 * `articulatingStructureIds`, a bone's `articulations`. The values are printed
 * as they are stored — "Origin: Lateral 1/3 clavicle; Acromion; Spine of
 * scapula." — in the same words the long description of the plate uses once
 * the question is answered (lib/plateDescription.ts, relationSentences), so
 * the two never disagree. Rewriting them into sentences would mean inventing
 * articles and prepositions around anatomy nobody has reviewed in that form.
 *
 * THE THREE WAYS A QUESTION LIKE THIS GIVES ITSELF AWAY, and what stops each:
 *
 *  1. By the structure's own name. "Deltoid" inserts on the "Deltoid
 *     tuberosity of humerus"; the "Medial Condyle of Tibia" is part of the
 *     "Tibia". A value that shares a DISTINCTIVE word with the name is left
 *     out of the description, and the part it was in is dropped when nothing
 *     else is left in it. Distinctive means rare across every structure's
 *     name, so "medial" and "process" do not count and "deltoid" does. What
 *     this does NOT catch is a name built from the roots of what it joins —
 *     the talofibular ligament, the humeroradial joint. That is how anatomy
 *     names things, reading it is knowledge, and it is counted in the doc
 *     rather than hidden.
 *  2. By form. All four options carry the same labels in the same order (the
 *     asked structure's), and the wrong ones are chosen near the right one in
 *     length, with the right one's place in the length order drawn at random —
 *     so "the long one" and "the one with two parts" are not strategies.
 *  3. By being accidentally true. A wrong option is dropped when everything it
 *     claims is also true of the asked structure (a ligament joining a subset
 *     of the same bones, a muscle with the same origin and insertion), and
 *     when it mentions the asked structure by name ("Knee joint with the
 *     femur" cannot describe the femur).
 *
 * WHERE THE WRONG OPTIONS COME FROM. Other structures of the same category,
 * nearest first: ones that share something with the asked structure (a
 * landmark on the same bone, a ligament from the same bone), then the same
 * area, then the same region, then anywhere. Only structures whose FACTS are
 * loaded can be described, so once facts are served per area
 * (docs/CONTENT-SERVER-STATUS.md) a student holding one area draws from that
 * area alone, and an item whose area cannot supply three wrong descriptions
 * falls back to the list of names (locateList.ts). Names of the bones a
 * ligament or joint refers to come from the index, which is always whole.
 *
 * Loaded with import() by the locate screens (hooks/useLocateRoutes.ts), so
 * none of this is in the entry chunk.
 */

export interface DescribedRegionQuestion {
  /** The locate question this stands in for; its id is what an answer is recorded against. */
  locateQuestionId: string;
  structureId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export interface DescribedRegionSources {
  /** The structures whose facts are loaded — the only ones that can be described. */
  loaded: readonly AnatomyStructure[];
  /** Every structure, for names. Defaults to `loaded`, which is everything while the seed is bundled. */
  index?: readonly StructureIndexEntry[];
}

/** Why a described-region question could not be built, for the coverage report and the tests. */
export type DescribedRegionGap = 'no-data' | 'name-gives-it-away' | 'too-few-wrong-options';

/** One labelled part of a description: "Origin" and the values under it. */
interface Part {
  label: string;
  /** As printed. */
  items: string[];
  /** What each item claims, in a form two structures can be compared by: an id, or normalised text. */
  claims: string[];
  /**
   * The bones the named items are parts of. "Attaches to: Tibia; Femur" says
   * nothing false about a ligament that attaches to the lateral condyle of
   * the femur, so a claim one of these covers is one of this structure's own.
   */
  covers?: string[];
}

const CHOICES = 4;
/** A wrong option is this close in length to the right one, as a ratio either way… */
const LENGTH_BAND = 1.8;
/** …or, when an item cannot find three that close, this close. Beyond it the question is not built. */
const LENGTH_BAND_WIDE = 2.6;
/**
 * A word of a structure's name is DISTINCTIVE — an option containing it points
 * at the structure — when it is not one of the words of position and shape
 * below, and either few structures have it in their name ("deltoid" is in
 * three) or it is a structure's whole name ("humerus" is in a dozen names,
 * every one of them a part of the humerus). Measured over the index, so it
 * does not move with what is loaded.
 */
const DISTINCTIVE_NAME_COUNT = 8;
const MIN_WORD = 4;
const POSITION_AND_SHAPE_WORDS = new Set(
  (
    'anterior posterior medial lateral superior inferior proximal distal dorsal palmar plantar superficial deep ' +
    'upper lower middle greater lesser major minor long short longus brevis head neck body base shaft process ' +
    'tubercle tuberosity condyle epicondyle crest spine fossa notch line border angle surface facet articular ' +
    'joint joints ligament ligaments membrane hand foot grouped with from first second third fourth fifth'
  ).split(' '),
);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function words(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((w) => w.length >= MIN_WORD && !POSITION_AND_SHAPE_WORDS.has(w));
}

/** A structure's name without the seed's bookkeeping suffix: "Carpals (grouped)" is the carpals. */
export function plainStructureName(name: string): string {
  return name.replace(/ \(grouped\)$/, '');
}

/**
 * "sit" for a name that is a plural — "the Dorsal intercarpal ligaments sit" —
 * and "sits" otherwise. Most names ending in s are Latin singulars (biceps,
 * gracilis, pelvis), so this is a list of the plural nouns the seed uses and
 * not a rule about endings.
 */
const PLURAL_NAME =
  /\b(ligaments|vertebrae|ribs|carpals|tarsals|metacarpals|metatarsals|phalanges|lumbricals|interossei|gemelli|intercostals|rotatores|interspinales|intertransversarii|bones)\b/i;

export function isPluralName(name: string): boolean {
  return PLURAL_NAME.test(name);
}

/** How many structures carry each word in their name, and which words are a whole name, over the index. */
function nameWordCounts(index: readonly StructureIndexEntry[]): { counts: Map<string, number>; wholeNames: Set<string> } {
  const counts = new Map<string, number>();
  const wholeNames = new Set<string>();
  for (const s of index) {
    const own = new Set(words(plainStructureName(s.name)));
    for (const w of own) counts.set(w, (counts.get(w) ?? 0) + 1);
    if (own.size === 1) wholeNames.add([...own][0]);
  }
  return { counts, wholeNames };
}

/**
 * The words of this structure's NAME that would identify it if an option
 * contained them. Its aliases are left out: the prompt shows the name, and a
 * word the student has not been shown cannot give anything away.
 */
function distinctiveWords(structure: StructureIndexEntry, { counts, wholeNames }: ReturnType<typeof nameWordCounts>): Set<string> {
  return new Set(words(structure.name).filter((w) => wholeNames.has(w) || (counts.get(w) ?? 0) <= DISTINCTIVE_NAME_COUNT));
}

function mentions(text: string, distinctive: ReadonlySet<string>): boolean {
  return words(text).some((w) => distinctive.has(w));
}

/**
 * Everything the seed says about where a structure is, as labelled parts, in
 * a fixed order per category. Empty when it says nothing.
 */
function partsOf(
  structure: AnatomyStructure,
  nameOf: (id: string) => string | undefined,
  entryOf: (id: string) => StructureIndexEntry | undefined = () => undefined,
): Part[] {
  const text = (label: string, values: readonly string[]): Part => {
    const items = values.map((v) => v.trim().replace(/\.$/, '')).filter(Boolean);
    return { label, items, claims: items.map(normalise) };
  };
  const named = (label: string, ids: readonly string[]): Part => {
    const known = ids.filter((id) => nameOf(id));
    const covers = known.flatMap((id) => {
      const entry = entryOf(id);
      return entry ? [...containerIds(entry), ...(entry.category === 'landmark' && entry.parentBoneId ? [entry.parentBoneId] : [])] : [];
    });
    return { label, items: known.map((id) => plainStructureName(nameOf(id)!)), claims: known, covers };
  };

  let parts: Part[] = [];
  if (isMuscle(structure)) parts = [text('Origin', structure.origin), text('Insertion', structure.insertion)];
  // Read through reviewedAttachmentIds: an attachment nobody has checked is not offered as an answer.
  else if (isLigament(structure)) parts = [named('Attaches to', reviewedAttachmentIds(structure))];
  else if (isLandmark(structure)) {
    parts = [
      named('Part of', structure.parentBoneId ? [structure.parentBoneId] : []),
      text('Attached here', structure.attachments),
      text('Articulates', structure.articulations ?? []),
    ];
  } else if (isJoint(structure)) parts = [named('Formed by', structure.articulatingStructureIds)];
  else if (isBone(structure)) parts = [text('Articulations', structure.articulations)];
  return parts.filter((p) => p.items.length > 0);
}

function render(parts: readonly Part[]): string {
  return parts.map((p) => `${p.label}: ${p.items.join('; ')}.`).join(' ');
}

/** `a` says nothing `b` does not: every claim is one of b's, or the same words inside one of them. */
function claimsWithin(a: Part, b: Part | undefined): boolean {
  if (!b) return false;
  return a.claims.every(
    (claim) => b.covers?.includes(claim) || b.claims.some((other) => other === claim || ` ${other} `.includes(` ${claim} `)),
  );
}

/** What the asked structure and a candidate have in common that makes the candidate a near neighbour. */
function sharesSomething(target: AnatomyStructure, candidate: AnatomyStructure): boolean {
  if (isLandmark(target) && isLandmark(candidate)) return !!target.parentBoneId && target.parentBoneId === candidate.parentBoneId;
  if (isLigament(target) && isLigament(candidate)) {
    const own = new Set(reviewedAttachmentIds(target));
    return reviewedAttachmentIds(candidate).some((id) => own.has(id));
  }
  if (isJoint(target) && isJoint(candidate)) {
    const own = new Set(target.articulatingStructureIds);
    return candidate.articulatingStructureIds.some((id) => own.has(id));
  }
  if (isMuscle(target) && isMuscle(candidate)) {
    const own = new Set(target.groups ?? []);
    return (candidate.groups ?? []).some((g) => own.has(g));
  }
  return false;
}

/** 0 nearest: shares something, same area, same region, anywhere. */
function tierOf(target: AnatomyStructure, candidate: AnatomyStructure): number {
  const areas = new Set(areasOf(target));
  const sameArea = areasOf(candidate).some((a) => areas.has(a));
  if (sameArea && sharesSomething(target, candidate)) return 0;
  if (sameArea) return 1;
  if (candidate.region === target.region) return 2;
  return 3;
}

/** A seed for the rng from a question id, so one question always builds the same options. */
export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Three wrong options around a right one of length `own`, taken nearest tier
 * first. Where a tier holds more than are needed, how many of the three are
 * SHORTER than the right answer is drawn at random and honoured as far as the
 * tier allows: left to chance, a long description is the longest of its four
 * far more often than one time in four, and "pick the longest" would pay.
 */
function pickWrong(candidates: { text: string; tier: number }[], own: number, rng: Rng): string[] {
  const picked: string[] = [];
  const shorterWanted = Math.floor(rng() * CHOICES);
  for (let tier = 0; tier <= 3 && picked.length < CHOICES - 1; tier++) {
    const inTier = shuffle(candidates.filter((c) => c.tier === tier), rng);
    const need = CHOICES - 1 - picked.length;
    if (inTier.length <= need) {
      picked.push(...inTier.map((c) => c.text));
      continue;
    }
    const shorterHave = picked.filter((t) => t.length < own).length;
    const shorter = inTier.filter((c) => c.text.length < own);
    const longer = inTier.filter((c) => c.text.length >= own);
    const takeShorter = Math.min(shorter.length, Math.max(0, shorterWanted - shorterHave), need);
    const chosen = [...shorter.slice(0, takeShorter), ...longer.slice(0, need - takeShorter)];
    // Not enough on the longer side: make the number up from the shorter.
    chosen.push(...shorter.slice(takeShorter, takeShorter + need - chosen.length));
    picked.push(...chosen.map((c) => c.text));
  }
  return picked;
}

export interface DescribedRegionBuilder {
  /** The question for this locate question, or why there is none. */
  build(question: Pick<LocateQuestion, 'id' | 'targetStructureId'>): DescribedRegionQuestion | DescribedRegionGap;
  /** The true description alone — what the answer is shown as, and what the tests check against the seed. */
  describe(structureId: string): string | null;
}

/**
 * Indexes the loaded structures once; `build` is then cheap enough to call for
 * every locate question in a session, or for all of them in a test.
 */
export function createDescribedRegionBuilder({ loaded, index = loaded }: DescribedRegionSources): DescribedRegionBuilder {
  const loadedById = new Map(loaded.map((s) => [s.id, s]));
  const indexById = new Map(index.map((s) => [s.id, s]));
  const nameOf = (id: string) => indexById.get(id)?.name;
  const counts = nameWordCounts(index);
  const allParts = new Map<string, Part[]>();
  const partsFor = (s: AnatomyStructure) => {
    let parts = allParts.get(s.id);
    if (!parts) allParts.set(s.id, (parts = partsOf(s, nameOf, (id) => indexById.get(id))));
    return parts;
  };

  /** The asked structure's parts with whatever its own name gives away taken out. */
  const askedParts = (target: AnatomyStructure): Part[] => {
    const distinctive = distinctiveWords(target, counts);
    return partsFor(target)
      .map((p) => {
        const keep = p.items.map((item) => !mentions(item, distinctive));
        return { label: p.label, items: p.items.filter((_, i) => keep[i]), claims: p.claims.filter((_, i) => keep[i]) };
      })
      .filter((p) => p.items.length > 0);
  };

  const build: DescribedRegionBuilder['build'] = (question) => {
    const target = loadedById.get(question.targetStructureId);
    if (!target || partsFor(target).length === 0) return 'no-data';
    const own = askedParts(target);
    if (own.length === 0) return 'name-gives-it-away';
    const truth = render(own);
    const labels = own.map((p) => p.label);
    const fullTruth = partsFor(target);
    const distinctive = distinctiveWords(target, counts);

    // Keyed by what is printed: two structures with one description are one
    // option, and it counts as near as the nearer of them.
    const byText = new Map<string, { text: string; tier: number; ratio: number }>();
    for (const other of loaded) {
      if (other.id === target.id || other.category !== target.category) continue;
      const theirs = partsFor(other);
      // The same labels as the right answer, in its order — or it is not offered.
      const shaped = labels.map((label) => theirs.find((p) => p.label === label));
      if (shaped.some((p) => !p)) continue;
      const parts = shaped as Part[];
      // Measured against EVERYTHING true of the asked structure, including what its name hid.
      if (parts.every((p) => claimsWithin(p, fullTruth.find((t) => t.label === p.label)))) continue;
      const text = render(parts);
      if (text === truth || mentions(text, distinctive)) continue;
      const tier = Math.min(tierOf(target, other), byText.get(text)?.tier ?? 3);
      const ratio = Math.max(text.length, truth.length) / Math.min(text.length, truth.length);
      byText.set(text, { text, tier, ratio });
    }

    // In a fixed order before anything is drawn, so the options do not depend
    // on the order the structures happened to be loaded in.
    const candidates = [...byText.values()].sort((a, b) => (a.text < b.text ? -1 : 1));
    const rng = createRng(seedFromId(question.id));
    let wrong = pickWrong(candidates.filter((c) => c.ratio <= LENGTH_BAND), truth.length, rng);
    if (wrong.length < CHOICES - 1) {
      wrong = pickWrong(candidates.filter((c) => c.ratio <= LENGTH_BAND_WIDE), truth.length, rng);
    }
    if (wrong.length < CHOICES - 1) return 'too-few-wrong-options';

    const choices = shuffle([truth, ...wrong], rng);
    const name = plainStructureName(target.name);
    return {
      locateQuestionId: question.id,
      structureId: target.id,
      // A muscle is named without an article everywhere else in the app
      // ("What is the origin of Deltoid?"); everything else takes one.
      prompt: `Which of these describes where ${isMuscle(target) ? '' : 'the '}${name} ${isPluralName(name) ? 'sit' : 'sits'}?`,
      choices,
      correctIndex: choices.indexOf(truth),
    };
  };

  return {
    build,
    describe: (structureId) => {
      const target = loadedById.get(structureId);
      const own = target ? askedParts(target) : [];
      return own.length ? render(own) : null;
    },
  };
}

export function isDescribedRegionQuestion(
  built: DescribedRegionQuestion | DescribedRegionGap | null | undefined,
): built is DescribedRegionQuestion {
  return !!built && typeof built !== 'string';
}
