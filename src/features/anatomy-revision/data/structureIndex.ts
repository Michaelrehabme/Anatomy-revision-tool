import type { StructureIndexEntry } from '../types/structureIndex';
import { BUNDLED_CONTENT } from './content/bundledContent';

/**
 * Every structure, as its index entry: names, categories, areas, pictures —
 * no facts (types/structureIndex.ts).
 *
 * THE ONE PLACE code that needs no facts gets its structures from. Analytics,
 * the educator screens, achievements, mastery levels and the demo fixtures
 * count structures, name them and group them by region; none of them states
 * an origin or a nerve. They import this so that the compiler holds them to
 * that — a fact read through this type does not compile — and so that a build
 * which serves facts from the server (data/content/contentSource.ts) changes
 * what is behind this name and none of them.
 *
 * In a bundled build it IS the seed, seen through the narrower type: the same
 * objects, in the same order, at no cost in bytes. In a server or fixture
 * build it is the generated index JSON, which holds exactly these fields and
 * nothing else.
 */
export const STRUCTURE_INDEX: readonly StructureIndexEntry[] = BUNDLED_CONTENT.index;

/** The same, by id. For a name, a region, or the kinds of fact a structure has. */
export const STRUCTURE_INDEX_BY_ID: ReadonlyMap<string, StructureIndexEntry> = new Map(
  STRUCTURE_INDEX.map((s) => [s.id, s]),
);
