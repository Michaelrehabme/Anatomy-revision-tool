import { useEffect, useMemo, useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { StructureMastery } from '../../types/attempt';
import { CATEGORY_LABELS, areasOf, isMuscle, type Category } from '../../types/structure';
import type { Area } from '../../types/region';
import { AREAS, AREA_LABELS } from '../../types/region';
import { ATLAS_COLUMN_LABELS, ATLAS_KINDS, ATLAS_MIXED_LABELS, atlasRow } from '../../lib/atlasFacts';
import { Button } from '../shared/Button';
import { UnlockNote } from '../shared/AreaLock';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

interface AtlasProps {
  /** What this account may reach. The atlas lists only entitled structures — see below. */
  access: UseEntitlement;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onOpenMuscle: (structureId: string, contextIds: string[]) => void;
  /** Starts an OINA session over the muscles currently listed (CR-018). */
  onDrillOina: (structureIds: string[]) => void;
  /** Starts a mixed quiz over everything currently listed, whatever its kind. */
  onQuizStructures: (structureIds: string[]) => void;
  onNavigate: (section: NavSection) => void;
}

const KIND_SINGULAR: Record<Category, string> = {
  muscle: 'muscle',
  bone: 'bone',
  landmark: 'landmark',
  joint: 'joint',
  ligament: 'ligament',
};

/**
 * Every structure the account may reach, of every kind.
 *
 * This was a muscle table. The other four kinds — 223 of the 345 structures,
 * every one of them quizzed — had no page that simply said what they are and
 * what they do. Each kind now has its own three columns (lib/atlasFacts), the
 * filter is by study area rather than the five legacy regions, and a kind
 * chip row narrows the list.
 *
 * Entitled structures only. The atlas is where drills start, so listing a
 * locked structure would mean a row that does nothing or a paywall
 * interrupting a click; locking the list keeps the boundary in one place.
 */
export function Atlas({ access, content, repository, userId, onOpenMuscle, onDrillOina, onQuizStructures, onNavigate }: AtlasProps) {
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
  const headings = kind === 'all' ? ATLAS_MIXED_LABELS : ATLAS_COLUMN_LABELS[kind];
  const noun = kind === 'all' ? 'structure' : KIND_SINGULAR[kind];

  return (
    <AppShell
      sidebar={
        <NavSidebar
          active="atlas"
          onNavigate={onNavigate}
          footer={
            <>
              <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                Filter by area
              </div>
              <div className="mt-3.5 flex flex-col gap-px">
                <button
                  type="button"
                  onClick={() => setAreaFilter('all')}
                  className="py-2 text-left"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, color: areaFilter === 'all' ? 'var(--accd)' : 'var(--ink2)' }}
                >
                  All {entitled.length}
                </button>
                {AREAS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAreaFilter(a)}
                    className="py-2 text-left"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, color: areaFilter === a ? 'var(--accd)' : 'var(--ink2)' }}
                  >
                    {AREA_LABELS[a]}
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
              {entitled.length} structures · showing {filtered.length}
              {query ? ` matching “${query}”` : ''}
            </p>
            <UnlockNote access={access} className="mt-1.5" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search structures"
            className="w-[340px] flex-none rounded-[3px] px-4.5 py-3.5"
            style={{ fontFamily: 'var(--font-display)', fontSize: 19, border: '1.4px solid var(--acc)', background: 'var(--sf)', color: 'var(--ink)' }}
          />
          <Button
            onClick={() => onQuizStructures(contextIds)}
            disabled={contextIds.length === 0}
            className="flex-none min-h-[54px] min-w-[150px]"
            variant="secondary"
          >
            Quiz these
          </Button>
          <Button
            onClick={() => onDrillOina(muscleIds)}
            disabled={muscleIds.length === 0}
            className="flex-none min-h-[54px] min-w-[190px]"
          >
            Drill these facts
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {ATLAS_KINDS.map((k) => {
            const on = kind === k;
            const count = k === 'all' ? entitled.length : entitled.filter((s) => s.category === k).length;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={on}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full px-4"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 15.5,
                  border: on ? '1.2px solid var(--acc)' : '1.2px solid var(--line)',
                  background: on ? 'var(--accs)' : 'transparent',
                  color: on ? 'var(--accd)' : 'var(--ink2)',
                }}
              >
                {k === 'all' ? 'All kinds' : CATEGORY_LABELS[k]}
                <span className="ml-2" style={{ font: '400 11.5px/1 var(--font-mono)', color: on ? 'var(--accd)' : 'var(--ink3)' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2.5" style={{ color: 'var(--ink3)', fontSize: 13.5 }}>
          {kind === 'muscle'
            ? 'Origin, insertion, nerve supply and action'
            : kind === 'all'
              ? 'What each structure is and what it does'
              : `${headings[0]}, ${headings[1].toLowerCase()} and ${headings[2].toLowerCase()}`}{' '}
          for the {filtered.length} {filtered.length === 1 ? noun : `${noun}s`} listed below.
          {muscleIds.length > 0 && ' "Drill these facts" runs OINA cards over the muscles in the list.'}
        </p>

        <div
          className="mt-7 flex gap-5 pb-3"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
        >
          <span className="w-[230px] flex-none">{kind === 'all' ? 'Structure' : CATEGORY_LABELS[kind].replace(/s$/, '')}</span>
          <span className="w-[240px] flex-none">{headings[0]}</span>
          <span className="w-[230px] flex-none">{headings[1]}</span>
          <span className="flex-1">{headings[2]}</span>
          <span className="w-[88px] flex-none text-right">Mastery</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto pb-14">
          {filtered.map((s) => {
            const mastery = masteryByStructureId.get(s.id);
            const pct = mastery && mastery.attemptsTotal > 0 ? Math.round((mastery.attemptsCorrect / mastery.attemptsTotal) * 100) : null;
            const { columns } = rows.get(s.id)!;
            const cell = (i: 0 | 1 | 2) => (
              <>
                {kind === 'all' && columns[i].text && (
                  <span style={{ color: 'var(--ink3)' }}>{columns[i].label} · </span>
                )}
                {columns[i].text || '—'}
              </>
            );
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenMuscle(s.id, contextIds)}
                className="flex w-full items-baseline gap-5 py-3 text-left"
                style={{ borderTop: '1px solid var(--line)' }}
              >
                <span className="w-[230px] flex-none">
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{s.name}</span>
                  {kind === 'all' && (
                    <span className="ml-2" style={{ font: '400 10.5px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                      {KIND_SINGULAR[s.category]}
                    </span>
                  )}
                </span>
                <span className="w-[240px] flex-none text-[14.5px] leading-snug" style={{ color: 'var(--ink2)' }}>
                  {cell(0)}
                </span>
                <span className="w-[230px] flex-none text-[14.5px] leading-snug" style={{ color: 'var(--ink2)' }}>
                  {cell(1)}
                </span>
                <span className="flex-1 text-[14.5px] leading-snug" style={{ color: 'var(--ink2)' }}>
                  {cell(2)}
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
          {filtered.length === 0 && (
            <p className="py-8" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
              Nothing matches that search.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
