import { MASTERY_LEVEL_LABELS, skillLabel, type StructureLevelState } from '../../lib/masteryLevel';
import { relativeDue } from '../../hooks/useTodayData';

/**
 * A structure's level, question type by question type (owner, 2 Oct 2026):
 * naming and each fact have their own level and their own review date, and
 * the badge above this list is their average. Unmet types are listed too, so
 * the student can see what the average leaves out.
 */
export function SkillBreakdown({ state, now = new Date() }: { state: StructureLevelState; now?: Date }) {
  return (
    <ul className="m-0 list-none p-0" style={{ font: '400 12px/1.5 var(--font-mono)', color: 'var(--ink2)' }}>
      {state.perKind.map(({ kind, state: s, dueAt }) => (
        <li key={kind} className="flex flex-wrap justify-between gap-x-3 py-0.5">
          <span>{skillLabel(kind)}</span>
          <span style={{ color: s ? 'var(--ink2)' : 'var(--ink3)' }}>
            {s ? `${MASTERY_LEVEL_LABELS[s.level]}${s.fading ? ' · fading' : ''}${dueAt ? ` · due ${relativeDue(dueAt, now)}` : ''}` : 'Not met'}
          </span>
        </li>
      ))}
    </ul>
  );
}
