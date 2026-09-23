import type { ReactNode } from 'react';
import { CATEGORY_LABELS } from '../../types/structure';
import { AREA_LABELS } from '../../types/region';
import { ATLAS_KINDS } from '../../lib/atlasFacts';
import { ATLAS_SORTS, SEEN_FILTER_LABELS, type SeenFilter } from '../../lib/atlasList';
import type { UseAtlasList } from '../../hooks/useAtlasList';
import { LockPill } from './AreaLock';

const SEEN_FILTERS: SeenFilter[] = ['all', 'seen', 'unseen'];

const eyebrow = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

function chipStyle(on: boolean) {
  return {
    fontFamily: 'var(--font-display)',
    fontSize: 14.5,
    border: on ? '1.2px solid var(--acc)' : '1.2px solid var(--line)',
    background: on ? 'var(--accs)' : 'transparent',
    color: on ? 'var(--accd)' : 'var(--ink2)',
  };
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="inline-flex min-h-[38px] items-center justify-center rounded-full px-3.5"
      style={chipStyle(on)}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <div style={eyebrow}>{label}</div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

interface AtlasFilterPanelProps {
  list: UseAtlasList;
  /** The id the trigger points at with aria-controls. */
  id: string;
}

/**
 * The atlas filter and sort controls, rendered once and placed twice: inside
 * the desktop's collapsible column and inside the mobile drawer.
 *
 * Every filter lives here, including the study area, which used to sit in the
 * desktop nav sidebar. Splitting filters between the nav and the screen made
 * "what is narrowing this list" a question with two places to look — and with
 * a hideable panel it would have meant one filter that hides and three that
 * do not.
 *
 * Tokens only, no literal colours: the four theme scopes swap underneath
 * this without it knowing.
 */
export function AtlasFilterPanel({ list, id }: AtlasFilterPanelProps) {
  const { filters, sortId, areaOptions, kindCounts, activeCount } = list;

  return (
    <div id={id}>
      <div className="flex items-baseline justify-between">
        <div style={eyebrow}>Sort</div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={list.clearFilters}
            className="border-0 bg-transparent p-0 underline"
            style={{ fontSize: 13, color: 'var(--accd)' }}
          >
            Clear all
          </button>
        )}
      </div>
      <select
        value={sortId}
        onChange={(e) => list.setSortId(e.target.value)}
        aria-label="Sort structures"
        className="mt-2.5 w-full rounded-[3px] px-3"
        style={{
          minHeight: 44,
          fontFamily: 'var(--font-display)',
          fontSize: 15.5,
          border: '1.2px solid var(--line)',
          background: 'var(--sf)',
          color: 'var(--ink)',
        }}
      >
        {ATLAS_SORTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>

      <Group label="Progress">
        <div className="flex flex-wrap gap-2">
          {SEEN_FILTERS.map((s) => (
            <Chip key={s} on={filters.seen === s} onClick={() => list.setSeen(s)}>
              {SEEN_FILTER_LABELS[s]}
            </Chip>
          ))}
        </div>
      </Group>

      <Group label="Kind">
        <div className="flex flex-wrap gap-2">
          {ATLAS_KINDS.map((k) => (
            <Chip key={k} on={filters.kind === k} onClick={() => list.setKind(k)}>
              {k === 'all' ? 'All kinds' : CATEGORY_LABELS[k]}
              <span className="ml-2" style={{ font: '400 11.5px/1 var(--font-mono)', color: 'inherit', opacity: 0.75 }}>
                {kindCounts[k] ?? 0}
              </span>
            </Chip>
          ))}
        </div>
      </Group>

      <Group label="Area">
        <div className="flex flex-col gap-px">
          <AreaRow
            label="All areas"
            count={kindCounts.all}
            on={filters.area === 'all'}
            onClick={() => list.setArea('all')}
          />
          {areaOptions.map((a) => (
            <AreaRow
              key={a.area}
              label={AREA_LABELS[a.area]}
              count={a.count}
              locked={a.locked}
              on={filters.area === a.area}
              onClick={() => list.setArea(a.area)}
            />
          ))}
        </div>
      </Group>
    </div>
  );
}

/**
 * A locked area is shown, not hidden. Both atlas screens used to offer all
 * nine areas while the list was clamped to the entitled ones, so picking a
 * locked area produced a blank list and no explanation. AreaLock's docblock
 * is explicit that the paywall should state itself rather than vanish, so the
 * row stays, carries the count it would have, and wears the lock.
 */
function AreaRow({
  label,
  count,
  locked = false,
  on,
  onClick,
}: {
  label: string;
  count: number;
  locked?: boolean;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex min-h-[40px] w-full items-center gap-2 border-0 bg-transparent px-0 text-left"
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 16,
        color: on ? 'var(--accd)' : locked ? 'var(--ink3)' : 'var(--ink2)',
      }}
    >
      <span className="flex-1">{label}</span>
      {locked ? (
        <LockPill compact />
      ) : (
        <span style={{ font: '400 11.5px/1 var(--font-mono)', color: on ? 'var(--accd)' : 'var(--ink3)' }}>{count}</span>
      )}
    </button>
  );
}
