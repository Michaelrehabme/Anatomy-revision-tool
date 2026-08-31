import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { Area } from '../../types/region';
import { AREAS, AREA_LABELS } from '../../types/region';
import { areaOf } from '../../types/structure';
import { BodyFigure } from '../shared/BodyFigure';
import { MobileShell } from './MobileShell';
import type { MobileTab } from './MobileTabBar';

interface MobileRegionPickerProps {
  content: AnatomyContent;
  selected: Set<Area>;
  onChange: (next: Set<Area>) => void;
  onContinue: () => void;
  onBack: () => void;
  onNavigateTab: (tab: MobileTab) => void;
}

/** Screen 03 (mobile). Figure and area list stacked vertically (desktop puts them side by side). */
export function MobileRegionPicker({ content, selected, onChange, onContinue, onBack, onNavigateTab }: MobileRegionPickerProps) {
  // Counts every category, not just muscles — matching the desktop picker (CR-017).
  const countByArea = new Map<Area, number>();
  for (const s of content.structures) {
    const area = areaOf(s);
    if (area) countByArea.set(area, (countByArea.get(area) ?? 0) + 1);
  }

  const toggle = (area: Area) => {
    const next = new Set(selected);
    if (next.has(area)) next.delete(area);
    else next.add(area);
    onChange(next);
  };

  const poolSize = content.structures.filter((s) => {
    const area = areaOf(s);
    return selected.size === 0 || (!!area && selected.has(area));
  }).length;

  return (
    <MobileShell tabs={{ active: 'picker', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4 pb-6">
        <button type="button" onClick={onBack} className="border-0 bg-transparent p-0 pb-2.5" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
          &larr; Today
        </button>
        <h2
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30, lineHeight: 1.05, letterSpacing: '-.02em', margin: '2px 0 5px' }}
        >
          Pick your areas
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink3)' }}>
          Tap the body. Everything outside your selection stays out of the pool.
        </p>

        <div className="mt-1 flex justify-center">
          <div style={{ width: 134 }}>
            <BodyFigure selected={selected} onToggle={toggle} />
          </div>
        </div>

        <div className="mt-0.5 grid grid-cols-2 gap-x-3.5 gap-y-0.5">
          {AREAS.map((area) => {
            const isSelected = selected.has(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggle(area)}
                className="flex min-h-[44px] items-start gap-2.5 border-0 bg-transparent py-1.5 text-left"
                style={{ opacity: isSelected ? 1 : 1 }}
              >
                <span
                  className="mt-0.5 h-2.5 w-2.5 flex-none rounded-sm"
                  style={{ background: isSelected ? 'var(--acc)' : 'transparent', boxShadow: 'inset 0 0 0 1.2px var(--ink3)' }}
                />
                <span className="flex-1">
                  <span className="block" style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.2, color: isSelected ? 'var(--ink)' : 'var(--ink3)' }}>
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

        <div className="flex gap-4.5">
          <button type="button" onClick={() => onChange(new Set(AREAS))} className="border-0 bg-transparent py-1.5 text-[13.5px] underline" style={{ color: 'var(--accd)' }}>
            Select all
          </button>
          <button type="button" onClick={() => onChange(new Set())} className="border-0 bg-transparent py-1.5 text-[13.5px] underline" style={{ color: 'var(--accd)' }}>
            Clear
          </button>
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={poolSize === 0}
          className="mt-2.5 w-full rounded-[3px] border-0 disabled:opacity-45"
          style={{ minHeight: 52, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
        >
          {poolSize > 0 ? `${poolSize} structures — continue` : 'Select at least one area'}
        </button>
      </div>
    </MobileShell>
  );
}
