import type { StructureIndexEntry } from '../types/structureIndex';
import { ALL_STRUCTURES } from './seed';

/**
 * Every structure, as its index entry: names, categories, areas, pictures —
 * no facts (types/structureIndex.ts).
 *
 * THE ONE PLACE code that needs no facts gets its structures from. Analytics,
 * the educator screens, achievements and the demo fixtures count structures,
 * name them and group them by region; none of them states an origin or a
 * nerve. They import this rather than ALL_STRUCTURES so that the compiler
 * holds them to that — a fact read through this type does not compile — and
 * so that taking the facts out of the bundle
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 7) changes this file and none of
 * theirs.
 *
 * Today it IS the seed, seen through a narrower type: the same objects, in the
 * same order, at no cost in bytes. When the seed leaves the app this becomes
 * the generated index JSON that buildContent.ts writes, which holds exactly
 * these fields and nothing else.
 */
export const STRUCTURE_INDEX: readonly StructureIndexEntry[] = ALL_STRUCTURES;
