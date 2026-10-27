import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnatomyRepository } from '../../data/repository';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { RevisionQuestion } from '../../types/question';
import { AREA_LABELS, REGION_LABELS, type Area } from '../../types/region';
import { STARTER_COUNT } from '../../lib/questionGenerators/starterSet';
import { buildDailySession, type DailyStyle } from '../../lib/dailySession';
import type { WeeklyFocus } from '../../lib/studyProfile';
import { useStudyProfile } from '../../hooks/useStudyProfile';
import { useClassChallenge } from '../../hooks/useClassChallenge';
import { WeeklyFocusCard } from '../shared/WeeklyFocusCard';
import { DailyGoalRing } from '../shared/DailyGoalRing';
import { dailyGoalFor } from '../../lib/studyProfile';
import { getLearnCardAttempts, getPreferredAreas } from '../../lib/preferences';
import { firstRunTitle, minutesFor } from '../../lib/sessionCopy';
import { useTodayData } from '../../hooks/useTodayData';
import { dueStructureIds, relativeDue, reviewItemsInArea } from '../../lib/reviewQueue';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import { Button } from '../shared/Button';
import { ClassAssignments } from '../shared/ClassAssignments';
import { ReviewAreaSelect } from '../shared/ReviewAreaSelect';
import { PaymentIssue } from '../shared/PaymentIssue';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import type { UseEntitlement } from '../../hooks/useEntitlement';

interface TodayProps {
  /** What this account may reach — the starter set and the due queue are both clamped to it. */
  access: UseEntitlement;
  repository: AnatomyRepository | null;
  userId: string | null;
  content: AnatomyContent;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onCustomSession: () => void;
  onOpenMuscle: (structureId: string) => void;
  onNavigate: (section: NavSection) => void;
}

export function Today({ access, repository, userId, content, onStart, onCustomSession, onOpenMuscle, onNavigate }: TodayProps) {
  const { loading, streak, totalMuscleCount, seenMusclePct, totalStructureCount, seenStructureCount, allMastery, weakest, comingDue, reviewItems, spreadItems, dueCount: dueCountAll, facts, weekBuckets, weekMax, dayLabels, questionsToday } =
    useTodayData(repository, userId, content, access.areas);
  const now = new Date();
  // Nothing attempted yet: the first session is the guided starter, and the
  // headline is an invitation rather than "0 due".
  const firstRun = !loading && allMastery.length === 0;
  // Their saved preference, narrowed to what they may reach. Undefined means
  // "no preference", which generateRevisionSet reads as every ENTITLED area —
  // never as every area.
  const preferredAreas = getPreferredAreas().filter((a) => access.areas.includes(a));
  // One area picked for today's review (ReviewAreaSelect): the queue and the
  // new structures are both cut to it, and the headline counts it alone.
  const [reviewArea, setReviewArea] = useState<Area | 'all'>('all');
  const only = reviewArea !== 'all' && access.areas.includes(reviewArea) ? reviewArea : null;
  const areas = only ? [only] : preferredAreas.length ? preferredAreas : undefined;
  const dueCount = only ? dueStructureIds(reviewItemsInArea(reviewItems, only, content.structuresById)).size : dueCountAll;
  const navigate = useNavigate();

  // The session behind each button, built the same way on desktop and mobile
  // (lib/dailySession.ts), leaned by the questionnaire's answers.
  const studyProfile = useStudyProfile();
  const challenge = useClassChallenge(userId);
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
    <AppShell
      sidebar={
        <NavSidebar
          active="today"
          onNavigate={onNavigate}
          footer={
            <>
              <div style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--acc2d)' }}>
                {streak}-day streak
              </div>
              <div className="mt-1.5" style={{ font: '400 11.5px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
                {totalMuscleCount} muscles · {seenMusclePct}% seen
              </div>
              <div className="mt-1" style={{ font: '400 11.5px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
                {seenStructureCount} of {totalStructureCount} structures
              </div>
            </>
          }
        />
      }
    >
      {/* A failed renewal, said once here and dismissible for the session.
          Renders nothing for everybody else. */}
      <PaymentIssue access={access} placement="today" className="mx-16 mt-10" />
      <div className="flex gap-20 px-16 pt-16 pb-12">
        <div className="w-[440px] flex-none">
          <div data-in className="flex items-center justify-between">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            {!firstRun && !loading && <DailyGoalRing done={questionsToday} goal={dailyGoalFor(studyProfile.profile)} />}
          </div>
          <h2
            data-in
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: firstRun ? 64 : 76, lineHeight: 0.98, letterSpacing: '-.032em', margin: '20px 0 0' }}
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
          <p data-in className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--ink2)' }}>
            {firstRun
              ? `${STARTER_COUNT} questions, about ${minutesFor(STARTER_COUNT)} minutes. Multiple choice and locate-on-the-image, nothing harder yet.`
              : dueCount > 0
                ? 'Keep going finishes the structures you are on. New set moves to ones you have not seen lately, with more new material.'
                : `${only ? `Nothing due in the ${AREA_LABELS[only].toLowerCase()}` : 'All caught up'}. A review now brings your weaker questions forward, plus new material; anything you know well waits until it is due.`}
          </p>

          {/* Which ones (owner, 27 Oct 2026): the Atlas, narrowed to what is due. */}
          {!firstRun && !loading && dueCount > 0 && (
            <button
              type="button"
              data-in
              onClick={() => navigate('/atlas', { state: { atlasSeen: 'due', atlasArea: only ?? undefined } })}
              className="mt-2 border-0 bg-transparent p-0 underline"
              style={{ font: '500 14px/1.4 var(--font-ui)', color: 'var(--accd)' }}
            >
              See which {dueCount === 1 ? 'structure is' : `${dueCount} structures are`} due
            </button>
          )}

          {!firstRun && access.areas.length > 1 && (
            <div data-in className="mt-7">
              <ReviewAreaSelect areas={access.areas} value={only ?? 'all'} onChange={setReviewArea} />
            </div>
          )}
          <div data-in className={`${!firstRun && access.areas.length > 1 ? 'mt-3.5' : 'mt-9'} flex flex-wrap gap-3.5`}>
            <Button onClick={() => handleStart('continue')} className={firstRun ? 'min-w-[180px] min-h-[56px]' : 'flex-1 whitespace-nowrap min-h-[56px]'}>
              {firstRun ? 'Start your first session' : 'Keep going'}
            </Button>
            {!firstRun && (
              <Button variant="secondary" onClick={() => handleStart('fresh')} className="flex-1 whitespace-nowrap min-h-[56px]">
                New set
              </Button>
            )}
            <Button variant="secondary" onClick={onCustomSession} className={firstRun ? 'min-w-[150px] min-h-[56px]' : 'flex-1 whitespace-nowrap min-h-[56px]'}>
              Custom session
            </Button>
          </div>

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
              challenge={challenge}
            />
          )}

          <ClassAssignments access={access} repository={repository} userId={userId} content={content} onStart={onStart} />

          {!firstRun && (
            <>
              <div
                data-in
                className="mt-14"
                style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
              >
                This week
              </div>
              <div className="mt-5 flex h-[110px] items-end gap-3">
                {weekBuckets.map((count, i) => (
                  <div
                    key={i}
                    data-wbar
                    className="flex-1"
                    style={{ height: `${Math.max(8, (count / weekMax) * 100)}%`, background: count > 0 ? 'var(--acc)' : 'var(--accs)' }}
                  />
                ))}
              </div>
              <div className="mt-2.5 flex gap-3">
                {dayLabels.map((d, i) => (
                  <div key={i} className="flex-1 text-center" style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                    {d}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1">
          <div data-in style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            Weakest structures
          </div>
          <div className="mt-4 flex flex-col">
            {weakest.length === 0 && (
              <p className="py-4 text-sm" style={{ color: 'var(--ink3)' }}>
                {firstRun
                  ? 'Your weakest structures, what is due, and this week’s activity appear here after your first session.'
                  : 'No attempts recorded yet — finish a session to see this fill in.'}
              </p>
            )}
            {weakest.map((m) => {
              const structure = content.indexById.get(m.structureId);
              const pct = Math.round((m.attemptsCorrect / m.attemptsTotal) * 100);
              return (
                <button
                  key={m.structureId}
                  type="button"
                  onClick={() => onOpenMuscle(m.structureId)}
                  data-row
                  className="flex items-baseline gap-4 py-4 text-left transition-[opacity,transform] duration-200 hover:translate-x-1 hover:opacity-70 motion-reduce:hover:translate-x-0"
                >
                  <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 23, color: 'var(--ink)' }}>
                    {structure?.name ?? m.structureId}
                  </span>
                  <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                    {structure ? REGION_LABELS[structure.region] : ''}
                  </span>
                  <span
                    data-count
                    className="tabular-nums"
                    style={{
                      font: '500 13.5px/1 var(--font-mono)',
                      color: pct < 60 ? 'var(--acc2d)' : 'var(--accd)',
                      minWidth: 40,
                      textAlign: 'right',
                    }}
                  >
                    {`${pct}%`}
                  </span>
                </button>
              );
            })}
          </div>

          {comingDue.length > 0 && (
            <>
              <div
                data-in
                className="mt-14"
                style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
              >
                Coming due
              </div>
              <div className="mt-4 flex flex-col">
                {comingDue.map((m) => {
                  const structure = content.indexById.get(m.structureId);
                  return (
                    <div key={m.structureId} data-row className="flex items-baseline gap-4 py-3">
                      <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink2)' }}>
                        {structure?.name ?? m.structureId}
                      </span>
                      <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                        {relativeDue(m.dueAt!, now)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
