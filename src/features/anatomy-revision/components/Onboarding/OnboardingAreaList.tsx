import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { Area } from '../../types/region';
import { AREAS, AREA_LABELS } from '../../types/region';
import { areaOf } from '../../types/structure';

interface OnboardingAreaListProps {
  content: AnatomyContent;
  selected: ReadonlySet<Area>;
  onToggle: (area: Area) => void;
  /** Two columns for a phone, one for the desktop side panel. */
  columns?: 1 | 2;
}

/** The area checklist for onboarding step one, on both breakpoints. Counts every category, as the pickers do (CR-017). */
export function OnboardingAreaList({ content, selected, onToggle, columns = 1 }: OnboardingAreaListProps) {
  const countByArea = new Map<Area, number>();
  for (const s of content.structures) {
    const area = areaOf(s);
    if (area) countByArea.set(area, (countByArea.get(area) ?? 0) + 1);
  }

  return (
    <div className={columns === 2 ? 'grid grid-cols-2 gap-x-3.5' : 'flex flex-col'}>
      {AREAS.map((area) => {
        const isSelected = selected.has(area);
        return (
          <button
            key={area}
            type="button"
            onClick={() => onToggle(area)}
            aria-pressed={isSelected}
            className="flex min-h-[44px] items-start gap-2.5 border-0 bg-transparent py-1.5 text-left hover:opacity-80"
          >
            <span
              className="mt-1 h-3 w-3 flex-none rounded-sm"
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
