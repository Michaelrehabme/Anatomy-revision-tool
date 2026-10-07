import { useMemo, useState } from 'react';
import type { UserAttempt } from '../types/attempt';
import type { Area } from '../types/region';
import { areasOf } from '../types/structure';
import type { AnatomyContent } from './useAnatomyContent';
import {
  filteredAccuracy,
  NO_PROGRESS_FILTER,
  progressFilterCounts,
  type AnswerFormat,
  type FilterCounts,
  type FilteredAccuracy,
  type ProgressFilter,
} from '../lib/attemptFilter';

export interface UseAccuracyFilter {
  filter: ProgressFilter;
  toggleFormat: (format: AnswerFormat) => void;
  toggleArea: (area: Area) => void;
  /** The most recent this-many answers, or null for all time. */
  setLast: (last: number | null) => void;
  clear: () => void;
  counts: FilterCounts;
  result: FilteredAccuracy;
}

function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

/** The account page's accuracy filters and what they leave (desktop and mobile). `graded` is gradedAttempts' output. */
export function useAccuracyFilter(graded: UserAttempt[], content: AnatomyContent): UseAccuracyFilter {
  const [filter, setFilter] = useState<ProgressFilter>(NO_PROGRESS_FILTER);
  const areasByStructure = useMemo(() => new Map(content.structures.map((s) => [s.id, areasOf(s)])), [content.structures]);
  const counts = useMemo(() => progressFilterCounts(graded, areasByStructure), [graded, areasByStructure]);
  const result = useMemo(() => filteredAccuracy(graded, filter, areasByStructure), [graded, filter, areasByStructure]);

  return {
    filter,
    toggleFormat: (format) => setFilter((f) => ({ ...f, formats: toggled(f.formats, format) })),
    toggleArea: (area) => setFilter((f) => ({ ...f, areas: toggled(f.areas, area) })),
    setLast: (last) => setFilter((f) => ({ ...f, last })),
    clear: () => setFilter(NO_PROGRESS_FILTER),
    counts,
    result,
  };
}
