import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { Region } from '../../types/region';
import { REGIONS, REGION_LABELS } from '../../types/region';
import { isMuscle } from '../../types/structure';
import { BodyFigure } from '../shared/BodyFigure';
import { Button } from '../shared/Button';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

interface RegionPickerProps {
  content: AnatomyContent;
  selected: Set<Region>;
  onChange: (next: Set<Region>) => void;
  onContinue: () => void;
  onNavigate: (section: NavSection) => void;
}

/**
 * Screen 03. Multi-select region picker — the body figure and the list stay
 * in sync. Counts are muscles only (like the mockup's "122 muscles"): the
 * app's content also includes bones/landmarks, but this picker is scoped to
 * the muscle-atlas flow the mockup describes.
 */
export function RegionPicker({ content, selected, onChange, onContinue, onNavigate }: RegionPickerProps) {
  const muscles = content.structures.filter(isMuscle);
  const countByRegion = new Map<Region, number>();
  for (const s of muscles) countByRegion.set(s.region, (countByRegion.get(s.region) ?? 0) + 1);

  const toggle = (region: Region) => {
    const next = new Set(selected);
    if (next.has(region)) next.delete(region);
    else next.add(region);
    onChange(next);
  };

  const poolSize = muscles.filter((s) => selected.size === 0 || selected.has(s.region)).length;

  return (
    <AppShell
      sidebar={
        <NavSidebar
          active="study"
          onNavigate={onNavigate}
          footer={
            <div style={{ font: '400 11.5px/1.6 var(--font-mono)', color: 'var(--ink3)' }}>
              Step 1 of 2
              <br />
              Regions
            </div>
          }
        />
      }
    >
      <div className="flex items-start gap-[72px] px-16 pt-16 pb-12">
        <div className="w-[300px] flex-none">
          <BodyFigure selected={selected} onToggle={toggle} />
        </div>
        <div className="flex-1">
          <h2
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.02, letterSpacing: '-.026em', margin: '0 0 14px' }}
          >
            Pick your regions
          </h2>
          <p className="max-w-md text-base leading-relaxed" style={{ color: 'var(--ink2)' }}>
            Click the body or the list. Everything outside your selection stays out of the question pool.
          </p>

          <div className="mt-9 flex flex-col">
            {REGIONS.map((region) => {
              const isSelected = selected.size === 0 || selected.has(region);
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => toggle(region)}
                  className="flex items-start gap-3.5 py-3.5 text-left hover:opacity-70"
                  style={{ opacity: isSelected ? 1 : 0.45 }}
                >
                  <span
                    className="mt-1.5 h-3.5 w-3.5 flex-none rounded-sm"
                    style={{ background: isSelected ? 'var(--acc)' : 'var(--sf)', boxShadow: 'inset 0 0 0 1.2px var(--ink3)' }}
                  />
                  <span className="flex-1">
                    <span className="block" style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.2 }}>
                      {REGION_LABELS[region]}
                    </span>
                    <span className="mt-0.5 block" style={{ font: '400 12px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
                      {countByRegion.get(region) ?? 0} muscles
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex gap-5">
            <button type="button" onClick={() => onChange(new Set(REGIONS))} className="text-sm underline" style={{ color: 'var(--accd)' }}>
              Select all
            </button>
            <button type="button" onClick={() => onChange(new Set())} className="text-sm underline" style={{ color: 'var(--accd)' }}>
              Clear
            </button>
          </div>

          <div className="mt-11 flex items-center gap-5">
            <Button onClick={onContinue} className="min-w-[220px] min-h-[56px]">
              Continue
            </Button>
            <span style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink3)' }}>
              {poolSize} muscles in the pool
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
