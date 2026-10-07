import { useState, type ReactNode } from 'react';
import { AREAS, AREA_LABELS } from '../../types/region';
import { ANSWER_FORMATS, ANSWER_FORMAT_LABELS, LAST_ANSWER_PRESETS, type Tally } from '../../lib/attemptFilter';
import type { UseAccuracyFilter } from '../../hooks/useAccuracyFilter';

const eyebrow = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

function Chip({ on, count, compact, onClick, children }: { on: boolean; count?: number; compact: boolean; onClick: () => void; children: ReactNode }) {
  // A chip with nothing behind it stays pressable when it is on, so a filter
  // can always be taken off again.
  const empty = count === 0 && !on;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      disabled={empty}
      className={`inline-flex items-center justify-center rounded-full ${compact ? 'min-h-[38px] px-3' : 'min-h-[34px] px-3.5'}`}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: compact ? 13.5 : 14,
        border: on ? '1.2px solid var(--acc)' : '1.2px solid var(--line)',
        background: on ? 'var(--accs)' : 'transparent',
        color: on ? 'var(--accd)' : empty ? 'var(--ink3)' : 'var(--ink2)',
        opacity: empty ? 0.6 : 1,
      }}
    >
      {children}
      {count !== undefined && (
        <span className="ml-2 tabular-nums" style={{ font: '400 11px/1 var(--font-mono)', color: 'inherit' }}>
          {count}
        </span>
      )}
    </button>
  );
}

const pct = (t: Tally) => (t.pct !== null ? `${t.pct}%` : '—');

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** What Custom opens on: a number none of the chips offers. */
const CUSTOM_DEFAULT = 200;

/**
 * The filters over the account page's accuracy chart, and the figures for
 * what they leave: by how the question was answered and by the area of the
 * body it was about. Nothing selected in a row means all of it. A third row
 * keeps only the most recent answers that match, and the line underneath says
 * which dates those run between.
 *
 * The seen-before / first-sight pair is printed as numbers here as well as
 * drawn below, because a narrow filter often leaves too few answers for a
 * line and the two figures are still worth reading.
 */
export function AccuracyFilters({ accuracy, compact = false }: { accuracy: UseAccuracyFilter; compact?: boolean }) {
  const { filter, counts, result } = accuracy;
  const active = filter.formats.size + filter.areas.size > 0 || filter.last !== null;
  // Custom is a mode, not a value: typing 50 into the box must not jump the
  // selection across to the "Last 50" chip mid-keystroke.
  const [custom, setCustom] = useState(false);
  const pickLast = (last: number | null) => {
    setCustom(false);
    accuracy.setLast(last);
  };

  return (
    <div className="mt-4">
      <div style={eyebrow}>Question type</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip on={filter.formats.size === 0} compact={compact} onClick={() => filter.formats.forEach(accuracy.toggleFormat)}>
          All types
        </Chip>
        {ANSWER_FORMATS.map((format) => (
          <Chip
            key={format}
            on={filter.formats.has(format)}
            count={counts.formats[format]}
            compact={compact}
            onClick={() => accuracy.toggleFormat(format)}
          >
            {ANSWER_FORMAT_LABELS[format]}
          </Chip>
        ))}
      </div>

      <div className="mt-4" style={eyebrow}>
        Area
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip on={filter.areas.size === 0} compact={compact} onClick={() => filter.areas.forEach(accuracy.toggleArea)}>
          All areas
        </Chip>
        {AREAS.map((area) => (
          <Chip
            key={area}
            on={filter.areas.has(area)}
            count={counts.areas[area] ?? 0}
            compact={compact}
            onClick={() => accuracy.toggleArea(area)}
          >
            {AREA_LABELS[area]}
          </Chip>
        ))}
      </div>

      <div className="mt-4" style={eyebrow}>
        Answers
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {LAST_ANSWER_PRESETS.map((n) => (
          <Chip key={n} on={!custom && filter.last === n} compact={compact} onClick={() => pickLast(n)}>
            Last {n}
          </Chip>
        ))}
        <Chip on={!custom && filter.last === null} compact={compact} onClick={() => pickLast(null)}>
          All time
        </Chip>
        <Chip
          on={custom}
          compact={compact}
          onClick={() => {
            setCustom(true);
            accuracy.setLast(filter.last ?? CUSTOM_DEFAULT);
          }}
        >
          Custom
        </Chip>
        {custom && (
          <label className="inline-flex items-center gap-2" style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--ink2)' }}>
            Last
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={filter.last ?? ''}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value));
                if (Number.isFinite(n) && n >= 1) accuracy.setLast(n);
              }}
              className="rounded-[3px] px-2 tabular-nums"
              style={{ width: 84, minHeight: compact ? 38 : 34, border: '1.2px solid var(--line)', background: 'var(--sf)', color: 'var(--ink)' }}
            />
            answers
          </label>
        )}
      </div>

      <div className="mt-4" style={{ font: '400 12.5px/1.6 var(--font-mono)', color: 'var(--ink2)' }} aria-live="polite">
        {result.all.total === 0 ? (
          <span style={{ color: 'var(--ink3)' }}>No answers match these filters yet.</span>
        ) : (
          <>
            {result.all.total} {result.all.total === 1 ? 'answer' : 'answers'}
            {result.from && result.to && (
              <>
                {' '}
                · {shortDay(result.from)}
                {shortDay(result.to) !== shortDay(result.from) && ` – ${shortDay(result.to)}`}
              </>
            )}{' '}
            · {pct(result.all)} correct
            <span style={{ color: 'var(--ink3)' }}>
              {' '}
              · seen before {pct(result.seenBefore)} ({result.seenBefore.total}) · first sight {pct(result.firstSight)} ({result.firstSight.total})
            </span>
          </>
        )}
        {active && (
          <button
            type="button"
            onClick={() => {
              setCustom(false);
              accuracy.clear();
            }}
            className="ml-3 border-0 bg-transparent p-0 underline"
            style={{ font: '400 12.5px/1.6 var(--font-ui)', color: 'var(--accd)' }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
