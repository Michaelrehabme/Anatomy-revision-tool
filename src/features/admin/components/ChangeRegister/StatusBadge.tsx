import { CHANGE_STATUS_LABELS, type ChangeStatus } from '../../types/changeRequest';

const STATUS_STYLES: Record<ChangeStatus, { bg: string; fg: string }> = {
  new: { bg: 'var(--line)', fg: 'var(--ink2)' },
  inProgress: { bg: 'var(--accs)', fg: 'var(--accd)' },
  completed: { bg: 'var(--acc)', fg: 'var(--onacc)' },
};

/** Gray = new, light teal = in progress, solid teal = completed — a settled/done state reads as the "filled in" variant. */
export function StatusBadge({ status }: { status: ChangeStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className="inline-block rounded-[3px] px-2 py-1"
      style={{ font: '500 11px/1 var(--font-mono)', background: style.bg, color: style.fg, whiteSpace: 'nowrap' }}
    >
      {CHANGE_STATUS_LABELS[status]}
    </span>
  );
}
