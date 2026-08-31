import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { Area } from '../../types/region';
import { AREAS, AREA_LABELS } from '../../types/region';
import type { Category } from '../../types/structure';
import { areaOf } from '../../types/structure';
import { BodyFigure } from '../shared/BodyFigure';
import { Button } from '../shared/Button';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

interface RegionPickerProps {
  content: AnatomyContent;
  selected: Set<Area>;
  onChange: (next: Set<Area>) => void;
  onContinue: () => void;
  onNavigate: (section: NavSection) => void;
}

/** Ordered so the breakdown reads the same way every time, biggest category first. */
const COUNTED_CATEGORIES: { category: Category; singular: string; plural: string }[] = [
  { category: 'muscle', singular: 'muscle', plural: 'muscles' },
  { category: 'bone', singular: 'bone', plural: 'bones' },
  { category: 'landmark', singular: 'landmark', plural: 'landmarks' },
  { category: 'joint', singular: 'joint', plural: 'joints' },
];

/**
 * Screen 03. Multi-select area picker — the body figure and the list stay in
 * sync. Areas replaced Regions here in CR-017.
 *
 * Counts cover every category, not just muscles. They were muscles-only to match
 * the original mockup's "122 muscles", but that under-reported an area by up to
 * 5x (the shoulder has 15 muscles and 47 structures in total) and silently hid
 * the bones, landmarks and joints a session would actually draw from.
 */
export function RegionPicker({ content, selected, onChange, onContinue, onNavigate }: RegionPickerProps) {
  const byArea = new Map<Area, Map<Category, string[]>>();
  for (const s of content.structures) {
    const area = areaOf(s);
    if (!area) continue;
    const names = byArea.get(area) ?? new Map<Category, string[]>();
    names.set(s.category, [...(names.get(s.category) ?? []), s.name]);
    byArea.set(area, names);
  }

  /**
   * Counts are of study items, not of anatomical structures, because repeating bones are
   * deliberately grouped into single entries (see structures.bones.seed.ts) — "9 bones" for
   * Back & Core looks wrong next to 33 vertebrae until you can see that one of those entries
   * is "Thoracic Vertebrae (T1-T12)". Hovering a count lists the entries behind it, whose
   * names already carry their ranges, so the number and the anatomy reconcile.
   */
  const namesIn = (area: Area, category: Category) => byArea.get(area)?.get(category) ?? [];

  const segments = (area: Area) =>
    COUNTED_CATEGORIES.flatMap(({ category, singular, plural }) => {
      const names = namesIn(area, category);
      if (names.length === 0) return [];
      return [{ category, text: `${names.length} ${names.length === 1 ? singular : plural}`, names }];
    });

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
    <AppShell
      sidebar={
        <NavSidebar
          active="study"
          onNavigate={onNavigate}
          footer={
            <div style={{ font: '400 11.5px/1.6 var(--font-mono)', color: 'var(--ink3)' }}>
              Step 1 of 2
              <br />
              Areas
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
            Pick your areas
          </h2>
          <p className="max-w-md text-base leading-relaxed" style={{ color: 'var(--ink2)' }}>
            Click the body or the list. Everything outside your selection stays out of the question pool.
          </p>

          <div className="mt-9 flex flex-col">
            {AREAS.map((area) => {
              const isSelected = selected.size === 0 || selected.has(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggle(area)}
                  className="flex items-start gap-3.5 py-3.5 text-left hover:opacity-70"
                  style={{ opacity: isSelected ? 1 : 0.45 }}
                >
                  <span
                    className="mt-1.5 h-3.5 w-3.5 flex-none rounded-sm"
                    style={{ background: isSelected ? 'var(--acc)' : 'var(--sf)', boxShadow: 'inset 0 0 0 1.2px var(--ink3)' }}
                  />
                  <span className="flex-1">
                    <span className="block" style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.2 }}>
                      {AREA_LABELS[area]}
                    </span>
                    <span className="mt-0.5 block" style={{ font: '400 12px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
                      {segments(area).map((seg, i) => (
                        <span key={seg.category}>
                          {i > 0 && ' · '}
                          <span title={seg.names.join('\n')} style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                            {seg.text}
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex gap-5">
            <button type="button" onClick={() => onChange(new Set(AREAS))} className="text-sm underline" style={{ color: 'var(--accd)' }}>
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
              {poolSize} structures in the pool
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
