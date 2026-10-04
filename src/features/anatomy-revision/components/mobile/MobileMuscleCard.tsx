import { useEffect } from 'react';
import { useFactMastery } from '../../hooks/useFactMastery';
import { BloodSupplyFacts } from '../shared/BloodSupplyFacts';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import { MasteryLevelBadge } from '../shared/MasteryLevelBadge';
import { structureLevel } from '../../lib/masteryLevel';
import { SkillBreakdown } from '../shared/SkillBreakdown';
import { getShowLatin } from '../../lib/preferences';
import { structureTitle } from '../shared/PageTitle';
import type { AnatomyRepository } from '../../data/repository';
import { areasOf, isMuscle } from '../../types/structure';
import { REGION_LABELS } from '../../types/region';
import { useMuscleHistory } from '../../hooks/useMuscleHistory';
import { AttributionBadge } from '../shared/AttributionBadge';
import { LockedStructureNotice } from '../shared/AreaLock';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { PronounceButton } from '../shared/PronounceButton';

interface MobileMuscleCardProps {
  structureId: string;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onBack: () => void;
  onDrill: (structureId: string) => void;
  /** What this account may reach — see MuscleCard.tsx. */
  access: UseEntitlement;
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
export function MobileMuscleCard({ access, structureId, content, repository, userId, onBack, onDrill }: MobileMuscleCardProps) {
  const mastery = useMuscleHistory(repository, userId, structureId);
  const factsByKey = useFactMastery(repository, userId);
  const cardStructure = content.structuresById.get(structureId);
  // The average over this structure's question types, with each listed below it.
  const level = cardStructure ? structureLevel(cardStructure, mastery ?? undefined, factsByKey) : null;
  const showLatin = getShowLatin();
  const titleName = content.structuresById.get(structureId)?.name;
  useEffect(() => {
    if (titleName) document.title = structureTitle(titleName);
  }, [titleName]);
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
  // The whole card is gated, not just the drill at the foot of it: on a phone
  // the lock used to sit three screens below the facts it was locking. See
  // LockedStructureNotice.
  const locked = !areasOf(structure).some((a) => access.areas.includes(a));

  return (
    <main className="flex min-h-screen flex-col px-6.5 pt-4 pb-7.5" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      <button type="button" onClick={onBack} className="border-0 bg-transparent p-0 pb-2" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
        &larr; Back
      </button>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}>
        {REGION_LABELS[structure.region]}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <h1
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 38, lineHeight: 1.02, letterSpacing: '-.024em' }}
        >
          {structure.name}
        </h1>
        <PronounceButton structure={structure} size={19} />
      </div>
      {structure.phoneticSpelling && (
        <div className="mt-0.5" style={{ font: '400 12.5px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>
          {structure.phoneticSpelling}
        </div>
      )}
      {showLatin && structure.latin && (
        <div lang="la" className="mt-0.5" style={{ font: 'italic 400 13.5px/1.4 var(--font-ui)', color: 'var(--ink3)' }}>
          {structure.latin}
        </div>
      )}
      {structure.groups?.length ? (
        <p className="mt-1.5" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17, color: 'var(--ink3)' }}>
          {structure.groups[0]}
        </p>
      ) : null}

      {locked ? (
        <div className="mt-5">
          <LockedStructureNotice structure={structure} access={access} />
        </div>
      ) : (
      <>
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
        <BloodSupplyFacts structure={structure} compact />
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
      </>
      )}

      {/* The student's own record stays on a locked card: it is theirs, and a
          structure revised before the free area was changed has one. */}
      <div
        className={locked ? 'mt-7' : 'mt-3.5'}
        style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
      >
        Your record
      </div>
      {level && (
        <div className="mt-2.5">
          <MasteryLevelBadge state={level} />
          {level.next && (
            <div className="mt-1.5" style={{ font: '400 12px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
              Next: {level.next}
            </div>
          )}
          <div className="mt-2.5">
            <SkillBreakdown state={level} />
          </div>
        </div>
      )}

      {!locked && (
        <button
          type="button"
          onClick={() => onDrill(structure.id)}
          className="mt-5 w-full rounded-[3px]"
          style={{ minHeight: 50, background: 'none', border: '1.3px solid var(--line)', color: 'var(--ink)', font: '500 15.5px/1 var(--font-ui)' }}
        >
          Drill this muscle
        </button>
      )}
    </main>
  );
}
