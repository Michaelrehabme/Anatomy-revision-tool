import { useEffect, useMemo, useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { StructureMastery } from '../../types/attempt';
import { isMuscle } from '../../types/structure';
import type { Region } from '../../types/region';
import { REGIONS, REGION_LABELS } from '../../types/region';
import { MobileShell } from './MobileShell';
import type { MobileTab } from './MobileTabBar';

interface MobileAtlasProps {
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onOpenMuscle: (structureId: string, contextIds: string[]) => void;
  /** Starts an OINA session over the muscles currently listed (CR-018). */
  onDrillOina: (structureIds: string[]) => void;
  onBack: () => void;
  onNavigateTab: (tab: MobileTab) => void;
}

/**
 * The mobile counterpart to the desktop Atlas table (CR-018). Mobile had no
 * browsable muscle list at all — MobileTabBar's own comment noted that its
 * "Atlas" tab pointed at the area picker because no such screen existed —
 * which meant the whole point of OINA Cards, studying a muscle's facts from
 * the atlas, was desktop-only.
 *
 * A stacked list rather than the desktop's five-column table: origin and
 * insertion are the two facts worth showing at a glance on a phone, and
 * nerve/action are one tap away on the muscle card.
 */
export function MobileAtlas({
  content,
  repository,
  userId,
  onOpenMuscle,
  onDrillOina,
  onBack,
  onNavigateTab,
}: MobileAtlasProps) {
  const [regionFilter, setRegionFilter] = useState<Region | 'all'>('all');
  const [query, setQuery] = useState('');
  const [masteryByStructureId, setMasteryByStructureId] = useState<Map<string, StructureMastery>>(new Map());

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    repository.listMastery(userId).then((all) => {
      if (!cancelled) setMasteryByStructureId(new Map(all.map((m) => [m.structureId, m])));
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  const muscles = useMemo(() => content.structures.filter(isMuscle), [content.structures]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return muscles.filter((m) => {
      if (regionFilter !== 'all' && m.region !== regionFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.groups?.some((g) => g.toLowerCase().includes(q)) ||
        m.actionText.toLowerCase().includes(q)
      );
    });
  }, [muscles, regionFilter, query]);

  const contextIds = filtered.map((m) => m.id);

  return (
    <MobileShell tabs={{ active: 'atlas', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4 pb-6">
        <button type="button" onClick={onBack} className="border-0 bg-transparent p-0 pb-2.5" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
          &larr; Today
        </button>
        <h2
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30, lineHeight: 1.05, letterSpacing: '-.02em', margin: '2px 0 5px' }}
        >
          Atlas
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink3)' }}>
          {muscles.length} muscles · showing {filtered.length}
          {query ? ` matching “${query}”` : ''}
        </p>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search muscles…"
          aria-label="Search muscles"
          className="mt-4 w-full rounded-[3px] px-4"
          style={{
            minHeight: 50,
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            border: '1.4px solid var(--acc)',
            background: 'var(--sf)',
            color: 'var(--ink)',
          }}
        />

        <div className="mt-3.5 flex flex-wrap gap-2">
          {(['all', ...REGIONS] as const).map((r) => {
            const on = regionFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRegionFilter(r)}
                aria-pressed={on}
                className="inline-flex min-h-[38px] items-center justify-center rounded-full px-3.5"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14.5,
                  border: on ? '1.2px solid var(--acc)' : '1.2px solid var(--line)',
                  background: on ? 'var(--accs)' : 'transparent',
                  color: on ? 'var(--accd)' : 'var(--ink2)',
                }}
              >
                {r === 'all' ? 'All' : REGION_LABELS[r]}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onDrillOina(contextIds)}
          disabled={contextIds.length === 0}
          className="mt-4 w-full rounded-[3px] border-0 disabled:opacity-50"
          style={{ minHeight: 52, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
        >
          Drill these facts
        </button>
        <p className="mt-2 text-center" style={{ font: '400 11.5px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
          Origin, insertion, nerve &amp; action
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {filtered.map((m) => {
            const mastery = masteryByStructureId.get(m.id);
            const pct =
              mastery && mastery.attemptsTotal > 0
                ? Math.round((mastery.attemptsCorrect / mastery.attemptsTotal) * 100)
                : null;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenMuscle(m.id, contextIds)}
                className="w-full rounded-[3px] p-4 text-left"
                style={{ border: '1.2px solid var(--line)', background: 'var(--sf)' }}
              >
                <div className="flex items-baseline gap-2.5">
                  <span
                    className="flex-1"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.15, color: 'var(--ink)' }}
                  >
                    {m.name}
                  </span>
                  <span style={{ font: '500 11.5px/1 var(--font-mono)', color: pct === null ? 'var(--ink3)' : 'var(--accd)' }}>
                    {pct === null ? '—' : `${pct}%`}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink2)' }}>
                    <span style={{ color: 'var(--ink3)' }}>O · </span>
                    {m.origin.join('; ')}
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink2)' }}>
                    <span style={{ color: 'var(--ink3)' }}>I · </span>
                    {m.insertion.join('; ')}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
              No muscles match that search.
            </p>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
