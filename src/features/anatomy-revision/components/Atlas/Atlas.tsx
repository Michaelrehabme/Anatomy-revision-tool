import { useEffect, useMemo, useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { StructureMastery } from '../../types/attempt';
import { isMuscle } from '../../types/structure';
import type { Region } from '../../types/region';
import { REGIONS, REGION_LABELS } from '../../types/region';
import { Button } from '../shared/Button';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

interface AtlasProps {
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onOpenMuscle: (structureId: string, contextIds: string[]) => void;
  /** Starts an OINA session over the muscles currently listed (CR-018). */
  onDrillOina: (structureIds: string[]) => void;
  onNavigate: (section: NavSection) => void;
}

export function Atlas({ content, repository, userId, onOpenMuscle, onDrillOina, onNavigate }: AtlasProps) {
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
    <AppShell
      sidebar={
        <NavSidebar
          active="atlas"
          onNavigate={onNavigate}
          footer={
            <>
              <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                Filter by region
              </div>
              <div className="mt-3.5 flex flex-col gap-px">
                <button
                  type="button"
                  onClick={() => setRegionFilter('all')}
                  className="py-2 text-left"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, color: regionFilter === 'all' ? 'var(--accd)' : 'var(--ink2)' }}
                >
                  All {muscles.length}
                </button>
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegionFilter(r)}
                    className="py-2 text-left"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, color: regionFilter === r ? 'var(--accd)' : 'var(--ink2)' }}
                  >
                    {REGION_LABELS[r]}
                  </button>
                ))}
              </div>
            </>
          }
        />
      }
    >
      <div className="flex h-screen min-h-0 flex-col px-14 pt-14">
        <div className="flex items-end gap-8">
          <div className="flex-1">
            <h2
              style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 44, lineHeight: 1.02, letterSpacing: '-.024em', margin: '0 0 8px' }}
            >
              Atlas
            </h2>
            <p style={{ color: 'var(--ink3)', fontSize: 15.5 }}>
              {muscles.length} muscles · showing {filtered.length}
              {query ? ` matching “${query}”` : ''}
            </p>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-[340px] flex-none rounded-[3px] px-4.5 py-3.5"
            style={{ fontFamily: 'var(--font-display)', fontSize: 19, border: '1.4px solid var(--acc)', background: 'var(--sf)', color: 'var(--ink)' }}
          />
          <Button
            onClick={() => onDrillOina(contextIds)}
            disabled={contextIds.length === 0}
            className="flex-none min-h-[54px] min-w-[190px]"
          >
            Drill these facts
          </Button>
        </div>
        <p className="mt-2.5" style={{ color: 'var(--ink3)', fontSize: 13.5 }}>
          Origin, insertion, nerve supply and action for the {filtered.length}{' '}
          {filtered.length === 1 ? 'muscle' : 'muscles'} listed below.
        </p>

        <div
          className="mt-7 flex gap-5 pb-3"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
        >
          <span className="w-[230px] flex-none">Muscle</span>
          <span className="w-[240px] flex-none">Origin</span>
          <span className="w-[230px] flex-none">Insertion</span>
          <span className="flex-1">Action</span>
          <span className="w-[88px] flex-none text-right">Mastery</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto pb-14">
          {filtered.map((m) => {
            const mastery = masteryByStructureId.get(m.id);
            const pct = mastery && mastery.attemptsTotal > 0 ? Math.round((mastery.attemptsCorrect / mastery.attemptsTotal) * 100) : null;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenMuscle(m.id, contextIds)}
                className="flex w-full items-baseline gap-5 py-3 text-left"
                style={{ borderTop: '1px solid var(--line)' }}
              >
                <span className="w-[230px] flex-none" style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
                  {m.name}
                </span>
                <span className="w-[240px] flex-none text-[14.5px] leading-snug" style={{ color: 'var(--ink2)' }}>
                  {m.origin.join('; ')}
                </span>
                <span className="w-[230px] flex-none text-[14.5px] leading-snug" style={{ color: 'var(--ink2)' }}>
                  {m.insertion.join('; ')}
                </span>
                <span className="flex-1 text-[14.5px] leading-snug" style={{ color: 'var(--ink2)' }}>
                  {m.actionText}
                </span>
                <span
                  className="w-[88px] flex-none text-right"
                  style={{ font: '500 13px/1 var(--font-mono)', color: pct === null ? 'var(--ink3)' : pct < 60 ? 'var(--acc2d)' : 'var(--accd)' }}
                >
                  {pct === null ? 'unseen' : `${pct}%`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
