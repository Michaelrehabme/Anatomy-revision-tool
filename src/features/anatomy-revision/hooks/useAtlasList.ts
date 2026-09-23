import { useCallback, useMemo, useState } from 'react';
import type { AnatomyContent } from './useAnatomyContent';
import type { AnatomyRepository } from '../data/repository';
import type { UseEntitlement } from './useEntitlement';
import type { AnatomyStructure, Category } from '../types/structure';
import { areasOf, isMuscle } from '../types/structure';
import { AREAS, type Area } from '../types/region';
import { atlasRow, type AtlasRow } from '../lib/atlasFacts';
import {
  ATLAS_SORTS,
  DEFAULT_FILTERS,
  activeFilterCount,
  filterAtlas,
  sortAtlas,
  sortById,
  type AtlasFilters,
  type SeenFilter,
} from '../lib/atlasList';
import { getAtlasSortId, setAtlasSortId } from '../lib/preferences';
import { useMastery } from './useMastery';
import type { StructureMastery } from '../types/attempt';

interface UseAtlasListArgs {
  access: UseEntitlement;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
}

export interface AreaOption {
  area: Area;
  /** How many entitled structures this area holds — 0 when the area is locked. */
  count: number;
  locked: boolean;
}

export interface UseAtlasList {
  /** Every structure this account may reach, before any filter. */
  entitled: AnatomyStructure[];
  rows: ReadonlyMap<string, AtlasRow>;
  masteryById: ReadonlyMap<string, StructureMastery>;
  /** Filtered and sorted — what the screen renders, in the order it renders it. */
  visible: AnatomyStructure[];
  filters: AtlasFilters;
  sortId: string;
  activeCount: number;
  /** Per-kind counts for the chip row, over entitled structures. */
  kindCounts: Record<Category | 'all', number>;
  areaOptions: AreaOption[];
  contextIds: string[];
  muscleIds: string[];
  setKind: (kind: Category | 'all') => void;
  setArea: (area: Area | 'all') => void;
  setSeen: (seen: SeenFilter) => void;
  setQuery: (query: string) => void;
  setSortId: (id: string) => void;
  clearFilters: () => void;
}

/**
 * The atlas list, shared by the desktop and mobile screens.
 *
 * Both screens used to hold their own copy of the filters, their own mastery
 * fetch and their own filter memo — four duplicated blocks that had already
 * drifted once (desktop showed per-kind counts, mobile did not). Adding a
 * seen filter and eight sorts to that arrangement would have meant writing
 * every one of them twice.
 *
 * The screens still own their own layout and their own panel presentation,
 * which genuinely differ: a column that collapses beside a table is not a
 * modal drawer over a card list.
 */
export function useAtlasList({ access, content, repository, userId }: UseAtlasListArgs): UseAtlasList {
  const [filters, setFilters] = useState<AtlasFilters>(DEFAULT_FILTERS);
  // Resolved through sortById so a stale or hand-edited stored id falls back
  // to the default rather than leaving the list in no order at all.
  const [sortId, setSortIdState] = useState(() => sortById(getAtlasSortId() ?? '').id);

  const mastery = useMastery(repository, userId);
  const masteryById = useMemo(() => new Map(mastery.map((m) => [m.structureId, m])), [mastery]);

  const entitled = useMemo(
    () => content.structures.filter((s) => areasOf(s).some((a) => access.areas.includes(a))),
    [content.structures, access.areas],
  );

  const rows = useMemo(
    () => new Map(entitled.map((s) => [s.id, atlasRow(s, content.structuresById)])),
    [entitled, content.structuresById],
  );

  const visible = useMemo(() => {
    const matched = filterAtlas(entitled, rows, filters, masteryById);
    const { key, direction } = sortById(sortId);
    return sortAtlas(matched, key, direction, masteryById);
  }, [entitled, rows, filters, masteryById, sortId]);

  const kindCounts = useMemo(() => {
    const counts = { all: entitled.length } as Record<Category | 'all', number>;
    for (const s of entitled) counts[s.category] = (counts[s.category] ?? 0) + 1;
    return counts;
  }, [entitled]);

  /**
   * Counts come from `entitled`, so a locked area reads 0 and carries a lock
   * rather than silently returning an empty list when picked. Both screens
   * previously offered all nine areas unconditionally while the list itself
   * was clamped to the entitled ones.
   */
  const areaOptions = useMemo<AreaOption[]>(() => {
    const counts = new Map<Area, number>();
    for (const s of entitled) for (const a of areasOf(s)) counts.set(a, (counts.get(a) ?? 0) + 1);
    return AREAS.map((area) => ({
      area,
      count: counts.get(area) ?? 0,
      locked: !access.areas.includes(area),
    }));
  }, [entitled, access.areas]);

  const contextIds = useMemo(() => visible.map((s) => s.id), [visible]);
  const muscleIds = useMemo(() => visible.filter(isMuscle).map((s) => s.id), [visible]);

  const setSortId = useCallback((id: string) => {
    const resolved = sortById(id).id;
    setSortIdState(resolved);
    setAtlasSortId(resolved);
  }, []);

  return {
    entitled,
    rows,
    masteryById,
    visible,
    filters,
    sortId,
    activeCount: activeFilterCount(filters),
    kindCounts,
    areaOptions,
    contextIds,
    muscleIds,
    setKind: useCallback((kind) => setFilters((f) => ({ ...f, kind })), []),
    setArea: useCallback((area) => setFilters((f) => ({ ...f, area })), []),
    setSeen: useCallback((seen) => setFilters((f) => ({ ...f, seen })), []),
    setQuery: useCallback((query) => setFilters((f) => ({ ...f, query })), []),
    setSortId,
    clearFilters: useCallback(() => setFilters(DEFAULT_FILTERS), []),
  };
}

export { ATLAS_SORTS };
