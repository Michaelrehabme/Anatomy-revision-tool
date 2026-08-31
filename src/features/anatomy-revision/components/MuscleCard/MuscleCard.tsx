import { useEffect } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import { isMuscle } from '../../types/structure';
import { useMuscleHistory } from '../../hooks/useMuscleHistory';
import { REGION_LABELS } from '../../types/region';
import { AttributionBadge } from '../shared/AttributionBadge';
import { Button } from '../shared/Button';
import { PronounceButton } from '../shared/PronounceButton';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

interface MuscleCardProps {
  structureId: string;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  /** The list this card was opened from — powers J/K prev/next. */
  contextIds: string[];
  onNavigateStructure: (structureId: string) => void;
  onBack: () => void;
  onDrill: (structureId: string) => void;
  onNavigate: (section: NavSection) => void;
}

const FACT_ROWS = [
  { key: 'origin', label: 'Origin' },
  { key: 'insertion', label: 'Insertion' },
] as const;

export function MuscleCard({
  structureId,
  content,
  repository,
  userId,
  contextIds,
  onNavigateStructure,
  onBack,
  onDrill,
  onNavigate,
}: MuscleCardProps) {
  const mastery = useMuscleHistory(repository, userId, structureId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'j' && e.key !== 'k') return;
      const index = contextIds.indexOf(structureId);
      if (index === -1) return;
      const nextIndex = e.key === 'j' ? index + 1 : index - 1;
      const next = contextIds[nextIndex];
      if (next) onNavigateStructure(next);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [contextIds, structureId, onNavigateStructure]);

  const structure = content.structuresById.get(structureId);
  const panelImage = content.images.find(
    (img) => img.mode === 'single-structure' && img.structureId === structureId,
  );

  if (!structure) {
    return (
      <div className="p-16" style={{ color: 'var(--acc2d)' }}>
        Structure "{structureId}" not found.
      </div>
    );
  }

  const muscle = isMuscle(structure) ? structure : null;

  return (
    <AppShell
      sidebar={
        <NavSidebar
          active="atlas"
          onNavigate={onNavigate}
          footer={
            <>
              <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                Your history
              </div>
              <div className="mt-3" style={{ font: '400 13px/1.9 var(--font-mono)', color: 'var(--ink2)' }}>
                {mastery ? (
                  <>
                    {mastery.attemptsTotal} attempts
                    <br />
                    {Math.round((mastery.attemptsCorrect / mastery.attemptsTotal) * 100)}% correct
                    <br />
                    {mastery.dueAt ? `due ${new Date(mastery.dueAt).toLocaleDateString()}` : 'not yet due'}
                  </>
                ) : (
                  'No attempts yet'
                )}
              </div>
              <div className="flex-1" />
              <div style={{ font: '400 11.5px/1.6 var(--font-mono)', color: 'var(--ink3)' }}>
                J / K to move
                <br />
                between muscles
              </div>
            </>
          }
        />
      }
    >
      <div className="flex gap-[72px] px-16 py-14">
        <div className="flex w-[480px] flex-none flex-col">
          <div
            className="flex min-h-[420px] flex-1 items-center justify-center overflow-hidden rounded-[3px]"
            style={{ background: 'var(--fig-off)' }}
          >
            {panelImage ? (
              <img src={panelImage.filePath} alt={structure.name} className="h-full w-full object-contain" />
            ) : (
              <span style={{ color: 'var(--ink3)' }}>No image yet</span>
            )}
          </div>
          {panelImage && <AttributionBadge image={panelImage} />}
        </div>

        <div className="flex-1">
          <button type="button" onClick={onBack} className="text-[15px]" style={{ color: 'var(--ink3)' }}>
            &larr; Atlas
          </button>
          <div
            className="mt-6"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--acc)' }}
          >
            {REGION_LABELS[structure.region]}
            {structure.groups?.length ? ` · ${structure.groups[0]}` : ''}
          </div>
          <div className="mt-[18px] flex items-center gap-2.5">
            <h2
              style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 58, lineHeight: 1, letterSpacing: '-.028em', margin: 0 }}
            >
              {structure.name}
            </h2>
            <PronounceButton structure={structure} size={22} />
          </div>
          {structure.phoneticSpelling && (
            <div className="mt-1.5" style={{ font: '400 14px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>
              {structure.phoneticSpelling}
            </div>
          )}

          <div className="mt-9 flex flex-col">
            {muscle &&
              FACT_ROWS.map(({ key, label }) => (
                <div key={key} className="py-4.5">
                  <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                    {label}
                  </div>
                  <div className="mt-2 text-lg leading-relaxed">{muscle[key].join('; ')}</div>
                </div>
              ))}
            {muscle && (
              <div className="py-4.5">
                <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                  Action
                </div>
                <div className="mt-2 text-lg leading-relaxed">{muscle.actionText}</div>
              </div>
            )}
            {muscle && muscle.nerve.length > 0 && (
              <div className="py-4.5">
                <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                  Innervation
                </div>
                <div className="mt-2 text-lg leading-relaxed">
                  {muscle.nerve.map((n) => n.name).join(', ')}
                </div>
              </div>
            )}
            {structure.clinical && (
              <div className="py-4.5">
                <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                  Clinical note
                </div>
                <p className="mt-2 max-w-[48ch] text-base leading-relaxed" style={{ color: 'var(--ink2)' }}>
                  {structure.clinical}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6">
            <Button variant="secondary" onClick={() => onDrill(structure.id)} className="min-w-[180px] min-h-[52px]">
              Drill this muscle
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
