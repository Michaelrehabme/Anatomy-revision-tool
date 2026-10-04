import type { AnatomyStructure } from '../types/structure';
import type { StructureIndexEntry } from '../types/structureIndex';
import type { AnatomyImageAsset } from '../types/image';
import type { LocateQuestion } from '../types/question';
import {
  createDescribedRegionBuilder,
  isDescribedRegionQuestion,
  type DescribedRegionBuilder,
  type DescribedRegionQuestion,
} from './questionGenerators/describedRegion';
import { buildLocateList } from './questionGenerators/locateList';

/**
 * The two ways a locate question is answered WITHOUT the picture, built
 * together for one question (docs/accessibility-locate.md):
 *
 *   described  the question asked in words — four descriptions, one true —
 *              wherever the seed can support it;
 *   list       the list of names, never fewer than four, for the rest.
 *
 * A screen shows `described` when there is one and `list` when there is not.
 *
 * This module, and the two generators behind it, are reached only through
 * import() from hooks/useLocateRoutes.ts. The entry chunk is within a few per
 * cent of the 2 MiB a service worker will precache (vite.config.ts), and
 * nothing here is needed until a locate question is on screen.
 */
export interface LocateRoutes {
  described: DescribedRegionQuestion | null;
  /** What the right description is, for the answer panel. Null when there is no described question. */
  describedAnswer: string | null;
  list: { id: string; name: string }[];
}

// One builder per catalogue: it indexes every loaded structure, and a session
// asks it about one locate question after another.
const builders = new WeakMap<object, DescribedRegionBuilder>();

export function buildLocateRoutes(
  question: LocateQuestion,
  /** The opening picture and every angle the student may turn to. */
  frames: readonly AnatomyImageAsset[],
  /** The structures whose facts are loaded, as the session holds them. */
  structuresById: ReadonlyMap<string, AnatomyStructure>,
  /** Every structure, for names. */
  index: readonly StructureIndexEntry[],
): LocateRoutes {
  let builder = builders.get(structuresById);
  if (!builder) {
    builder = createDescribedRegionBuilder({ loaded: [...structuresById.values()], index });
    builders.set(structuresById, builder);
  }
  const built = builder.build(question);
  const described = isDescribedRegionQuestion(built) ? built : null;
  return {
    described,
    describedAnswer: described ? described.choices[described.correctIndex] : null,
    list: buildLocateList(question, frames, index).map((s) => ({ id: s.id, name: s.name })),
  };
}
