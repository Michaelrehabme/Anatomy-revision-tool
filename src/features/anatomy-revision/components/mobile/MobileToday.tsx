import type { AnatomyRepository } from '../../data/repository';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { RevisionQuestion, QuestionType } from '../../types/question';
import { REGION_LABELS } from '../../types/region';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import { useTodayData } from '../../hooks/useTodayData';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import { MobileShell } from './MobileShell';
import type { MobileTab } from './MobileTabBar';

const DEFAULT_TYPES: QuestionType[] = ['flashcard', 'mcq', 'locate', 'identify-typed'];

interface MobileTodayProps {
  repository: AnatomyRepository | null;
  userId: string | null;
  content: AnatomyContent;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onCustomSession: () => void;
  onOpenMuscle: (structureId: string) => void;
  onNavigateTab: (tab: MobileTab) => void;
}

/** Screen 02 (mobile). Single decision on open: due count, one primary action. */
export function MobileToday({ repository, userId, content, onStart, onCustomSession, onOpenMuscle, onNavigateTab }: MobileTodayProps) {
  const { loading, streak, dueMuscles, weakest, weekBuckets, weekMax, dayLabels } = useTodayData(repository, userId, content);
  const now = new Date();

  const handleStart = () => {
    const structureIds = dueMuscles.map((m) => m.structureId);
    const questions = generateRevisionSet(content.structures, content.images, {
      types: DEFAULT_TYPES,
      mode: 'practice',
      structureIds: structureIds.length ? structureIds : undefined,
      count: 20,
    });
    onStart(questions, { types: DEFAULT_TYPES, mode: 'practice' });
  };

  return (
    <MobileShell tabs={{ active: 'today', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4.5 pb-7.5">
        <div className="flex items-baseline justify-between">
          <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--acc2d)' }}>{streak}-day streak</div>
        </div>

        <h2
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 42, lineHeight: 1.02, letterSpacing: '-.022em', margin: '16px 0 0' }}
        >
          {loading ? '…' : dueMuscles.length} due
          <br />
          for review
        </h2>
        <p className="mt-3 text-[15px] leading-snug" style={{ color: 'var(--ink2)' }}>
          {dueMuscles.length > 0
            ? 'Scheduled from your recent sessions.'
            : 'Nothing scheduled — build a custom session instead.'}
        </p>

        <button
          type="button"
          onClick={handleStart}
          className="mt-5.5 w-full rounded-[3px] border-0"
          style={{ minHeight: 54, background: 'var(--acc)', color: 'var(--onacc)', font: '500 17px/1 var(--font-ui)' }}
        >
          Start review
        </button>
        <button
          type="button"
          onClick={onCustomSession}
          className="mt-2.5 w-full rounded-[3px]"
          style={{ minHeight: 50, background: 'none', border: '1.3px solid var(--line)', color: 'var(--ink)', font: '500 15.5px/1 var(--font-ui)' }}
        >
          Build a custom session
        </button>

        <div
          className="mt-9"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
        >
          Weakest structures
        </div>
        <div className="mt-3 flex flex-col">
          {weakest.length === 0 && (
            <p className="py-3 text-sm" style={{ color: 'var(--ink3)' }}>
              No attempts recorded yet.
            </p>
          )}
          {weakest.slice(0, 3).map((m) => {
            const structure = content.structuresById.get(m.structureId);
            const pct = Math.round((m.attemptsCorrect / m.attemptsTotal) * 100);
            return (
              <button
                key={m.structureId}
                type="button"
                onClick={() => onOpenMuscle(m.structureId)}
                className="flex items-baseline gap-3 border-0 bg-transparent py-3.5 text-left"
              >
                <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.2, color: 'var(--ink)' }}>
                  {structure?.name ?? m.structureId}
                </span>
                <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                  {structure ? REGION_LABELS[structure.region] : ''}
                </span>
                <span
                  style={{
                    font: '500 12.5px/1 var(--font-mono)',
                    color: pct < 60 ? 'var(--acc2d)' : 'var(--ink2)',
                    minWidth: 34,
                    textAlign: 'right',
                  }}
                >
                  {pct}%
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="mt-7"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
        >
          This week
        </div>
        <div className="mt-4 flex h-[78px] items-end gap-2.5">
          {weekBuckets.map((count, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className="w-full rounded-sm"
                style={{ height: `${Math.max(4, (count / weekMax) * 100)}%`, background: i === 6 ? 'var(--acc)' : count === 0 ? 'var(--line)' : 'var(--fig-line)' }}
              />
              <span style={{ font: '400 10px/1 var(--font-mono)', color: 'var(--ink3)' }}>{dayLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}
