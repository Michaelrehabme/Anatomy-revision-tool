import { useEffect } from 'react';
import { useFactMastery } from '../../hooks/useFactMastery';
import { BloodSupplyFacts } from '../shared/BloodSupplyFacts';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import { areasOf, isMuscle } from '../../types/structure';
import { useMuscleHistory } from '../../hooks/useMuscleHistory';
import { REGION_LABELS } from '../../types/region';
import { AttributionBadge } from '../shared/AttributionBadge';
import { Button } from '../shared/Button';
import { LockedStructureNotice } from '../shared/AreaLock';
import { StructureFactsUnavailable } from '../shared/AreaFactsNotice';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { PronounceButton } from '../shared/PronounceButton';
import { MasteryLevelBadge } from '../shared/MasteryLevelBadge';
import { structureLevel } from '../../lib/masteryLevel';
import { SkillBreakdown } from '../shared/SkillBreakdown';
import { getShowLatin } from '../../lib/preferences';
import { structureTitle } from '../shared/PageTitle';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

interface MuscleCardProps {
  /** What this account may reach — a locked structure's card is its name and the way to unlock it (AreaLock.tsx). */
  access: UseEntitlement;
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
  access,
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
  const factsByKey = useFactMastery(repository, userId);
  const cardStructure = content.indexById.get(structureId);
  // The average over this structure's question types, with each listed below it.
  const level = cardStructure ? structureLevel(cardStructure, mastery ?? undefined, factsByKey) : null;
  const showLatin = getShowLatin();
  const titleName = content.indexById.get(structureId)?.name;
  useEffect(() => {
    if (titleName) document.title = structureTitle(titleName);
  }, [titleName]);

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

  // TWO LOOKUPS. The index entry is the card's heading: name, region, Latin,
  // the student's level — there for every structure, whatever the account
  // holds. The facts are the card's body, and are there only when the
  // structure's area is on the device. A locked structure has no facts here
  // at all in a build that fetches them per area, and must still get its name
  // and its lock; one the account may reach but which is not loaded gets its
  // name, its picture and an honest reason (AreaFactsNotice.tsx).
  const structure = content.indexById.get(structureId);
  const facts = content.structuresById.get(structureId);
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

  const muscle = facts && isMuscle(facts) ? facts : null;
  // A card has an address, so it is gated here as well as in the atlas that
  // lists it: the whole of it, not just the drill. See LockedStructureNotice.
  const locked = !areasOf(structure).some((a) => access.areas.includes(a));
  // The area to name when the facts are not in hand: the first one the
  // account may reach, which is the one that would bring them.
  const ownArea = areasOf(structure).find((a) => access.areas.includes(a)) ?? areasOf(structure)[0];

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
              {level && (
                <div className="mt-3">
                  <MasteryLevelBadge state={level} />
                  {level.next && (
                    <div className="mt-2" style={{ font: '400 12px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
                      Next: {level.next}
                    </div>
                  )}
                  <div className="mt-3">
                    <SkillBreakdown state={level} />
                  </div>
                </div>
              )}
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
        {!locked && (
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
        )}

        <div className={locked ? 'max-w-[640px] flex-1' : 'flex-1'}>
          <button type="button" onClick={onBack} className="text-[15px]" style={{ color: 'var(--ink3)' }}>
            &larr; Atlas
          </button>
          <div
            className="mt-6"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}
          >
            {REGION_LABELS[structure.region]}
            {structure.groups?.length ? ` · ${structure.groups[0]}` : ''}
          </div>
          <div className="mt-[18px] flex items-center gap-2.5">
            <h1
              style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 58, lineHeight: 1, letterSpacing: '-.028em', margin: 0 }}
            >
              {structure.name}
            </h1>
            <PronounceButton structure={structure} size={22} />
          </div>
          {structure.phoneticSpelling && (
            <div className="mt-1.5" style={{ font: '400 14px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>
              {structure.phoneticSpelling}
            </div>
          )}
          {showLatin && structure.latin && (
            <div lang="la" className="mt-1" style={{ font: 'italic 400 15px/1.4 var(--font-ui)', color: 'var(--ink3)' }}>
              {structure.latin}
            </div>
          )}

          {locked ? (
            <div className="mt-9">
              <LockedStructureNotice structure={structure} access={access} />
            </div>
          ) : !facts ? (
            <div className="mt-9">
              <StructureFactsUnavailable area={ownArea} facts={content.facts} />
            </div>
          ) : (
          <>
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
            <BloodSupplyFacts structure={facts} />
            {facts.clinical && (
              <div className="py-4.5">
                <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                  Clinical note
                </div>
                <p className="mt-2 max-w-[48ch] text-base leading-relaxed" style={{ color: 'var(--ink2)' }}>
                  {facts.clinical}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6">
            <Button variant="secondary" onClick={() => onDrill(structure.id)} className="min-w-[180px] min-h-[52px]">
              Drill this muscle
            </Button>
          </div>
          </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
