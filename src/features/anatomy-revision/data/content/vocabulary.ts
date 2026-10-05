import { areasOf, isMuscle, type AnatomyStructure } from '../../types/structure';
import { AREAS, type Area, type Region } from '../../types/region';
import { arteriesOf } from '../../lib/questionGenerators/bloodSupply';

/**
 * WRONG ANSWERS THAT BELONG TO NO STRUCTURE
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, "Distractors").
 *
 * A question about the knee needs wrong answers, and the best ones come from
 * the facts of neighbouring structures. Once facts are served per area a
 * student holds only the areas they are entitled to, and some questions run
 * out: "which artery is the primary supply of the ACL" takes its wrong answers
 * from OUTSIDE the knee on purpose (bloodSupply.ts — a neighbour's artery may
 * well supply the ACL too), and a student with the knee alone has nothing
 * outside the knee.
 *
 * This is what fills the gap: every nerve name, action tag and artery name in
 * the dataset, as bare sorted lists. (The design also asked for joint types,
 * myotome labels and special-test names. They were built and nothing read
 * them — those questions take their wrong answers from the session's own
 * pool, so one area loaded changes nothing for them — and a bundled list
 * nobody reads is a list given away for nothing. Dropped 5 Oct 2026.) It is bundled, so anyone can read it — and what they read is
 * a list of nerves. Nothing in it says which muscle a nerve supplies or which
 * bone an artery feeds; the pairing is the fact, and the pairing is not here.
 *
 * The arteries are the one list with any key at all: the area and the body
 * region of the structures that list them. Both are needed to keep a question
 * TRUE, not merely plausible. bloodSupply.ts never offers as a wrong answer an
 * artery that any structure sharing an area with the subject lists, because
 * the reviewed lists name the main vessels and a neighbour's artery may well
 * feed the subject too — and the femur is a hip structure and a knee one, so
 * a student holding the knee alone still needs the hip's arteries ruled out.
 * A flat list cannot say which those are. The region is what lets the wrong
 * answers come from the next area along rather than the other end of the body.
 * What the buckets give away is that the genicular arteries are found at the
 * knee, which is not something anyone pays to learn.
 *
 * Deliberately absent: origins, insertions, attachment and articulation
 * statements, action sentences, descriptions and palpation notes. Those are
 * sentences written for this product, and a sorted list of every origin in
 * the dataset is most of the dataset. Questions that need them draw on the
 * areas that are loaded and nothing else.
 */
export interface DistractorVocabulary {
  /** Nerve names as authored on muscles, the same strings indexes.byNerve is keyed by. */
  nerves: string[];
  /** Kebab-case action tags, the same strings indexes.byAction is keyed by. */
  actions: string[];
  /**
   * Artery names as authored, bracketed detail included, by the area and then
   * the region of the structures that list them. A structure in two areas
   * lists its arteries under both.
   */
  arteries: Record<Area, Partial<Record<Region, string[]>>>;
}

/** Sorted by code point, not locale: the bytes must not depend on the machine that built them. */
function sortedUnique<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function buildVocabulary(structures: readonly AnatomyStructure[]): DistractorVocabulary {
  const muscles = structures.filter(isMuscle);
  return {
    nerves: sortedUnique(muscles.flatMap((m) => m.nerve.map((n) => n.name))),
    actions: sortedUnique(muscles.flatMap((m) => m.actions)),
    arteries: arteriesByArea(structures),
  };
}

function arteriesByArea(structures: readonly AnatomyStructure[]): DistractorVocabulary['arteries'] {
  const out = Object.fromEntries(AREAS.map((area) => [area, {}])) as DistractorVocabulary['arteries'];
  for (const s of structures) {
    const names = arteriesOf(s);
    if (!names.length) continue;
    for (const area of areasOf(s)) (out[area][s.region] ??= []).push(...names);
  }
  for (const byRegion of Object.values(out)) {
    for (const region of Object.keys(byRegion) as Region[]) byRegion[region] = sortedUnique(byRegion[region]!);
  }
  return out;
}
