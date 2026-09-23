import { useEffect, useRef, useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import { masteryState, sortById } from '../../lib/atlasList';
import { useAtlasList } from '../../hooks/useAtlasList';
import { UnlockNote } from '../shared/AreaLock';
import { AtlasFilterPanel } from '../shared/AtlasFilterPanel';
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

const PANEL_ID = 'atlas-filters-mobile';

/**
 * The mobile counterpart to the desktop Atlas (CR-018), now for every kind
 * of structure rather than muscles alone — see Atlas.tsx.
 *
 * A stacked list rather than the desktop's table: two facts at a glance (a
 * muscle's origin and insertion, a ligament's attachments and the joint it
 * stabilises), the rest one tap away on the structure card.
 *
 * The filters are a drawer rather than the desktop's column. They were three
 * wrapping chip rows costing about a third of the screen before a single
 * structure appeared; with a seen filter and eight sorts added they would have
 * pushed the list off the fold entirely.
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
  const list = useAtlasList({ access, content, repository, userId });
  // Always closed on arrival: the drawer is a modal over the list, and
  // restoring it open would mean every visit starts with something to dismiss.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const { entitled, visible, rows, filters, contextIds, muscleIds, activeCount } = list;

  /**
   * Modal behaviour, by hand because the app has no dialog primitive and
   * <dialog> would bring its own top-layer stacking against the tab bar.
   * Escape closes, focus moves in and comes back to the trigger, and the
   * page behind does not scroll under the scrim.
   */
  useEffect(() => {
    if (!drawerOpen) return;
    const trigger = triggerRef.current;
    drawerRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [drawerOpen]);

  return (
    <MobileShell tabs={{ active: 'atlas', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4 pb-6" inert={drawerOpen}>
        <button type="button" onClick={onBack} className="border-0 bg-transparent p-0 pb-2.5" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
          &larr; Today
        </button>
        <h2
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30, lineHeight: 1.05, letterSpacing: '-.02em', margin: '2px 0 5px' }}
        >
          Atlas
        </h2>
        <p aria-live="polite" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink3)' }}>
          {entitled.length} structures · showing {visible.length}
          {filters.query ? ` matching “${filters.query}”` : ''}
        </p>
        <UnlockNote access={access} className="mt-1.5" />

        <input
          type="text"
          value={filters.query}
          onChange={(e) => list.setQuery(e.target.value)}
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

        <div className="mt-3 flex items-center gap-2.5">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls={PANEL_ID}
            className="inline-flex flex-none items-center gap-2 rounded-[3px] px-4"
            style={{
              minHeight: 44,
              fontFamily: 'var(--font-display)',
              fontSize: 15.5,
              border: '1.2px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink2)',
            }}
          >
            Filters
            {activeCount > 0 && (
              <span
                className="inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5"
                style={{ font: '500 11px/1.7 var(--font-mono)', background: 'var(--accs)', color: 'var(--accd)' }}
              >
                {activeCount}
              </span>
            )}
          </button>
          <span className="flex-1 truncate" style={{ fontSize: 13, color: 'var(--ink3)' }}>
            {sortById(list.sortId).label}
          </span>
        </div>

        <div className="mt-3.5 flex gap-2.5">
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
            style={{ minHeight: 52, background: 'var(--acc-fill)', color: 'var(--onacc)', font: '500 16px/1 var(--font-ui)' }}
          >
            Drill these facts
          </button>
        </div>
        <p className="mt-2 text-center" style={{ font: '400 11.5px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
          {muscleIds.length > 0 ? 'Facts drill the muscles listed · quiz asks every kind' : 'Quiz asks every kind listed'}
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {visible.map((s) => {
            const state = masteryState(list.masteryById.get(s.id));
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
                  {filters.kind === 'all' && (
                    <span style={{ font: '400 10.5px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                      {s.category}
                    </span>
                  )}
                  {/* Three states — see the same note in Atlas.tsx. */}
                  <span
                    style={{
                      font: '500 11.5px/1 var(--font-mono)',
                      color: state.kind === 'scored' ? 'var(--accd)' : 'var(--ink3)',
                    }}
                  >
                    {state.kind === 'unseen' ? 'unseen' : state.kind === 'untested' ? 'not tested' : `${state.pct}%`}
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
          {visible.length === 0 && (
            <p className="py-8 text-center" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
              {activeCount > 0 ? 'Nothing matches those filters.' : 'Nothing to show.'}
            </p>
          )}
        </div>
      </div>

      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'var(--scrim)' }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            id={PANEL_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Filter and sort structures"
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl"
            style={{ background: 'var(--pg)', borderTop: '1px solid var(--line)' }}
          >
            <div className="flex flex-none items-center justify-between px-6.5 pt-5 pb-3">
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)' }}>
                Filter &amp; sort
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
                className="border-0 bg-transparent px-2 py-1"
                style={{ fontSize: 22, lineHeight: 1, color: 'var(--ink3)' }}
              >
                &times;
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-6.5 pb-4">
              <AtlasFilterPanel list={list} id={`${PANEL_ID}-body`} />
            </div>
            <div className="flex-none px-6.5 pt-3 pb-6" style={{ borderTop: '1px solid var(--line)' }}>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-full rounded-[3px] border-0"
                style={{ minHeight: 52, background: 'var(--acc-fill)', color: 'var(--onacc)', font: '500 16px/1 var(--font-ui)' }}
              >
                Show {visible.length} {visible.length === 1 ? 'structure' : 'structures'}
              </button>
            </div>
          </div>
        </>
      )}
    </MobileShell>
  );
}
