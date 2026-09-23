import { useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import { CATEGORY_LABELS, type Category } from '../../types/structure';
import { ATLAS_COLUMN_LABELS, ATLAS_MIXED_LABELS } from '../../lib/atlasFacts';
import { masteryState, sortById } from '../../lib/atlasList';
import { getAtlasPanelOpen, setAtlasPanelOpen } from '../../lib/preferences';
import { useAtlasList } from '../../hooks/useAtlasList';
import { Button } from '../shared/Button';
import { UnlockNote } from '../shared/AreaLock';
import { AtlasFilterPanel } from '../shared/AtlasFilterPanel';
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

const PANEL_ID = 'atlas-filters';

/**
 * Every structure the account may reach, of every kind.
 *
 * This was a muscle table. The other four kinds — 223 of the 345 structures,
 * every one of them quizzed — had no page that simply said what they are and
 * what they do. Each kind now has its own three columns (lib/atlasFacts), and
 * the list can be narrowed by area, kind, whether it has been seen, and free
 * text, then ordered eight ways (lib/atlasList).
 *
 * The filters live in a column that collapses, because there are now enough of
 * them to be worth the width back when you are reading the table rather than
 * narrowing it. What narrows the list is stated on the trigger, so a hidden
 * panel can never quietly be filtering.
 *
 * Entitled structures only. The atlas is where drills start, so listing a
 * locked structure would mean a row that does nothing or a paywall
 * interrupting a click; locking the list keeps the boundary in one place.
 */
export function Atlas({ access, content, repository, userId, onOpenMuscle, onDrillOina, onQuizStructures, onNavigate }: AtlasProps) {
  const list = useAtlasList({ access, content, repository, userId });
  const [panelOpen, setPanelOpen] = useState(getAtlasPanelOpen);

  const { entitled, visible, rows, filters, contextIds, muscleIds, activeCount } = list;
  const kind = filters.kind;
  const headings = kind === 'all' ? ATLAS_MIXED_LABELS : ATLAS_COLUMN_LABELS[kind];
  const noun = kind === 'all' ? 'structure' : KIND_SINGULAR[kind];

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    setAtlasPanelOpen(next);
  };

  return (
    <AppShell sidebar={<NavSidebar active="atlas" onNavigate={onNavigate} />}>
      <div className="flex h-screen min-h-0">
        {panelOpen && (
          <div
            className="w-[250px] flex-none overflow-auto px-7 pt-14 pb-10"
            style={{ borderRight: '1px solid var(--line)' }}
          >
            <AtlasFilterPanel list={list} id={PANEL_ID} />
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-14 pt-14">
          <div className="flex items-end gap-8">
            <div className="flex-1">
              <h2
                style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 44, lineHeight: 1.02, letterSpacing: '-.024em', margin: '0 0 8px' }}
              >
                Atlas
              </h2>
              {/*
                Announced politely so a screen-reader user hears the list
                resize when a filter changes — the count is the only feedback
                that a chip in a collapsed panel did anything.
              */}
              <p aria-live="polite" style={{ color: 'var(--ink3)', fontSize: 15.5 }}>
                {entitled.length} structures · showing {visible.length}
                {filters.query ? ` matching “${filters.query}”` : ''}
              </p>
              <UnlockNote access={access} className="mt-1.5" />
            </div>
            <input
              type="text"
              value={filters.query}
              onChange={(e) => list.setQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search structures"
              className="w-[300px] flex-none rounded-[3px] px-4.5 py-3.5"
              style={{ fontFamily: 'var(--font-display)', fontSize: 19, border: '1.4px solid var(--acc)', background: 'var(--sf)', color: 'var(--ink)' }}
            />
            <Button
              onClick={() => onQuizStructures(contextIds)}
              disabled={contextIds.length === 0}
              className="flex-none min-h-[54px] min-w-[140px]"
              variant="secondary"
            >
              Quiz these
            </Button>
            <Button
              onClick={() => onDrillOina(muscleIds)}
              disabled={muscleIds.length === 0}
              className="flex-none min-h-[54px] min-w-[175px]"
            >
              Drill these facts
            </Button>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={togglePanel}
              aria-expanded={panelOpen}
              aria-controls={PANEL_ID}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-[3px] px-4"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15.5,
                border: '1.2px solid var(--line)',
                background: 'transparent',
                color: 'var(--ink2)',
              }}
            >
              {panelOpen ? 'Hide filters' : 'Filters'}
              {activeCount > 0 && (
                <span
                  className="inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5"
                  style={{ font: '500 11px/1.7 var(--font-mono)', background: 'var(--accs)', color: 'var(--accd)' }}
                >
                  {activeCount}
                </span>
              )}
            </button>
            <p style={{ color: 'var(--ink3)', fontSize: 13.5 }}>
              {sortById(list.sortId).label} ·{' '}
              {kind === 'muscle'
                ? 'origin, insertion, nerve supply and action'
                : kind === 'all'
                  ? 'what each structure is and what it does'
                  : `${headings[0].toLowerCase()}, ${headings[1].toLowerCase()} and ${headings[2].toLowerCase()}`}{' '}
              for the {visible.length} {visible.length === 1 ? noun : `${noun}s`} listed.
            </p>
          </div>

          <div
            className="mt-6 flex gap-5 pb-3"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
          >
            <span className="w-[230px] flex-none">{kind === 'all' ? 'Structure' : CATEGORY_LABELS[kind].replace(/s$/, '')}</span>
            <span className="w-[240px] flex-none">{headings[0]}</span>
            <span className="w-[230px] flex-none">{headings[1]}</span>
            <span className="flex-1">{headings[2]}</span>
            <span className="w-[88px] flex-none text-right">Mastery</span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto pb-14">
            {visible.map((s) => {
              const state = masteryState(list.masteryById.get(s.id));
              const { columns } = rows.get(s.id)!;
              const cell = (i: 0 | 1 | 2) => (
                <>
                  {kind === 'all' && columns[i].text && <span style={{ color: 'var(--ink3)' }}>{columns[i].label} · </span>}
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
                  {/*
                    Three states, not two. A flashcard writes a mastery row
                    with no attempts, so "unseen" for attemptsTotal === 0 said
                    a structure had never been met when it had — and would now
                    contradict the seen filter sitting beside it.
                  */}
                  <span
                    className="w-[88px] flex-none text-right"
                    style={{
                      font: '500 13px/1 var(--font-mono)',
                      color:
                        state.kind === 'scored'
                          ? state.pct < 60
                            ? 'var(--acc2d)'
                            : 'var(--accd)'
                          : 'var(--ink3)',
                    }}
                  >
                    {state.kind === 'unseen' ? 'unseen' : state.kind === 'untested' ? 'not tested' : `${state.pct}%`}
                  </span>
                </button>
              );
            })}
            {visible.length === 0 && (
              <p className="py-8" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
                {activeCount > 0 ? 'Nothing matches those filters.' : 'Nothing to show.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
