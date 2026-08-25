import type { AnatomyStructure } from '../types/structure';
import { isMuscle } from '../types/structure';
import type { Category, Difficulty } from '../types/structure';
import type { Region, SubRegion } from '../types/region';

export interface StructureIndexes {
  /** Nerve name -> muscle ids innervated by it. Mirrors muscles.json's indexes.byNerve. */
  byNerve: Map<string, string[]>;
  /** Action tag -> muscle ids that perform it. Mirrors muscles.json's indexes.byAction. */
  byAction: Map<string, string[]>;
  /** Functional/anatomical group -> structure ids in it (all categories). */
  byGroup: Map<string, string[]>;
  byRegion: Map<Region, string[]>;
  byCategory: Map<Category, string[]>;
  /** Fast id -> structure lookup, used throughout the generators. */
  byId: Map<string, AnatomyStructure>;
}

function pushTo(map: Map<string, string[]>, key: string, id: string) {
  const existing = map.get(key);
  if (existing) existing.push(id);
  else map.set(key, [id]);
}

export function buildIndexes(structures: AnatomyStructure[]): StructureIndexes {
  const byNerve = new Map<string, string[]>();
  const byAction = new Map<string, string[]>();
  const byGroup = new Map<string, string[]>();
  const byRegion = new Map<Region, string[]>();
  const byCategory = new Map<Category, string[]>();
  const byId = new Map<string, AnatomyStructure>();

  for (const s of structures) {
    byId.set(s.id, s);
    pushTo(byRegion as Map<string, string[]>, s.region, s.id);
    pushTo(byCategory as Map<string, string[]>, s.category, s.id);
    for (const g of s.groups ?? []) pushTo(byGroup, g, s.id);

    if (isMuscle(s)) {
      for (const n of s.nerve) pushTo(byNerve, n.name, s.id);
      for (const a of s.actions) pushTo(byAction, a, s.id);
    }
  }

  return { byNerve, byAction, byGroup, byRegion, byCategory, byId };
}

export interface StructureFilter {
  category?: Category;
  region?: Region;
  /** OR-matched against s.region; takes precedence over `region` when non-empty. Empty/undefined = no region filter. */
  regions?: Region[];
  subregion?: SubRegion;
  difficulty?: Difficulty;
}

export function filterStructures(
  structures: AnatomyStructure[],
  filter?: StructureFilter,
): AnatomyStructure[] {
  if (!filter) return structures;
  const regionMatch = (region: Region) =>
    filter.regions?.length ? filter.regions.includes(region) : !filter.region || region === filter.region;
  return structures.filter(
    (s) =>
      (!filter.category || s.category === filter.category) &&
      regionMatch(s.region) &&
      (!filter.subregion || s.subregion === filter.subregion) &&
      (!filter.difficulty || s.difficulty === filter.difficulty),
  );
}
