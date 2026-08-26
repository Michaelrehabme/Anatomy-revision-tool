import type { CSSProperties } from 'react';
import {
  CHANGE_CATEGORIES,
  CHANGE_CATEGORY_LABELS,
  CHANGE_PRIORITIES,
  CHANGE_PRIORITY_LABELS,
  CHANGE_STATUSES,
  CHANGE_STATUS_LABELS,
  type ChangeCategory,
  type ChangePriority,
  type ChangeStatus,
} from '../../types/changeRequest';

export interface ChangeRequestFilterState {
  status: ChangeStatus | 'all';
  category: ChangeCategory | 'all';
  priority: ChangePriority | 'all';
}

interface ChangeRequestFiltersProps {
  filters: ChangeRequestFilterState;
  onChange: (filters: ChangeRequestFilterState) => void;
}

const selectStyle: CSSProperties = {
  font: '500 12.5px/1 var(--font-ui)',
  color: 'var(--ink2)',
  background: 'var(--sf)',
  border: '1.2px solid var(--line)',
  borderRadius: 3,
  padding: '7px 10px',
};

export function ChangeRequestFilters({ filters, onChange }: ChangeRequestFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value as ChangeStatus | 'all' })}
        style={selectStyle}
      >
        <option value="all">All statuses</option>
        {CHANGE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {CHANGE_STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <select
        value={filters.category}
        onChange={(e) => onChange({ ...filters, category: e.target.value as ChangeCategory | 'all' })}
        style={selectStyle}
      >
        <option value="all">All categories</option>
        {CHANGE_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {CHANGE_CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>

      <select
        value={filters.priority}
        onChange={(e) => onChange({ ...filters, priority: e.target.value as ChangePriority | 'all' })}
        style={selectStyle}
      >
        <option value="all">All priorities</option>
        {CHANGE_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {CHANGE_PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>
    </div>
  );
}
