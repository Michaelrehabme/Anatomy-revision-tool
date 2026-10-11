import { AREA_LABELS, type Area } from '../../types/region';

interface ReviewAreaSelectProps {
  /** The areas this account may reach; a locked area is never offered. */
  areas: readonly Area[];
  value: Area | 'all';
  onChange: (area: Area | 'all') => void;
  className?: string;
}

/**
 * Which area today's review covers (owner, 11 Oct 2026).
 *
 * "All areas" is the default and the review as it is scheduled: whatever is
 * due, wherever it is. One area is for the student with a knee practical on
 * Thursday — the same review, cut to that area's due and weak questions and
 * its new structures.
 *
 * Not saved. Which area to drill is a question about today, and a choice that
 * outlived the day would quietly hide everything else that fell due.
 */
export function ReviewAreaSelect({ areas, value, onChange, className }: ReviewAreaSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Area | 'all')}
      aria-label="Review area"
      className={`w-full rounded-[3px] px-3 ${className ?? ''}`}
      style={{
        minHeight: 44,
        fontFamily: 'var(--font-display)',
        fontSize: 15.5,
        border: '1.2px solid var(--line)',
        background: 'var(--sf)',
        color: 'var(--ink)',
      }}
    >
      <option value="all">Review all areas</option>
      {areas.map((a) => (
        <option key={a} value={a}>
          {AREA_LABELS[a]} only
        </option>
      ))}
    </select>
  );
}
