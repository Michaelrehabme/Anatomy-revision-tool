import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import { isMuscle } from '../../types/structure';
import { REGION_LABELS } from '../../types/region';
import { useMuscleHistory } from '../../hooks/useMuscleHistory';
import { relativeDue } from '../../hooks/useTodayData';
import { AttributionBadge } from '../shared/AttributionBadge';

interface MobileMuscleCardProps {
  structureId: string;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onBack: () => void;
  onDrill: (structureId: string) => void;
}

const FACT_ROWS = [
  { key: 'origin', label: 'Origin' },
  { key: 'insertion', label: 'Insertion' },
] as const;

/**
 * Screen 10 (mobile). Image above facts (desktop puts them side by side).
 * No tab bar, no J/K nav — reached only from Today/session "Full card",
 * matching the mockup's `learnFrom: 'home' | 'session'` back-navigation
 * rather than a broader swipe-through browse context.
 */
export function MobileMuscleCard({ structureId, content, repository, userId, onBack, onDrill }: MobileMuscleCardProps) {
  const mastery = useMuscleHistory(repository, userId, structureId);
  const structure = content.structuresById.get(structureId);
  const panelImage = content.images.find((img) => img.mode === 'single-structure' && img.structureId === structureId);

  if (!structure) {
    return (
      <div className="p-6.5" style={{ color: 'var(--acc2d)' }}>
        Structure "{structureId}" not found.
      </div>
    );
  }

  const muscle = isMuscle(structure) ? structure : null;
  const record = mastery
    ? `Seen ${mastery.attemptsTotal} time${mastery.attemptsTotal === 1 ? '' : 's'} · ${Math.round((mastery.attemptsCorrect / mastery.attemptsTotal) * 100)}% correct${mastery.dueAt ? ` · next due ${relativeDue(mastery.dueAt, new Date())}` : ''}.`
    : 'No attempts yet.';

  return (
    <div className="flex min-h-screen flex-col px-6.5 pt-4 pb-7.5" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      <button type="button" onClick={onBack} className="border-0 bg-transparent p-0 pb-2" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
        &larr; Back
      </button>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}>
        {REGION_LABELS[structure.region]}
      </div>
      <h2
        className="mt-2.5"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 38, lineHeight: 1.02, letterSpacing: '-.024em' }}
      >
        {structure.name}
      </h2>
      {structure.groups?.length ? (
        <p className="mt-1.5" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17, color: 'var(--ink3)' }}>
          {structure.groups[0]}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-[3px]" style={{ background: 'var(--fig-off)', height: 230 }}>
        {panelImage ? (
          <img src={panelImage.filePath} alt={structure.name} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: 'var(--ink3)' }}>
            No image yet
          </div>
        )}
      </div>
      {panelImage && <AttributionBadge image={panelImage} />}

      <div className="mt-2 flex flex-col">
        {muscle &&
          FACT_ROWS.map(({ key, label }) => (
            <div key={key} className="py-3.5">
              <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                {label}
              </div>
              <div className="mt-1.5 text-base leading-relaxed">{muscle[key].join('; ')}</div>
            </div>
          ))}
        {muscle && muscle.nerve.length > 0 && (
          <div className="py-3.5">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Innervation
            </div>
            <div className="mt-1.5 text-base leading-relaxed">{muscle.nerve.map((n) => n.name).join(', ')}</div>
          </div>
        )}
        {muscle && (
          <div className="py-3.5">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Action
            </div>
            <div className="mt-1.5 text-base leading-relaxed">{muscle.actionText}</div>
          </div>
        )}
        {structure.clinical && (
          <div className="py-3.5">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Clinical note
            </div>
            <p className="mt-1.5 text-[15px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
              {structure.clinical}
            </p>
          </div>
        )}
      </div>

      <div
        className="mt-3.5"
        style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
      >
        Your record
      </div>
      <p className="mt-2.5 text-[15px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
        {record}
      </p>

      <button
        type="button"
        onClick={() => onDrill(structure.id)}
        className="mt-5 w-full rounded-[3px]"
        style={{ minHeight: 50, background: 'none', border: '1.3px solid var(--line)', color: 'var(--ink)', font: '500 15.5px/1 var(--font-ui)' }}
      >
        Drill this muscle
      </button>
    </div>
  );
}
