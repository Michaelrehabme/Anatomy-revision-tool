import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { Area } from '../../types/region';
import { AREAS, AREA_LABELS } from '../../types/region';
import { areasOf } from '../../types/structure';

interface OnboardingAreaListProps {
  content: AnatomyContent;
  selected: ReadonlySet<Area>;
  onToggle: (area: Area) => void;
  /** Two columns for a phone, one for the desktop side panel. */
  columns?: 1 | 2;
  /** One choice, not several: a free account picking its one free area. */
  single?: boolean;
}

/** The area checklist for onboarding step one, on both breakpoints. Counts every category, as the pickers do (CR-017). */
export function OnboardingAreaList({ content, selected, onToggle, columns = 1, single = false }: OnboardingAreaListProps) {
  const countByArea = new Map<Area, number>();
  // The index: at onboarding no area's facts have been fetched yet, and the
  // counts are what a student chooses their free area by.
  for (const s of content.index) {
    // A structure spanning several areas counts under each of them (CR-032).
    for (const area of areasOf(s)) countByArea.set(area, (countByArea.get(area) ?? 0) + 1);
  }

  return (
    <div
      role={single ? 'radiogroup' : 'group'}
      aria-label={single ? 'Your free area' : 'Areas you are learning'}
      className={columns === 2 ? 'grid grid-cols-2 gap-x-3.5' : 'flex flex-col'}
    >
      {AREAS.map((area) => {
        const isSelected = selected.has(area);
        return (
          <button
            key={area}
            type="button"
            onClick={() => onToggle(area)}
            {...(single ? { role: 'radio', 'aria-checked': isSelected } : { 'aria-pressed': isSelected })}
            className="flex min-h-[44px] items-start gap-2.5 border-0 bg-transparent py-1.5 text-left hover:opacity-80"
          >
            <span
              className={`mt-1 h-3 w-3 flex-none ${single ? 'rounded-full' : 'rounded-sm'}`}
              style={{ background: isSelected ? 'var(--acc)' : 'transparent', boxShadow: 'inset 0 0 0 1.2px var(--ink3)' }}
            />
            <span className="flex-1">
              <span className="block" style={{ fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1.2, color: isSelected ? 'var(--ink)' : 'var(--ink2)' }}>
                {AREA_LABELS[area]}
              </span>
              <span className="mt-0.5 block" style={{ font: '400 10.5px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>
                {countByArea.get(area) ?? 0} structures
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
