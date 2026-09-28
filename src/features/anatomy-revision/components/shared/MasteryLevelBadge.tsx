import { MASTERY_LEVELS, MASTERY_LEVEL_LABELS, masteryLevelRank, type MasteryLevelState } from '../../lib/masteryLevel';

/**
 * A structure's mastery level (lib/masteryLevel.ts): five pips, one filled
 * per level reached, with the name beside them — the name is always there, so
 * the level never rests on colour or pip-counting alone. An unmet structure
 * shows no pips filled; a fading Master shows its pips washed out.
 */
export function MasteryLevelBadge({
  state,
  compact = false,
}: {
  state: MasteryLevelState;
  /** Pips only, the name kept for screen readers and the tooltip — for tight table cells. */
  compact?: boolean;
}) {
  const filled = state.seen ? masteryLevelRank(state.level) + 1 : 0;
  const label = state.seen ? MASTERY_LEVEL_LABELS[state.level] : 'Not met';
  const full = state.fading ? `${label} · fading` : label;

  return (
    <span className="inline-flex items-center gap-2" title={full}>
      <span aria-hidden="true" className="inline-flex gap-[3px]">
        {MASTERY_LEVELS.map((level, i) => (
          <span
            key={level}
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: i < filled ? 'var(--acc)' : 'transparent',
              border: `1px solid ${i < filled ? 'var(--acc)' : 'var(--line-strong)'}`,
              opacity: state.fading && i < filled ? 0.45 : 1,
            }}
          />
        ))}
      </span>
      <span
        className={compact ? 'sr-only' : undefined}
        style={{ font: '500 12px/1 var(--font-mono)', color: state.seen ? 'var(--ink2)' : 'var(--ink3)' }}
      >
        {full}
      </span>
    </span>
  );
}
