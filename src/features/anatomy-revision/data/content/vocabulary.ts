import { isJoint, isMuscle, type AnatomyStructure, type JointType } from '../../types/structure';
import { REGIONS, type Region } from '../../types/region';
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
 * This is what fills the gap: every nerve name, action tag, joint type,
 * myotome label, special-test name and artery name in the dataset, as bare
 * sorted lists. It is bundled, so anyone can read it — and what they read is
 * a list of nerves. Nothing in it says which muscle a nerve supplies or which
 * bone an artery feeds; the pairing is the fact, and the pairing is not here.
 *
 * The arteries are the one list with any key at all, the body region their
 * structures sit in. bloodSupply.ts prefers a wrong artery from the same
 * region (the hip, for a knee question) because one from the other end of the
 * body is a giveaway, and it cannot keep doing that from a flat list. A region
 * is five buckets over a few hundred vessels; it says the femoral artery is
 * somewhere in the lower limb, which is not something anyone pays to learn.
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
  /** The joint classifications in use. Shown through JOINT_TYPE_LABELS. */
  jointTypes: JointType[];
  /** Myotome labels as a question shows them: "C5/C6". */
  myotomes: string[];
  specialTests: string[];
  /** Artery names as authored, bracketed detail included, by the region of the structures that list them. */
  arteries: Record<Region, string[]>;
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
    jointTypes: sortedUnique(structures.filter(isJoint).map((j) => j.jointType)),
    myotomes: sortedUnique(structures.flatMap((s) => (s.myotome?.length ? [s.myotome.join('/')] : []))),
    specialTests: sortedUnique(structures.flatMap((s) => (s.specialTests ?? []).map((t) => t.name))),
    arteries: Object.fromEntries(
      REGIONS.map((region) => [
        region,
        // Landmarks carry no blood supply of their own to ask about (they are
        // parts of bones), so their lists never reach a question either.
        sortedUnique(structures.filter((s) => s.region === region && s.category !== 'landmark').flatMap(arteriesOf)),
      ]),
    ) as Record<Region, string[]>,
  };
}
