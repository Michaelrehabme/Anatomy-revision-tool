import { areasOf, type AnatomyStructure } from '../../types/structure';
import { AREAS, type Area } from '../../types/region';
import {
  STRUCTURE_FACT_FIELDS,
  STRUCTURE_INDEX_FIELDS,
  type StructureFacts,
  type StructureIndexEntry,
} from '../../types/structureIndex';

/**
 * Cutting a structure into the part that is bundled and the part that is
 * served, and putting the two back together
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md).
 *
 * Pure, and with no Node in it, because both ends use it: buildContent.ts cuts
 * the seed here at build time, and the app joins a fetched area back onto the
 * index here once the facts are no longer in the bundle. Which field goes
 * where is NOT decided in this file — it reads the two lists in
 * types/structureIndex.ts, so there is one place to change and nothing here to
 * forget.
 *
 * `undefined` values are dropped on both sides rather than carried. JSON
 * cannot hold one, so a field present-but-undefined on a seed object would
 * vanish in the round trip anyway; dropping it here is what makes "the joined
 * structure equals the seed structure" a test that can pass.
 */

function pick(source: object, fields: readonly string[]): Record<string, unknown> {
  const from = source as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (from[field] !== undefined) out[field] = from[field];
  }
  return out;
}

/** The index entry for one structure: its index fields and the `hasDescription` flag, no facts. */
export function toIndexEntry(structure: AnatomyStructure): StructureIndexEntry {
  return {
    ...(pick(structure, STRUCTURE_INDEX_FIELDS) as unknown as StructureIndexEntry),
    hasDescription: structure.description.length > 0,
  };
}

/** One structure's facts, keyed by its id so they can be joined back. */
export function toFacts(structure: AnatomyStructure): StructureFacts {
  return { id: structure.id, ...pick(structure, STRUCTURE_FACT_FIELDS) };
}

/**
 * An index entry and its facts, as the structure they were cut from.
 *
 * The cast is the one place the wire shape becomes the app's type again. It
 * is sound because of the coverage tests, not because of anything the
 * compiler can see: they join every seed structure and compare it to the
 * original, so a field lost or invented on the way round fails there.
 */
export function joinFacts(entry: StructureIndexEntry, facts: StructureFacts): AnatomyStructure {
  if (entry.id !== facts.id) {
    throw new Error(`joinFacts: index entry "${entry.id}" was given the facts of "${facts.id}"`);
  }
  const joined: Record<string, unknown> = { ...entry, ...facts };
  // The flag stood in for the description while it was away.
  delete joined.hasDescription;
  return joined as unknown as AnatomyStructure;
}

export function buildStructureIndex(structures: readonly AnatomyStructure[]): StructureIndexEntry[] {
  return structures.map(toIndexEntry);
}

/** What one area's payload holds before the server stamps a version and a lease on it. */
export interface AreaFacts {
  area: Area;
  structures: StructureFacts[];
}

/**
 * The facts of every structure in each area, in seed order.
 *
 * A STRUCTURE IN SEVERAL AREAS IS IN EVERY ONE OF THEM, whole. A pedicle
 * revises under all three spine levels, and a student entitled to the lumbar
 * spine alone must get it with that one fetch. The duplication is the price —
 * 30 structures today — and it is why the join above is by id rather than by
 * position: the same facts can arrive twice and must land on one structure.
 *
 * Every area is present even when empty, so "the file is missing" always
 * means the build is broken and never "that area has nothing in it".
 */
export function buildAreaFacts(structures: readonly AnatomyStructure[]): Record<Area, AreaFacts> {
  const out = Object.fromEntries(AREAS.map((area) => [area, { area, structures: [] }])) as unknown as Record<
    Area,
    AreaFacts
  >;
  for (const structure of structures) {
    const facts = toFacts(structure);
    for (const area of areasOf(structure)) out[area].structures.push(facts);
  }
  return out;
}

/**
 * The structures whose facts are in hand: the index joined to whichever areas
 * have been loaded, in index order.
 *
 * A structure present in two loaded areas is joined once. One present in none
 * is left out — it is still in the index, and that is all the app knows of it.
 */
export function joinLoadedAreas(
  index: readonly StructureIndexEntry[],
  loaded: readonly AreaFacts[],
): AnatomyStructure[] {
  const factsById = new Map<string, StructureFacts>();
  for (const area of loaded) {
    for (const facts of area.structures) factsById.set(facts.id, facts);
  }
  const out: AnatomyStructure[] = [];
  for (const entry of index) {
    const facts = factsById.get(entry.id);
    if (facts) out.push(joinFacts(entry, facts));
  }
  return out;
}
