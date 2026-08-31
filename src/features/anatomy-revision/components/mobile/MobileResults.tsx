import type { RevisionSessionSummary } from '../../types/attempt';
import type { AnatomyStructure } from '../../types/structure';
import type { AnswerRecord, GamificationResult } from '../../hooks/useRevisionSession';
import { REGION_LABELS } from '../../types/region';
import { levelProgress } from '../../lib/levels';
import { AchievementToastStack } from '../shared/AchievementToast';

const DUE_TEXT: Record<'hard' | 'medium' | 'easy', string> = { hard: 'tomorrow', medium: '4 days', easy: '10 days' };

interface MobileResultsProps {
  summary: RevisionSessionSummary;
  answers: AnswerRecord[];
  structuresById: Map<string, AnatomyStructure>;
  /** Null until useRevisionSession.finish()'s async XP/achievement computation resolves — renders in when ready. */
  gamification: GamificationResult | null;
  /** From session.setupParams?.mode — RevisionSessionSummary itself doesn't carry mode, so App.tsx passes it separately. */
  sessionMode?: 'practice' | 'adaptive' | 'assessment';
  onDone: () => void;
  onRetry: () => void;
}

function resultsLine(summary: RevisionSessionSummary, structuresById: Map<string, AnatomyStructure>): string {
  if (summary.totalQuestions === 0) return '';
  if (summary.correctCount >= summary.totalQuestions - 1) {
    return 'Strong run. The intervals you set just pushed most of these out past a week.';
  }
  const regionCounts = new Map<string, number>();
  for (const id of summary.missedStructureIds) {
    const region = structuresById.get(id)?.region;
    if (region) regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
  }
  const worst = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!worst) return `${summary.missedStructureIds.length} to review next time.`;
  const [region, count] = worst;
  return `${count} of these were ${REGION_LABELS[region as keyof typeof REGION_LABELS]} questions — worth another pass.`;
}

/** Screen 09 (mobile). Score, then "back in the queue" — no by-region chart (not in the mobile spec). */
export function MobileResults({ summary, answers, structuresById, gamification, sessionMode, onDone, onRetry }: MobileResultsProps) {
  const isExam = sessionMode === 'assessment';
  const progress = gamification ? levelProgress(gamification.xpTotal) : null;
  const queueRows = summary.missedStructureIds.map((id) => {
    const structure = structuresById.get(id);
    const answer = [...answers].reverse().find((a) => a.structureId === id);
    const confidence = answer?.confidence ?? 'hard';
    return {
      name: structure?.name ?? id,
      due: DUE_TEXT[confidence],
      dot: confidence === 'hard' ? 'var(--acc2)' : confidence === 'easy' ? 'var(--acc)' : 'var(--ink3)',
    };
  });

  return (
    <div className="flex min-h-screen flex-col px-6.5 pt-5 pb-7.5" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        {isExam ? 'Exam results' : 'Session complete'}
      </div>
      <div className="mt-3.5 flex items-baseline gap-2.5">
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 80, lineHeight: 0.86, letterSpacing: '-.04em' }}>
          {summary.correctCount}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink3)' }}>/ {summary.totalQuestions}</span>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
        {resultsLine(summary, structuresById)}
      </p>

      {gamification && progress && (
        <div className="mt-5 rounded-[4px] p-3.5" style={{ background: 'var(--accs)' }}>
          <div className="flex items-baseline justify-between">
            <span style={{ font: '600 17px/1 var(--font-display)', color: 'var(--accd)' }}>+{gamification.xpEarned} XP</span>
            <span style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--ink2)' }}>
              {gamification.leveledUp ? 'Level up! ' : ''}Lv {progress.level}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
            <div className="h-full" style={{ width: `${progress.pct}%`, background: 'var(--acc)' }} />
          </div>
          <div className="mt-1.5" style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--acc2d)' }}>
            {gamification.streak}-day streak{gamification.freezeConsumed ? ' · freeze used' : ''}
          </div>
        </div>
      )}

      {gamification && <AchievementToastStack achievements={gamification.newAchievements} />}

      {queueRows.length > 0 && (
        <>
          <div
            className="mt-7.5"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
          >
            Back in the queue
          </div>
          <div className="mt-2 flex flex-col">
            {queueRows.map((row) => (
              <div key={row.name} className="flex items-baseline gap-3 py-3">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: row.dot }} />
                <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.25 }}>
                  {row.name}
                </span>
                <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>{row.due}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onDone}
        className="mt-6 w-full rounded-[3px] border-0"
        style={{ minHeight: 54, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
      >
        Done
      </button>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2.5 w-full rounded-[3px]"
        style={{ minHeight: 50, background: 'none', border: '1.3px solid var(--line)', color: 'var(--ink)', font: '500 15.5px/1 var(--font-ui)' }}
      >
        Another {summary.totalQuestions}
      </button>
    </div>
  );
}
