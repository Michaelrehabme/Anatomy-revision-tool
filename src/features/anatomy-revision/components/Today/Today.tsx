import type { AnatomyRepository } from '../../data/repository';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { RevisionQuestion, QuestionType } from '../../types/question';
import { REGION_LABELS } from '../../types/region';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import { useTodayData, relativeDue } from '../../hooks/useTodayData';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import { Button } from '../shared/Button';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';

const DEFAULT_TYPES: QuestionType[] = ['flashcard', 'mcq', 'locate', 'identify-typed'];

interface TodayProps {
  repository: AnatomyRepository | null;
  userId: string | null;
  content: AnatomyContent;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onCustomSession: () => void;
  onOpenMuscle: (structureId: string) => void;
  onNavigate: (section: NavSection) => void;
}

export function Today({ repository, userId, content, onStart, onCustomSession, onOpenMuscle, onNavigate }: TodayProps) {
  const { loading, streak, totalMuscleCount, seenMusclePct, dueMuscles, weakest, comingDue, weekBuckets, weekMax, dayLabels } =
    useTodayData(repository, userId, content);
  const now = new Date();

  const handleStart = () => {
    const dueStructureIds = dueMuscles.map((m) => m.structureId);
    const questions = generateRevisionSet(content.structures, content.images, {
      types: DEFAULT_TYPES,
      mode: 'practice',
      // Prioritised, not restricted: answering a due structure reschedules it, so a
      // due-only session refills its own queue and never reaches new material.
      priorityStructureIds: dueStructureIds.length ? dueStructureIds : undefined,
      count: 20,
    });
    onStart(questions, { types: DEFAULT_TYPES, mode: 'practice' });
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
            </>
          }
        />
      }
    >
      <div className="flex gap-20 px-16 pt-16 pb-12">
        <div className="w-[440px] flex-none">
          <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h2
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 76, lineHeight: 0.98, letterSpacing: '-.032em', margin: '20px 0 0' }}
          >
            {loading ? '…' : dueMuscles.length} due
            <br />
            for review
          </h2>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--ink2)' }}>
            {dueMuscles.length > 0
              ? 'Scheduled from your recent sessions.'
              : 'Nothing scheduled — start a custom session or drill the untouched set.'}
          </p>
          <div className="mt-9 flex gap-3.5">
            <Button onClick={handleStart} className="min-w-[180px] min-h-[56px]">
              Start review
            </Button>
            <Button variant="secondary" onClick={onCustomSession} className="min-w-[150px] min-h-[56px]">
              Custom session
            </Button>
          </div>

          <div
            className="mt-14"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
          >
            This week
          </div>
          <div className="mt-5 flex h-[110px] items-end gap-3">
            {weekBuckets.map((count, i) => (
              <div
                key={i}
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
        </div>

        <div className="flex-1">
          <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            Weakest structures
          </div>
          <div className="mt-4 flex flex-col">
            {weakest.length === 0 && (
              <p className="py-4 text-sm" style={{ color: 'var(--ink3)' }}>
                No attempts recorded yet — finish a session to see this fill in.
              </p>
            )}
            {weakest.map((m) => {
              const structure = content.structuresById.get(m.structureId);
              const pct = Math.round((m.attemptsCorrect / m.attemptsTotal) * 100);
              return (
                <button
                  key={m.structureId}
                  type="button"
                  onClick={() => onOpenMuscle(m.structureId)}
                  className="flex items-baseline gap-4 py-4 text-left hover:opacity-70"
                >
                  <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 23, color: 'var(--ink)' }}>
                    {structure?.name ?? m.structureId}
                  </span>
                  <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                    {structure ? REGION_LABELS[structure.region] : ''}
                  </span>
                  <span
                    style={{
                      font: '500 13.5px/1 var(--font-mono)',
                      color: pct < 60 ? 'var(--acc2d)' : 'var(--accd)',
                      minWidth: 40,
                      textAlign: 'right',
                    }}
                  >
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>

          {comingDue.length > 0 && (
            <>
              <div
                className="mt-14"
                style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
              >
                Coming due
              </div>
              <div className="mt-4 flex flex-col">
                {comingDue.map((m) => {
                  const structure = content.structuresById.get(m.structureId);
                  return (
                    <div key={m.structureId} className="flex items-baseline gap-4 py-3">
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
