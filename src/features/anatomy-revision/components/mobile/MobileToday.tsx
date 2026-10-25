import { useState } from 'react';
import type { AnatomyRepository } from '../../data/repository';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { RevisionQuestion } from '../../types/question';
import { AREA_LABELS, REGION_LABELS, type Area } from '../../types/region';
import { STARTER_COUNT } from '../../lib/questionGenerators/starterSet';
import { buildDailySession, type DailyStyle } from '../../lib/dailySession';
import type { WeeklyFocus } from '../../lib/studyProfile';
import { useStudyProfile } from '../../hooks/useStudyProfile';
import { WeeklyFocusCard } from '../shared/WeeklyFocusCard';
import { DailyGoalRing } from '../shared/DailyGoalRing';
import { dailyGoalFor } from '../../lib/studyProfile';
import { getLearnCardAttempts, getPreferredAreas } from '../../lib/preferences';
import { firstRunTitle, minutesFor } from '../../lib/sessionCopy';
import { useTodayData } from '../../hooks/useTodayData';
import { reviewItemsInArea } from '../../lib/reviewQueue';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { MobileShell } from './MobileShell';
import { ClassAssignments } from '../shared/ClassAssignments';
import { ReviewAreaSelect } from '../shared/ReviewAreaSelect';
import { PaymentIssue } from '../shared/PaymentIssue';
import { InstallCard } from '../../../pwa/InstallCard';
import { AdminShortcut } from '../shared/AdminShortcut';
import type { MobileTab } from './MobileTabBar';

interface MobileTodayProps {
  /** What this account may reach — see Today.tsx. */
  access: UseEntitlement;
  repository: AnatomyRepository | null;
  userId: string | null;
  content: AnatomyContent;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onCustomSession: () => void;
  onOpenMuscle: (structureId: string) => void;
  onNavigateTab: (tab: MobileTab) => void;
}

/** Screen 02 (mobile). Single decision on open: due count, one primary action. */
export function MobileToday({ access, repository, userId, content, onStart, onCustomSession, onOpenMuscle, onNavigateTab }: MobileTodayProps) {
  const { loading, streak, allMastery, weakest, reviewItems, spreadItems, dueCount: dueCountAll, facts, weekBuckets, weekMax, dayLabels, questionsToday } = useTodayData(repository, userId, content, access.areas);
  const now = new Date();
  // See Today.tsx: the guided starter until something has been attempted.
  const firstRun = !loading && allMastery.length === 0;
  // Narrowed to the entitled areas — see Today.tsx for why undefined is safe.
  const preferredAreas = getPreferredAreas().filter((a) => access.areas.includes(a));
  // One area picked for today's review — see Today.tsx.
  const [reviewArea, setReviewArea] = useState<Area | 'all'>('all');
  const only = reviewArea !== 'all' && access.areas.includes(reviewArea) ? reviewArea : null;
  const areas = only ? [only] : preferredAreas.length ? preferredAreas : undefined;
  const dueCount = only ? reviewItemsInArea(reviewItems, only, content.structuresById).filter((i) => i.due).length : dueCountAll;

  // The session behind each button, built the same way on desktop and mobile
  // (lib/dailySession.ts), leaned by the questionnaire's answers.
  const studyProfile = useStudyProfile();
  const handleStart = (style: DailyStyle = 'continue', focus?: WeeklyFocus) => {
    const { questions, params } = buildDailySession({
      content,
      entitledAreas: access.areas,
      areas,
      only,
      firstRun,
      reviewItems,
      spreadItems,
      mastery: allMastery,
      // generateSet is repository-free (CR-009), so fact mastery is fetched by useTodayData.
      facts,
      learnCardAttempts: getLearnCardAttempts(),
      profile: studyProfile.profile,
      focus,
      style,
    });
    onStart(questions, params);
  };

  return (
    <MobileShell tabs={{ active: 'today', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4.5 pb-7.5">
        {/* A failed renewal — see Today.tsx. */}
        <PaymentIssue access={access} placement="today" className="mb-5" />
        <div className="mb-4 flex justify-end empty:hidden">
          <AdminShortcut variant="bar" />
        </div>
        <div data-in className="flex items-center justify-between">
          <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div className="flex items-center gap-3.5">
            {!firstRun && !loading && <DailyGoalRing done={questionsToday} goal={dailyGoalFor(studyProfile.profile)} size={30} />}
            <div style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--acc2d)' }}>{streak}-day streak</div>
          </div>
        </div>

        <h2
          data-in
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: firstRun ? 36 : 42, lineHeight: 1.02, letterSpacing: '-.022em', margin: '16px 0 0' }}
        >
          {firstRun ? (
            firstRunTitle(preferredAreas)
          ) : (
            <>
              {loading ? '…' : <span data-count className="inline-block tabular-nums">{dueCount}</span>} due
              <br />
              for review
            </>
          )}
        </h2>
        <p data-in className="mt-3 text-[15px] leading-snug" style={{ color: 'var(--ink2)' }}>
          {firstRun
            ? `${STARTER_COUNT} questions, about ${minutesFor(STARTER_COUNT)} minutes. Multiple choice and locate-on-the-image, nothing harder yet.`
            : dueCount > 0
              ? 'Keep going finishes the structures you are on. New set moves to ones you have not seen lately, with more new material.'
              : `${only ? `Nothing due in the ${AREA_LABELS[only].toLowerCase()}` : 'All caught up'}. A review now brings your weaker questions forward, plus new material; anything you know well waits until it is due.`}
        </p>

        {!firstRun && access.areas.length > 1 && (
          <div data-in className="mt-5.5">
            <ReviewAreaSelect areas={access.areas} value={only ?? 'all'} onChange={setReviewArea} />
          </div>
        )}
        <button
          type="button"
          onClick={() => handleStart('continue')}
          data-in
          className={`${!firstRun && access.areas.length > 1 ? 'mt-2.5' : 'mt-5.5'} w-full rounded-[3px] border-0 transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100`}
          style={{ minHeight: 54, background: 'var(--acc-fill)', color: 'var(--onacc)', font: '500 17px/1 var(--font-ui)' }}
        >
          {firstRun ? 'Start your first session' : 'Keep going'}
        </button>
        {!firstRun && (
          <button
            type="button"
            onClick={() => handleStart('fresh')}
            data-in
            className="mt-2.5 w-full rounded-[3px] transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100"
            style={{ minHeight: 50, background: 'none', border: '1.3px solid var(--line)', color: 'var(--ink)', font: '500 15.5px/1 var(--font-ui)' }}
          >
            New set
          </button>
        )}
        <button
          type="button"
          onClick={onCustomSession}
          data-in
          className="mt-2.5 w-full rounded-[3px] transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100"
          style={{ minHeight: 50, background: 'none', border: '1.3px solid var(--line)', color: 'var(--ink)', font: '500 15.5px/1 var(--font-ui)' }}
        >
          Custom session
        </button>

        {/* After the first session, never before it: a focus means nothing until something has been met. */}
        {!firstRun && (
          <WeeklyFocusCard
            access={access}
            content={content}
            studyProfile={studyProfile}
            mastery={allMastery}
            facts={facts}
            reviewItems={reviewItems}
            loading={loading}
            onStartFocus={(focus) => handleStart('focus', focus)}
            compact
          />
        )}

        {/* After the first session, never before it: see pwa/InstallCard. */}
        {!firstRun && !loading && <InstallCard className="mt-5" />}

        <ClassAssignments access={access} repository={repository} userId={userId} content={content} onStart={onStart} compact />

        <div
          data-in
          className="mt-9"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
        >
          Weakest structures
        </div>
        <div className="mt-3 flex flex-col">
          {weakest.length === 0 && (
            <p className="py-3 text-sm" style={{ color: 'var(--ink3)' }}>
              {firstRun ? 'Fills in after your first session.' : 'No attempts recorded yet.'}
            </p>
          )}
          {weakest.slice(0, 3).map((m) => {
            const structure = content.indexById.get(m.structureId);
            const pct = Math.round((m.attemptsCorrect / m.attemptsTotal) * 100);
            return (
              <button
                key={m.structureId}
                type="button"
                onClick={() => onOpenMuscle(m.structureId)}
                data-row
                className="flex items-baseline gap-3 border-0 bg-transparent py-3.5 text-left"
              >
                <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.2, color: 'var(--ink)' }}>
                  {structure?.name ?? m.structureId}
                </span>
                <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                  {structure ? REGION_LABELS[structure.region] : ''}
                </span>
                <span
                  data-count
                  className="tabular-nums"
                  style={{
                    font: '500 12.5px/1 var(--font-mono)',
                    color: pct < 60 ? 'var(--acc2d)' : 'var(--ink2)',
                    minWidth: 34,
                    textAlign: 'right',
                  }}
                >
                  {`${pct}%`}
                </span>
              </button>
            );
          })}
        </div>

        {!firstRun && (
          <>
            <div
              data-in
              className="mt-7"
              style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
            >
              This week
            </div>
            {/* Bars are direct children of the fixed-height row: a percentage
                height only resolves against a definite parent, and the
                auto-height column each bar used to sit in collapsed it to
                nothing — which is why the week read as empty on a phone. */}
            <div className="mt-4 flex h-[78px] items-end gap-2.5">
              {weekBuckets.map((count, i) => (
                <div
                  key={i}
                  data-wbar
                  className="flex-1 rounded-sm"
                  style={{ height: `${Math.max(4, (count / weekMax) * 100)}%`, background: i === 6 ? 'var(--acc)' : count === 0 ? 'var(--line)' : 'var(--fig-line)' }}
                />
              ))}
            </div>
            <div className="mt-1.5 flex gap-2.5">
              {dayLabels.map((d, i) => (
                <div key={i} className="flex-1 text-center" style={{ font: '400 10px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                  {d}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}
