import type { AnatomyStructure } from '../types/structure';
import { isMuscle, areasOf } from '../types/structure';
import type { Category, Difficulty } from '../types/structure';
import type { Area, Region, SubRegion } from '../types/region';

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
  /**
   * OR-matched against s.category; takes precedence over `category` when
   * non-empty. Empty/undefined = no category filter. Bones and landmarks are
   * the pair this exists for — the same picture, revised together.
   */
  categories?: Category[];
  region?: Region;
  /** OR-matched against s.region; takes precedence over `region` when non-empty. Empty/undefined = no region filter. */
  regions?: Region[];
  subregion?: SubRegion;
  /**
   * OR-matched against the structure's areas (CR-017). A structure spanning several
   * areas (a pedicle is cervical, thoracic and lumbar — CR-032) matches any of them.
   * Empty/undefined = no area filter.
   */
  areas?: Area[];
  /**
   * OR-matched against the structure's `groups` (CR-018) — the axis OINA
   * sessions target, since "the hamstrings" is how a student thinks about
   * which attachments to drill. Note this cannot be served by the byGroup
   * index: filterStructures takes a plain array and never sees StructureIndexes.
   */
  groups?: string[];
  difficulty?: Difficulty;
}

export function filterStructures(
  structures: AnatomyStructure[],
  filter?: StructureFilter,
): AnatomyStructure[] {
  if (!filter) return structures;
  const regionMatch = (region: Region) =>
    filter.regions?.length ? filter.regions.includes(region) : !filter.region || region === filter.region;
  const areaMatch = (s: AnatomyStructure) => {
    if (!filter.areas?.length) return true;
    return areasOf(s).some((area) => filter.areas!.includes(area));
  };
  const groupMatch = (s: AnatomyStructure) =>
    !filter.groups?.length || (s.groups ?? []).some((g) => filter.groups!.includes(g));
  const categoryMatch = (category: Category) =>
    filter.categories?.length ? filter.categories.includes(category) : !filter.category || category === filter.category;
  return structures.filter(
    (s) =>
      categoryMatch(s.category) &&
      regionMatch(s.region) &&
      (!filter.subregion || s.subregion === filter.subregion) &&
      areaMatch(s) &&
      groupMatch(s) &&
      (!filter.difficulty || s.difficulty === filter.difficulty),
  );
}
