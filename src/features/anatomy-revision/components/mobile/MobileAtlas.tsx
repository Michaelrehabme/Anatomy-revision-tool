import { useEffect, useMemo, useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { StructureMastery } from '../../types/attempt';
import { CATEGORY_LABELS, areasOf, isMuscle, type Category } from '../../types/structure';
import type { Area } from '../../types/region';
import { AREAS, AREA_LABELS } from '../../types/region';
import { ATLAS_KINDS, atlasRow } from '../../lib/atlasFacts';
import { UnlockNote } from '../shared/AreaLock';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { MobileShell } from './MobileShell';
import type { MobileTab } from './MobileTabBar';

interface MobileAtlasProps {
  /** What this account may reach — see Atlas.tsx for why the list itself is clamped. */
  access: UseEntitlement;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onOpenMuscle: (structureId: string, contextIds: string[]) => void;
  /** Starts an OINA session over the muscles currently listed (CR-018). */
  onDrillOina: (structureIds: string[]) => void;
  /** Starts a mixed quiz over everything currently listed, whatever its kind. */
  onQuizStructures: (structureIds: string[]) => void;
  onBack: () => void;
  onNavigateTab: (tab: MobileTab) => void;
}

const chip = (on: boolean) => ({
  fontFamily: 'var(--font-display)',
  fontSize: 14.5,
  border: on ? '1.2px solid var(--acc)' : '1.2px solid var(--line)',
  background: on ? 'var(--accs)' : 'transparent',
  color: on ? 'var(--accd)' : 'var(--ink2)',
});

/**
 * The mobile counterpart to the desktop Atlas (CR-018), now for every kind
 * of structure rather than muscles alone — see Atlas.tsx.
 *
 * A stacked list rather than the desktop's table: two facts at a glance (a
 * muscle's origin and insertion, a ligament's attachments and the joint it
 * stabilises), the rest one tap away on the structure card.
 */
export function MobileAtlas({
  access,
  content,
  repository,
  userId,
  onOpenMuscle,
  onDrillOina,
  onQuizStructures,
  onBack,
  onNavigateTab,
}: MobileAtlasProps) {
  const [areaFilter, setAreaFilter] = useState<Area | 'all'>('all');
  const [kind, setKind] = useState<Category | 'all'>('all');
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

  const entitled = useMemo(
    () => content.structures.filter((s) => areasOf(s).some((a) => access.areas.includes(a))),
    [content.structures, access.areas],
  );
  const rows = useMemo(
    () => new Map(entitled.map((s) => [s.id, atlasRow(s, content.structuresById)])),
    [entitled, content.structuresById],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entitled.filter((s) => {
      if (kind !== 'all' && s.category !== kind) return false;
      if (areaFilter !== 'all' && !areasOf(s).includes(areaFilter)) return false;
      if (!q) return true;
      return rows.get(s.id)!.searchText.includes(q);
    });
  }, [entitled, rows, kind, areaFilter, query]);

  const contextIds = filtered.map((s) => s.id);
  const muscleIds = filtered.filter(isMuscle).map((s) => s.id);

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
          {entitled.length} structures · showing {filtered.length}
          {query ? ` matching “${query}”` : ''}
        </p>
        <UnlockNote access={access} className="mt-1.5" />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search structures…"
          aria-label="Search structures"
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
          {ATLAS_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className="inline-flex min-h-[38px] items-center justify-center rounded-full px-3.5"
              style={chip(kind === k)}
            >
              {k === 'all' ? 'All kinds' : CATEGORY_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['all', ...AREAS] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAreaFilter(a)}
              aria-pressed={areaFilter === a}
              className="inline-flex min-h-[38px] items-center justify-center rounded-full px-3.5"
              style={chip(areaFilter === a)}
            >
              {a === 'all' ? 'All areas' : AREA_LABELS[a]}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => onQuizStructures(contextIds)}
            disabled={contextIds.length === 0}
            className="flex-1 rounded-[3px] disabled:opacity-50"
            style={{ minHeight: 52, background: 'transparent', border: '1.4px solid var(--acc)', color: 'var(--accd)', font: '500 16px/1 var(--font-ui)' }}
          >
            Quiz these
          </button>
          <button
            type="button"
            onClick={() => onDrillOina(muscleIds)}
            disabled={muscleIds.length === 0}
            className="flex-1 rounded-[3px] border-0 disabled:opacity-50"
            style={{ minHeight: 52, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16px/1 var(--font-ui)' }}
          >
            Drill these facts
          </button>
        </div>
        <p className="mt-2 text-center" style={{ font: '400 11.5px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
          {muscleIds.length > 0 ? 'Facts drill the muscles listed · quiz asks every kind' : 'Quiz asks every kind listed'}
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {filtered.map((s) => {
            const mastery = masteryByStructureId.get(s.id);
            const pct =
              mastery && mastery.attemptsTotal > 0
                ? Math.round((mastery.attemptsCorrect / mastery.attemptsTotal) * 100)
                : null;
            const { columns } = rows.get(s.id)!;
            const shown = columns.filter((c) => c.text).slice(0, 2);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenMuscle(s.id, contextIds)}
                className="w-full rounded-[3px] p-4 text-left"
                style={{ border: '1.2px solid var(--line)', background: 'var(--sf)' }}
              >
                <div className="flex items-baseline gap-2.5">
                  <span
                    className="flex-1"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.15, color: 'var(--ink)' }}
                  >
                    {s.name}
                  </span>
                  {kind === 'all' && (
                    <span style={{ font: '400 10.5px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                      {s.category}
                    </span>
                  )}
                  <span style={{ font: '500 11.5px/1 var(--font-mono)', color: pct === null ? 'var(--ink3)' : 'var(--accd)' }}>
                    {pct === null ? '—' : `${pct}%`}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {shown.map((c) => (
                    <span key={c.label} style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink2)' }}>
                      <span style={{ color: 'var(--ink3)' }}>{c.label} · </span>
                      {c.text}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
              Nothing matches that search.
            </p>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
