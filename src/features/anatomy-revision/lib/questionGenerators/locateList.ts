import { areasOf } from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { AnatomyImageAsset } from '../../types/image';
import type { LocateQuestion } from '../../types/question';
import { createRng, shuffle } from '../rng';
import { plainStructureName, seedFromId } from './describedRegion';

/**
 * THE LIST OF NAMES a locate question falls back to when it cannot be asked
 * in words (describedRegion.ts) — docs/accessibility-locate.md, option A.
 *
 * It used to be "every structure the plate carries a hotspot for", and a
 * landmark or joint plate carries one: 212 of the locate questions offered a
 * list with a single name in it, the answer. That is not an easier question,
 * it is not a question. So a list is never shorter than MIN_LIST_NAMES: where
 * the plate holds fewer, it is made up with other structures of the same
 * category, nearest first — the asked structure's own area, then its region,
 * then anywhere.
 *
 * A plate that already shows four or more keeps exactly the list it had.
 *
 * Names are index data, so this needs no facts loaded and can always reach
 * the whole dataset: the "unless the pool is smaller" case does not arise
 * while a category has four structures in it, and every category has.
 *
 * In name order, as before. The made-up names are drawn with a seed taken
 * from the question's id, so one question always offers the same list, and
 * where the answer falls in it depends on the alphabet and on which
 * neighbours were drawn — not on anything a student could learn to expect.
 *
 * It is still a test of recognising a name, not of where anything is. It is
 * here so that no question is unanswerable without the picture, and it says
 * no more than that about itself.
 */
export const MIN_LIST_NAMES = 4;

export function buildLocateList(
  question: Pick<LocateQuestion, 'id' | 'targetStructureId'>,
  /** The opening picture and every angle the student may turn to. */
  frames: readonly AnatomyImageAsset[],
  index: readonly StructureIndexEntry[],
): StructureIndexEntry[] {
  const byId = new Map(index.map((s) => [s.id, s]));
  const target = byId.get(question.targetStructureId);
  const onPlate = [...new Set(frames.flatMap((f) => (f.hotspots ?? []).map((h) => h.structureId)))]
    .map((id) => byId.get(id))
    .filter((s): s is StructureIndexEntry => !!s);
  // The answer is always offered, whatever the pictures do or do not carry.
  const list = target && !onPlate.includes(target) ? [target, ...onPlate] : onPlate;

  if (target && list.length < MIN_LIST_NAMES) {
    const taken = new Set(list.map((s) => s.id));
    const names = new Set(list.map((s) => plainStructureName(s.name).toLowerCase()));
    const areas = new Set(areasOf(target));
    const others = index.filter((s) => s.category === target.category && !taken.has(s.id));
    const tiers = [
      others.filter((s) => areasOf(s).some((a) => areas.has(a))),
      others.filter((s) => s.region === target.region),
      others,
    ];
    const rng = createRng(seedFromId(question.id));
    for (const tier of tiers) {
      for (const s of shuffle(tier, rng)) {
        if (list.length >= MIN_LIST_NAMES) break;
        const name = plainStructureName(s.name).toLowerCase();
        // Two buttons reading the same would be a coin toss, not a choice.
        if (taken.has(s.id) || names.has(name)) continue;
        taken.add(s.id);
        names.add(name);
        list.push(s);
      }
    }
  }

  return [...list].sort((x, y) => x.name.localeCompare(y.name));
}
