import { useEffect } from 'react';
import { useFactMastery } from '../../hooks/useFactMastery';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import { MasteryLevelBadge } from '../shared/MasteryLevelBadge';
import { structureLevel } from '../../lib/masteryLevel';
import { SkillBreakdown } from '../shared/SkillBreakdown';
import { getShowLatin } from '../../lib/preferences';
import { structureTitle } from '../shared/PageTitle';
import type { AnatomyRepository } from '../../data/repository';
import { areasOf } from '../../types/structure';
import { REGION_LABELS } from '../../types/region';
import { useMuscleHistory } from '../../hooks/useMuscleHistory';
import { StructureCardFacts, StructurePicture, drillLabel } from '../shared/StructureCardBody';
import { LockedStructureNotice } from '../shared/AreaLock';
import { StructureFactsUnavailable } from '../shared/AreaFactsNotice';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { PronounceButton } from '../shared/PronounceButton';
import { StarButton } from '../shared/StarButton';
import { MobileShell } from './MobileShell';
import type { MobileTab } from './MobileTabBar';

interface MobileMuscleCardProps {
  structureId: string;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onBack: () => void;
  onDrill: (structureId: string) => void;
  /** What this account may reach — see MuscleCard.tsx. */
  access: UseEntitlement;
  /**
   * Omitted when the card was opened from inside a running session: a tab
   * there would abandon the session, so the card keeps only its back link
   * (App.tsx StructureRoute).
   */
  onNavigateTab?: (tab: MobileTab) => void;
}

/**
 * Screen 10 (mobile). Image above facts (desktop puts them side by side).
 * No J/K nav — a back link to wherever it was opened from rather than a
 * swipe-through browse context. Under the Atlas tab, as a page of the Atlas,
 * except when opened mid-session (see onNavigateTab).
 */
export function MobileMuscleCard({ access, structureId, content, repository, userId, onBack, onDrill, onNavigateTab }: MobileMuscleCardProps) {
  const mastery = useMuscleHistory(repository, userId, structureId);
  const factsByKey = useFactMastery(repository, userId);
  const cardStructure = content.indexById.get(structureId);
  // The average over this structure's question types, with each listed below it.
  const level = cardStructure ? structureLevel(cardStructure, mastery ?? undefined, factsByKey) : null;
  const showLatin = getShowLatin();
  const titleName = content.indexById.get(structureId)?.name;
  useEffect(() => {
    if (titleName) document.title = structureTitle(titleName);
  }, [titleName]);
  // The heading from the index, the body from the facts in hand: see MuscleCard.tsx.
  const structure = content.indexById.get(structureId);
  const facts = content.structuresById.get(structureId);

  if (!structure) {
    return (
      <div className="p-6.5" style={{ color: 'var(--acc2d)' }}>
        Structure "{structureId}" not found.
      </div>
    );
  }

  // The whole card is gated, not just the drill at the foot of it: on a phone
  // the lock used to sit three screens below the facts it was locking. See
  // LockedStructureNotice.
  const locked = !areasOf(structure).some((a) => access.areas.includes(a));
  const ownArea = areasOf(structure).find((a) => access.areas.includes(a)) ?? areasOf(structure)[0];

  return (
    <MobileShell tabs={onNavigateTab && { active: 'atlas', onNavigate: onNavigateTab }}>
      <div className="flex flex-col px-6.5 pt-4 pb-7.5">
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
          <StarButton structureId={structure.id} name={structure.name} size={19} />
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
        <div className="mt-4">
          <StructurePicture structure={structure} images={content.images} compact />
        </div>

        {!facts && (
          <div className="mt-4">
            <StructureFactsUnavailable area={ownArea} facts={content.facts} />
          </div>
        )}
        {/* The words come from lib/atlasFacts: one wording for both cards, the
            Atlas table and the diagnostic papers. */}
        {facts && (
          <div className="mt-2">
            <StructureCardFacts structure={facts} byId={content.indexById} compact />
          </div>
        )}
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

        {!locked && facts && (
          <button
            type="button"
            onClick={() => onDrill(structure.id)}
            className="mt-5 w-full rounded-[3px]"
            style={{ minHeight: 50, background: 'none', border: '1.3px solid var(--line)', color: 'var(--ink)', font: '500 15.5px/1 var(--font-ui)' }}
          >
            {drillLabel(structure)}
          </button>
        )}
      </div>
    </MobileShell>
  );
}
