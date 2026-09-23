import type { AnatomyStructure, Category } from '../types/structure';
import { areasOf } from '../types/structure';
import type { Area } from '../types/region';
import type { StructureMastery } from '../types/attempt';
import type { AtlasRow } from './atlasFacts';

/**
 * How the Atlas list is narrowed and ordered.
 *
 * The Atlas had three filters and no sort at all: it rendered in seed
 * concatenation order, which is 122 muscles, then 31 bones, then 133
 * landmarks, then 33 joints, then 143 ligaments, arbitrary within each kind.
 * That is fine for a table you read top to bottom and useless for the two
 * questions a student actually brings to an atlas mid-revision — "what have I
 * not met yet?" and "what am I worst at?".
 *
 * Pure functions, no React, so both atlas screens share one definition of
 * what a filter and a sort mean and cannot drift apart. The screens own the
 * state (hooks/useAtlasList.ts); this module owns the rules.
 */

export type SeenFilter = 'all' | 'seen' | 'unseen';
export type AtlasSortKey = 'body' | 'accuracy' | 'name' | 'seen';
export type SortDirection = 'asc' | 'desc';

export interface AtlasFilters {
  kind: Category | 'all';
  area: Area | 'all';
  seen: SeenFilter;
  query: string;
}

export const DEFAULT_FILTERS: AtlasFilters = { kind: 'all', area: 'all', seen: 'all', query: '' };

/**
 * Head-to-toe, for the "top -> bottom" sort.
 *
 * Deliberately NOT types/region.ts's AREAS, which is documented as
 * proximal-to-distal down the upper limb, then the lower limb, then the spine
 * — an order that puts the whole arm above the neck and the entire spine
 * below the foot. That is the right order for a picker grouped by limb and
 * the wrong one for a list claiming to run down the body.
 *
 * The interleaving is a judgement call about where a limb segment sits
 * relative to a vertebral level, not a fact the data model carries: there is
 * no coordinate, y-value or order index on AnatomyStructure. It is authored
 * here, once, so that the judgement is visible and editable in one place.
 */
export const AREA_ORDER_SUPERIOR_INFERIOR: Area[] = [
  'cervical-spine',
  'shoulder',
  'thoracic-spine',
  'elbow',
  'lumbar-spine',
  'wrist-hand',
  'hip',
  'knee',
  'ankle-foot',
];

/**
 * Where a structure sits head-to-toe: the index of its most superior area.
 *
 * The MINIMUM across areasOf(), not primaryAreaOf(). A level-agnostic
 * vertebral structure — a pedicle, the erector spinae — belongs to all three
 * spine areas, and the honest answer for "where does this start" is the
 * topmost one. primaryAreaOf returns whichever area happens to be first in
 * the authored array, which is not the same question.
 *
 * A structure with no areas at all sorts last rather than first: an unplaced
 * structure is a content gap, and floating it to the top of every list would
 * make that gap look like an anatomical claim.
 */
export function bodyRank(s: AnatomyStructure): number {
  let rank = Number.POSITIVE_INFINITY;
  for (const area of areasOf(s)) {
    const index = AREA_ORDER_SUPERIOR_INFERIOR.indexOf(area);
    if (index !== -1 && index < rank) rank = index;
  }
  return rank;
}

/**
 * Percent correct for one structure, or null when nothing has been graded.
 *
 * The one copy of a formula that was inlined identically at seven call sites.
 * Null rather than 0 because "never answered" and "answered and got every one
 * wrong" are different facts, and the Atlas has to render them differently —
 * see masteryState below.
 */
export function atlasAccuracy(mastery: StructureMastery | undefined): number | null {
  if (!mastery || mastery.attemptsTotal === 0) return null;
  return Math.round((mastery.attemptsCorrect / mastery.attemptsTotal) * 100);
}

export type AtlasMasteryState =
  | { kind: 'unseen' }
  | { kind: 'untested' }
  | { kind: 'scored'; pct: number };

/**
 * The three states the mastery column has to tell apart.
 *
 * The Atlas used to print "unseen" whenever attemptsTotal was 0, which
 * mislabels a structure the student HAS met: lib/ladder.ts markSeen() writes a
 * row with firstSeenAt and no attempts when a flashcard shows a structure.
 * With a seen/unseen filter on the same screen that conflation becomes a
 * visible contradiction — a row sitting under "seen" reading "unseen".
 *
 * "Seen" means a mastery row exists, which is the definition
 * hooks/useProgressData.ts already uses for the progress headline.
 */
export function masteryState(mastery: StructureMastery | undefined): AtlasMasteryState {
  if (!mastery) return { kind: 'unseen' };
  const pct = atlasAccuracy(mastery);
  return pct === null ? { kind: 'untested' } : { kind: 'scored', pct };
}

export function isSeen(structureId: string, masteryById: ReadonlyMap<string, StructureMastery>): boolean {
  return masteryById.has(structureId);
}

export function filterAtlas(
  structures: readonly AnatomyStructure[],
  rows: ReadonlyMap<string, AtlasRow>,
  filters: AtlasFilters,
  masteryById: ReadonlyMap<string, StructureMastery>,
): AnatomyStructure[] {
  const q = filters.query.trim().toLowerCase();
  return structures.filter((s) => {
    if (filters.kind !== 'all' && s.category !== filters.kind) return false;
    if (filters.area !== 'all' && !areasOf(s).includes(filters.area)) return false;
    if (filters.seen !== 'all' && isSeen(s.id, masteryById) !== (filters.seen === 'seen')) return false;
    if (!q) return true;
    return rows.get(s.id)?.searchText.includes(q) ?? false;
  });
}

/** Name, then id. Always ascending — see sortAtlas for why it is not reversed. */
function tiebreak(a: AnatomyStructure, b: AnatomyStructure): number {
  return a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en');
}

/**
 * Orders the list, with a stable tiebreak so equal keys never jitter between
 * renders.
 *
 * The direction is applied to the primary key ONLY; the name/id tiebreak
 * always runs ascending. So "bottom -> top" reverses the areas but still
 * reads A-Z inside each one, which is what someone scanning a region wants —
 * reversing the tiebreak too would shuffle names for no reason anybody asked
 * for. When the primary key IS the name, direction naturally governs it and
 * the tiebreak only settles genuine duplicates.
 */
export function sortAtlas(
  structures: readonly AnatomyStructure[],
  key: AtlasSortKey,
  direction: SortDirection,
  masteryById: ReadonlyMap<string, StructureMastery>,
): AnatomyStructure[] {
  const sign = direction === 'asc' ? 1 : -1;

  const primary = (a: AnatomyStructure, b: AnatomyStructure): number => {
    switch (key) {
      case 'body':
        return bodyRank(a) - bodyRank(b);
      case 'name':
        return a.name.localeCompare(b.name, 'en');
      case 'accuracy': {
        // No data counts as 0%, so "lowest first" doubles as a to-do list of
        // everything not yet studied rather than burying it under the scores.
        const pa = atlasAccuracy(masteryById.get(a.id)) ?? 0;
        const pb = atlasAccuracy(masteryById.get(b.id)) ?? 0;
        // Descending by default: "highest accuracy first" is the asc label.
        return pb - pa;
      }
      case 'seen': {
        const ma = masteryById.get(a.id);
        const mb = masteryById.get(b.id);
        // attemptsTotal is times ANSWERED. Nothing counts times shown, so a
        // flashcard-only structure has been met but scores 0 here; break that
        // tie in favour of the row that exists, so "seen least" ends on the
        // structures genuinely never met rather than mixing the two.
        const diff = (mb?.attemptsTotal ?? 0) - (ma?.attemptsTotal ?? 0);
        if (diff !== 0) return diff;
        return Number(Boolean(mb)) - Number(Boolean(ma));
      }
    }
  };

  return [...structures].sort((a, b) => primary(a, b) * sign || tiebreak(a, b));
}

export interface AtlasSortOption {
  id: string;
  key: AtlasSortKey;
  direction: SortDirection;
  label: string;
}

/**
 * Every sort, both ways round, labelled as a student would say it rather than
 * as ascending/descending — "seen least -> most" is meaningful where
 * "attemptsTotal, ascending" is not.
 */
export const ATLAS_SORTS: AtlasSortOption[] = [
  { id: 'body-asc', key: 'body', direction: 'asc', label: 'Top → bottom' },
  { id: 'body-desc', key: 'body', direction: 'desc', label: 'Bottom → top' },
  { id: 'accuracy-asc', key: 'accuracy', direction: 'asc', label: 'Highest accuracy first' },
  { id: 'accuracy-desc', key: 'accuracy', direction: 'desc', label: 'Lowest accuracy first' },
  { id: 'name-asc', key: 'name', direction: 'asc', label: 'A–Z' },
  { id: 'name-desc', key: 'name', direction: 'desc', label: 'Z–A' },
  { id: 'seen-asc', key: 'seen', direction: 'asc', label: 'Seen most → least' },
  { id: 'seen-desc', key: 'seen', direction: 'desc', label: 'Seen least → most' },
];

/**
 * Head-to-toe, which is the order an anatomy list is most often wanted in and
 * the one the previous arbitrary seed order came closest to pretending to be.
 */
export const DEFAULT_SORT_ID = 'body-asc';

export function sortById(id: string): AtlasSortOption {
  return ATLAS_SORTS.find((s) => s.id === id) ?? ATLAS_SORTS.find((s) => s.id === DEFAULT_SORT_ID)!;
}

/**
 * How many filters are narrowing the list, for the badge on the panel's
 * trigger. The sort is not counted: a sort hides nothing, and a badge that
 * implies otherwise would send people hunting for a filter that isn't set.
 */
export function activeFilterCount(filters: AtlasFilters): number {
  let count = 0;
  if (filters.kind !== 'all') count++;
  if (filters.area !== 'all') count++;
  if (filters.seen !== 'all') count++;
  if (filters.query.trim()) count++;
  return count;
}

export const SEEN_FILTER_LABELS: Record<SeenFilter, string> = {
  all: 'All',
  seen: 'Seen',
  unseen: 'Unseen',
};
