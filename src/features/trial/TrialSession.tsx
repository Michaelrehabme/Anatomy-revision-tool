import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AnatomyContent } from '../anatomy-revision/hooks/useAnatomyContent';
import { useRevisionSession } from '../anatomy-revision/hooks/useRevisionSession';
import { StudySession } from '../anatomy-revision/components/StudySession/StudySession';
import { MobileStudySession } from '../anatomy-revision/components/mobile/MobileStudySession';
import { useTrackStep } from '../feedback/useTrackStep';
import { buildTrialSet, TRIAL_TYPES } from './trialSet';

/**
 * /try: the trial session, for a visitor with no account (trialSet.ts says
 * which questions and why).
 *
 * A SESSION OF ITS OWN, WITH NOWHERE TO SAVE. It runs the ordinary session
 * screens on its own useRevisionSession, given no repository and no user. The
 * hook writes only when it has both, so nothing is recorded: no attempt, no
 * schedule, no streak. That is the owner's rule that a guest holds no
 * progress (6 October 2026), kept; what changed on 12 October is that a guest
 * may now see what a session is like.
 *
 * Its results screen is the point of it: the score, and the account that
 * would have kept it.
 */

const SIGN_UP = '/onboarding';

export default function TrialSession({ content, isDesktop }: { content: AnatomyContent; isDesktop: boolean }) {
  const session = useRevisionSession(null, null);
  const navigate = useNavigate();
  const questions = useMemo(
    () => buildTrialSet(content.structures, content.images, content.sources),
    [content.structures, content.images, content.sources],
  );

  // Started once, when the questions are in hand. "Try again" starts it afresh.
  const started = useRef(false);
  const start = session.start;
  useEffect(() => {
    if (started.current || questions.length === 0) return;
    started.current = true;
    start(questions, { types: TRIAL_TYPES, mode: 'practice', learnCardAttempts: 0 });
  }, [questions, start]);

  useTrackStep('trial-started', session.phase === 'in-progress');
  useTrackStep('trial-finished', session.phase === 'results');

  const leave = () => navigate('/');

  if (session.phase === 'in-progress') {
    return isDesktop ? (
      <StudySession session={session} content={content} onEnd={leave} onBackToSetup={leave} />
    ) : (
      // A structure's card states its facts, which need an account: nothing to open.
      <MobileStudySession session={session} content={content} onEnd={leave} onBackToSetup={leave} onOpenMuscle={() => undefined} />
    );
  }

  const graded = session.answers.filter((answer) => answer.graded !== false);
  const correct = graded.filter((answer) => answer.correct).length;
  const finished = session.phase === 'results';

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center"
      style={{ background: 'var(--pg)', color: 'var(--ink)' }}
    >
      {finished ? (
        <>
          <p style={{ font: '500 11px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)', margin: 0 }}>
            Trial finished
          </p>
          <h1 className="mt-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 40, lineHeight: 1.1, letterSpacing: '-.02em', margin: '16px 0 0' }}>
            {correct} of {graded.length} right
          </h1>
          <p className="mt-4" style={{ font: '400 16px/1.6 var(--font-ui)', color: 'var(--ink2)', maxWidth: '46ch', margin: '16px 0 0' }}>
            That was a taste of each kind of question, and none of it was saved. With a free account you choose one
            body area to keep, in full, and the app brings back what you got wrong when you are about to forget it.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <Link
              to={SIGN_UP}
              style={{ font: '500 15px/1 var(--font-ui)', padding: '15px 22px', background: 'var(--acc-fill)', color: 'var(--onacc)', textDecoration: 'none' }}
            >
              Create a free account
            </Link>
            <button
              type="button"
              onClick={() => session.start(questions, { types: TRIAL_TYPES, mode: 'practice', learnCardAttempts: 0 })}
              className="min-h-[44px] border-0 bg-transparent p-0 underline underline-offset-4"
              style={{ font: '400 14px/1 var(--font-ui)', color: 'var(--ink2)' }}
            >
              Try the same ten again
            </button>
          </div>
          <p className="mt-6" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink3)', margin: '24px 0 0' }}>
            No card needed. <Link to="/" style={{ color: 'var(--ink2)' }}>Back to the home page</Link>
          </p>
        </>
      ) : questions.length === 0 ? (
        <>
          <p style={{ font: '400 16px/1.6 var(--font-ui)', color: 'var(--ink2)', maxWidth: '44ch', margin: 0 }}>
            The trial questions could not be loaded. A free account opens one body area in full.
          </p>
          <Link className="mt-6" to={SIGN_UP} style={{ font: '500 15px/1 var(--font-ui)', padding: '15px 22px', background: 'var(--acc-fill)', color: 'var(--onacc)', textDecoration: 'none' }}>
            Create a free account
          </Link>
        </>
      ) : null}
    </main>
  );
}
