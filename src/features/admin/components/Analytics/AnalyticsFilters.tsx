import type { CSSProperties } from 'react';
import { REGIONS, REGION_LABELS } from '../../../anatomy-revision/types/region';
import type { Category } from '../../../anatomy-revision/types/structure';
import type { QuestionType } from '../../../anatomy-revision/types/question';
import type { AnalyticsFilters as AnalyticsFiltersState } from '../../types/analytics';

const CATEGORIES: Category[] = ['muscle', 'bone', 'landmark', 'joint'];
const CATEGORY_LABELS: Record<Category, string> = { muscle: 'Muscle', bone: 'Bone', landmark: 'Landmark', joint: 'Joint' };

const QUESTION_TYPES: QuestionType[] = ['flashcard', 'mcq', 'locate', 'fill-blank', 'identify-typed', 'multi-select', 'oina'];
const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  flashcard: 'Flashcard',
  mcq: 'MCQ',
  locate: 'Locate',
  'fill-blank': 'Fill in the blank',
  'identify-typed': 'Identify (typed)',
  'multi-select': 'Multi-select',
  oina: 'OINA Cards',
};

interface AnalyticsFiltersProps {
  filters: AnalyticsFiltersState;
  onChange: (filters: AnalyticsFiltersState) => void;
}

const selectStyle: CSSProperties = {
  font: '500 12.5px/1 var(--font-ui)',
  color: 'var(--ink2)',
  background: 'var(--sf)',
  border: '1.2px solid var(--line)',
  borderRadius: 3,
  padding: '7px 10px',
};

export function AnalyticsFilters({ filters, onChange }: AnalyticsFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={filters.region ?? 'all'}
        onChange={(e) => onChange({ ...filters, region: e.target.value === 'all' ? undefined : (e.target.value as AnalyticsFiltersState['region']) })}
        style={selectStyle}
      >
        <option value="all">All regions</option>
        {REGIONS.map((region) => (
          <option key={region} value={region}>
            {REGION_LABELS[region]}
          </option>
        ))}
      </select>

      <select
        value={filters.category ?? 'all'}
        onChange={(e) => onChange({ ...filters, category: e.target.value === 'all' ? undefined : (e.target.value as Category) })}
        style={selectStyle}
      >
        <option value="all">All categories</option>
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>

      <select
        value={filters.questionType ?? 'all'}
        onChange={(e) =>
          onChange({ ...filters, questionType: e.target.value === 'all' ? undefined : (e.target.value as QuestionType) })
        }
        style={selectStyle}
      >
        <option value="all">All question types</option>
        {QUESTION_TYPES.map((type) => (
          <option key={type} value={type}>
            {QUESTION_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    </div>
  );
}
