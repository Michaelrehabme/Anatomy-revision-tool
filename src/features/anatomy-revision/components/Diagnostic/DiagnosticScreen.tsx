import { useEffect, useMemo, useState } from 'react';
import type { AnatomyRepository } from '../../data/repository';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { MCQQuestion } from '../../types/question';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import {
  buildDiagnostic,
  buildDiagnosticQuestions,
  shuffleForSitting,
  type DiagnosticResult,
} from '../../lib/diagnostic';
import { promptCopy } from '../../lib/diagnosticPrompt';
import { DiagnosticSession } from './DiagnosticSession';
import { Button } from '../shared/Button';

/**
 * The route around the sitting: resolve the questions, run it, store the result.
 *
 * Deliberately thin. The judgements live in lib/diagnostic.ts (which items,
 * which questions, what a follow-up must replay) and lib/diagnosticPrompt.ts
 * (whether to ask at all); what is left here is plumbing and two screens of
 * copy.
 *
 * NOTHING IN THIS FLOW RECORDS AN ATTEMPT. No recordAttempt, no upsertMastery,
 * no cohort counter. A diagnostic answer must not reach the scheduler, an
 * educator's weakness table, or any accuracy figure in the product — and the
 * cheapest way to guarantee that is for the code path to have no way of doing
 * it. Do not "reuse" the session machinery here later.
 */

interface DiagnosticScreenProps {
  repository: AnatomyRepository;
  userId: string;
  cohortId: string;
  phase: 'baseline' | 'followUp';
  structures: AnatomyStructure[];
  images: AnatomyImageAsset[];
  /** Question ids from the baseline, when this is the follow-up. */
  replayIds?: string[];
  onDone: () => void;
}

const wrap = 'mx-auto w-full max-w-[680px] px-6 py-12';
const display = { fontFamily: 'var(--font-display)', fontWeight: 500 as const, letterSpacing: '-.015em' };

export function DiagnosticScreen({
  repository, userId, cohortId, phase, structures, images, replayIds, onDone,
}: DiagnosticScreenProps) {
  const [stage, setStage] = useState<'intro' | 'sitting' | 'done'>('intro');
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const imagesById = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);

  // Built once. Re-running the generator mid-sitting would renumber the paper
  // under the student's feet.
  const questions = useMemo(() => {
    const spec = buildDiagnostic(structures, cohortId);
    const pool = generateRevisionSet(structures, images, {
      types: ['mcq'], mode: 'practice', seed: 1,
    }).filter((q): q is MCQQuestion => q.type === 'mcq');
    return shuffleForSitting(buildDiagnosticQuestions(spec, pool, replayIds));
  }, [structures, images, cohortId, replayIds]);

  useEffect(() => { window.scrollTo(0, 0); }, [stage]);

  const copy = promptCopy(phase);

  if (stage === 'intro') {
    return (
      <div className={wrap}>
        <h1 style={{ ...display, fontSize: 38, lineHeight: 1.12 }}>{copy.title}</h1>
        <p className="mt-4" style={{ font: '400 17px/1.6 var(--font-ui)', color: 'var(--ink2)' }}>{copy.body}</p>

        <ul className="mt-7 flex list-none flex-col gap-3 p-0" style={{ font: '400 15px/1.55 var(--font-ui)', color: 'var(--ink2)' }}>
          <li><strong style={{ color: 'var(--ink)' }}>You will not be told what you got wrong.</strong>{' '}
            Being shown the answers now would teach you them, and the point is to measure what you already know.</li>
          <li><strong style={{ color: 'var(--ink)' }}>It is not revision.</strong>{' '}
            Nothing here changes what the app schedules for you, and none of it appears in your progress.</li>
          <li><strong style={{ color: 'var(--ink)' }}>You can skip it.</strong> The app works exactly the same either way.</li>
        </ul>

        {questions.length === 0 ? (
          <p className="mt-8" style={{ font: '400 15px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
            This one cannot be set up right now. Nothing is lost — carry on revising and try again later.
          </p>
        ) : (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button onClick={() => setStage('sitting')} className="min-w-[190px] min-h-[52px]">{copy.cta}</Button>
            <button
              type="button"
              onClick={onDone}
              style={{ font: '400 15px/1 var(--font-ui)', color: 'var(--ink3)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Not now
            </button>
          </div>
        )}
      </div>
    );
  }

  if (stage === 'sitting') {
    return (
      <DiagnosticSession
        questions={questions}
        imagesById={imagesById}
        onCancel={onDone}
        onSubmit={async ({ correct, total, questionIds, durationMs }) => {
          setScore({ correct, total });
          setStage('done');

          const result: DiagnosticResult = {
            userId, cohortId, version: buildDiagnostic(structures, cohortId).version,
            phase, correct, total, takenAt: new Date().toISOString(), durationMs, questionIds,
          };
          try {
            await repository.saveDiagnosticResult(result);
          } catch {
            // The student has already finished; losing their six minutes to a
            // network error would be the worst possible moment to be honest
            // about it, so the score still shows and the failure is stated
            // plainly underneath rather than thrown.
            setSaveFailed(true);
          }
        }}
      />
    );
  }

  return (
    <div className={wrap}>
      <h1 style={{ ...display, fontSize: 38, lineHeight: 1.12 }}>
        {phase === 'baseline' ? 'That is your starting point' : 'That is the term measured'}
      </h1>

      <div className="mt-7" style={{ font: '500 58px/1 var(--font-mono)', color: 'var(--accd)', fontVariantNumeric: 'tabular-nums' }}>
        {score?.correct}/{score?.total}
      </div>

      <p className="mt-4" style={{ font: '400 16px/1.55 var(--font-ui)', color: 'var(--ink2)' }}>
        {phase === 'baseline'
          ? 'You will sit the same fifteen again at the end of term.'
          : 'Thank you — this is the half of the comparison that could not be reconstructed later.'}
      </p>

      <div className="mt-6 rounded-[3px] px-5 py-4" style={{ background: 'var(--acc2s)', borderLeft: '2px solid var(--acc2)' }}>
        <p style={{ font: '400 15px/1.55 var(--font-ui)', color: 'var(--ink2)' }}>
          <strong style={{ color: 'var(--ink)' }}>We are deliberately not showing you which ones you missed.</strong>{' '}
          If we did, this would become a revision session, and the improvement it produced would be impossible
          to tell apart from the improvement your actual revising produces. Go and revise properly instead —
          that is what the rest of the app is for.
        </p>
      </div>

      {saveFailed && (
        <p className="mt-5" style={{ font: '400 14.5px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
          Your score could not be saved — you are probably offline. Nothing else was affected, and you can
          sit it again when you have a connection.
        </p>
      )}

      <div className="mt-8">
        <Button onClick={onDone} className="min-w-[160px] min-h-[50px]">Done</Button>
      </div>
    </div>
  );
}
