/**
 * Today's goal (owner, 19 Oct 2026): a ring that fills as the day's questions
 * are answered, next to the streak it feeds. The goal is one daily review's
 * worth (lib/studyProfile.ts dailyGoalFor) — set from "minutes a day", never a
 * separate number to manage.
 *
 * Past the goal it stays full and says so; it never counts down or scolds.
 */
export function DailyGoalRing({ done, goal, size = 34 }: { done: number; goal: number; size?: number }) {
  const stroke = Math.max(3, Math.round(size / 9));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const share = goal > 0 ? Math.min(1, done / goal) : 0;
  const met = goal > 0 && done >= goal;
  const label = met ? `Daily goal met: ${done} of ${goal} questions today` : `${done} of ${goal} questions today`;
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={met ? 'var(--acc)' : 'var(--accd)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * share} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 500ms ease' }}
        />
        {met && (
          <path
            d={`M${size * 0.32} ${size * 0.52} l${size * 0.12} ${size * 0.12} l${size * 0.24} -${size * 0.26}`}
            fill="none"
            stroke="var(--acc)"
            strokeWidth={stroke * 0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span className="tabular-nums" style={{ font: '500 11.5px/1.2 var(--font-mono)', color: 'var(--ink2)' }}>
        {Math.min(done, 999)}/{goal}
        <span className="block" style={{ font: '400 10px/1.2 var(--font-mono)', color: 'var(--ink3)', letterSpacing: '.04em' }}>
          {met ? 'goal met' : 'today'}
        </span>
      </span>
    </span>
  );
}
