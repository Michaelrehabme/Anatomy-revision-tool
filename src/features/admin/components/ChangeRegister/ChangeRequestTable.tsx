import {
  CHANGE_CATEGORY_LABELS,
  CHANGE_EFFORT_LABELS,
  CHANGE_PRIORITY_LABELS,
  CHANGE_STATUSES,
  CHANGE_STATUS_LABELS,
  type ChangeRequest,
  type ChangeStatus,
} from '../../types/changeRequest';
import { findIncompleteDependencies } from '../../lib/statusTransition';
import { StatusBadge } from './StatusBadge';

interface ChangeRequestTableProps {
  items: ChangeRequest[];
  statusByRef: ReadonlyMap<string, ChangeStatus>;
  onOpen: (ref: string) => void;
  onSetStatus: (ref: string, status: ChangeStatus) => void;
}

const PRIORITY_COLOR: Record<string, string> = { p0: 'var(--acc2d)', p1: 'var(--ink2)', p2: 'var(--ink3)' };

export function ChangeRequestTable({ items, statusByRef, onOpen, onSetStatus }: ChangeRequestTableProps) {
  if (items.length === 0) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        No change requests match these filters.
      </div>
    );
  }

  return (
    <table className="mt-6 w-full border-collapse text-left">
      <thead>
        <tr style={{ borderBottom: '1.2px solid var(--line)' }}>
          {['Ref', 'Title', 'Category', 'Priority', 'Effort', 'Status'].map((label) => (
            <th
              key={label}
              className="pb-2.5 pr-4"
              style={{
                font: '500 10px/1 var(--font-mono)',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--ink3)',
              }}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const incompleteDeps =
            item.status !== 'inProgress' ? [] : findIncompleteDependencies(item.dependsOn, statusByRef);
          return (
            <tr
              key={item.ref}
              onClick={() => onOpen(item.ref)}
              className="cursor-pointer transition-colors hover:opacity-80"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <td className="py-3 pr-4" style={{ font: '500 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                {item.ref}
              </td>
              <td className="py-3 pr-4" style={{ font: '400 14.5px/1.3 var(--font-ui)', color: 'var(--ink)' }}>
                {item.title}
                {incompleteDeps.length > 0 && (
                  <span className="ml-2" title={`Depends on unfinished: ${incompleteDeps.join(', ')}`} style={{ color: 'var(--acc2d)' }}>
                    ⚠
                  </span>
                )}
              </td>
              <td className="py-3 pr-4" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink2)' }}>
                {CHANGE_CATEGORY_LABELS[item.category]}
              </td>
              <td
                className="py-3 pr-4"
                style={{ font: '500 12.5px/1 var(--font-mono)', color: PRIORITY_COLOR[item.priority] }}
              >
                {CHANGE_PRIORITY_LABELS[item.priority]}
              </td>
              <td className="py-3 pr-4" style={{ font: '400 12.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                {CHANGE_EFFORT_LABELS[item.effort]}
              </td>
              <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  <select
                    aria-label={`Status for ${item.ref}`}
                    value={item.status}
                    onChange={(e) => onSetStatus(item.ref, e.target.value as ChangeStatus)}
                    style={{
                      font: '400 11.5px/1 var(--font-ui)',
                      color: 'var(--ink3)',
                      background: 'transparent',
                      border: '1px solid var(--line)',
                      borderRadius: 3,
                      padding: '4px 6px',
                    }}
                  >
                    {CHANGE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {CHANGE_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
