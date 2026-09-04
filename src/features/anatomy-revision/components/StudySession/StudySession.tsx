import { useEffect, useRef, useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { useRevisionSession } from '../../hooks/useRevisionSession';
import {
  isFlashcardQuestion,
  isMcqQuestion,
  isLocateQuestion,
  isFillBlankQuestion,
  isTypedIdentifyQuestion,
  isMultiSelectQuestion,
  isOinaQuestion,
} from '../../types/question';
import { FlashcardSession } from '../FlashcardSession/FlashcardSession';
import { MCQSession } from '../MCQSession/MCQSession';
import { LocateStructureSession } from '../LocateStructureSession/LocateStructureSession';
import { FillBlankSession } from '../FillBlankSession/FillBlankSession';
import { IdentifyTypedSession } from '../IdentifyTypedSession/IdentifyTypedSession';
import { MultiSelectSession } from '../MultiSelectSession/MultiSelectSession';
import { OinaSession } from '../OinaSession/OinaSession';
import { AppShell } from '../shell/AppShell';
import { SessionSidebar } from '../shell/SessionSidebar';
import { PersistErrorBanner } from '../shared/PersistErrorBanner';

interface StudySessionProps {
  session: ReturnType<typeof useRevisionSession>;
  content: AnatomyContent;
  onEnd: () => void;
}

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Screens 05–08: the active-question shell shared by every question format. */
export function StudySession({ session, content, onEnd }: StudySessionProps) {
  const question = session.currentQuestion;
  const advance = () => (session.isLastQuestion ? session.finish() : session.next());

  // EXAM: no feedback until the end, no per-question retries, an optional timer — see CR-009.
  // Flashcards stay self-rated even in exam mode (see FlashcardSession — there's no objective
  // right/wrong to withhold; the self-rating IS the mechanic, not feedback about it).
  const examMode = session.setupParams?.mode === 'assessment';
  const timerMinutes = session.setupParams?.timerMinutes;
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(timerMinutes ? timerMinutes * 60 : null);

  // session is a fresh object every render (useRevisionSession returns a literal) — a ref
  // keeps this effect's dependency array to just `remainingSeconds`, so the countdown ticks
  // once per second regardless of how often the parent re-renders (e.g. on every answer).
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (remainingSeconds === null || sessionRef.current.phase !== 'in-progress') return;
    if (remainingSeconds <= 0) {
      sessionRef.current.finish();
      return;
    }
    const id = setTimeout(() => setRemainingSeconds((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [remainingSeconds]);

  // Learn cards are ungraded (CR-018) — counting them would put "1 correct" in
  // the sidebar the moment a card is revealed, before anything was answered.
  const gradedAnswers = session.answers.filter((a) => a.graded !== false);
  const correctCount = examMode ? 0 : gradedAnswers.filter((a) => a.correct).length;
  const wrongCount = examMode ? 0 : gradedAnswers.length - correctCount;

  // ...and the counter tracks questions, not cards, so it matches both the
  // length promised at setup and the score on the results screen. Falls back
  // to a raw count for a flashcard-only session, which has no graded questions.
  const gradedTotal = session.questions.filter((q) => q.type !== 'flashcard').length;
  const gradedSoFar = session.questions
    .slice(0, session.currentIndex + 1)
    .filter((q) => q.type !== 'flashcard').length;
  const progressTotal = gradedTotal > 0 ? gradedTotal : session.questions.length;
  const progressCurrent = gradedTotal > 0 ? Math.max(1, gradedSoFar) : session.currentIndex + 1;

  if (!question) {
    return (
      <AppShell
        sidebar={
          <SessionSidebar current={0} total={session.questions.length} correctCount={0} wrongCount={0} onEnd={onEnd} />
        }
      >
        <div className="mx-auto max-w-xl p-16 text-center">
          <p style={{ color: 'var(--ink2)' }}>No questions matched this filter — go back and widen your selection.</p>
          <button
            type="button"
            onClick={onEnd}
            className="mt-6 rounded-[3px] px-5 py-2.5"
            style={{ background: 'var(--acc)', color: 'var(--onacc)' }}
          >
            Back to setup
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      sidebar={
        <SessionSidebar
          current={progressCurrent}
          total={progressTotal}
          correctCount={correctCount}
          wrongCount={wrongCount}
          onEnd={onEnd}
          hint={
            examMode
              ? remainingSeconds !== null
                ? `Exam · ${formatClock(remainingSeconds)} left`
                : 'Exam · untimed'
              : undefined
          }
        />
      }
    >
      <div className="flex min-h-screen flex-col">
        {session.persistError && (
          <PersistErrorBanner
            message={session.persistError}
            onRetry={session.retryPersist}
            onDismiss={session.dismissPersistError}
          />
        )}
        {isFlashcardQuestion(question) && (
          <FlashcardSession
            key={question.id}
            question={question}
            imagesById={content.imagesById}
            onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
            onNext={advance}
          />
        )}
        {isMcqQuestion(question) && (
          <MCQSession
            key={question.id}
            question={question}
            imagesById={content.imagesById}
            onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
            onNext={advance}
            examMode={examMode}
          />
        )}
        {isLocateQuestion(question) && (
          <LocateStructureSession
            key={question.id}
            question={question}
            imagesById={content.imagesById}
            structuresById={content.structuresById}
            onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
            onNext={advance}
            examMode={examMode}
          />
        )}
        {isFillBlankQuestion(question) && (
          <FillBlankSession
            key={question.id}
            question={question}
            onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
            onNext={advance}
            examMode={examMode}
          />
        )}
        {isTypedIdentifyQuestion(question) && (
          <IdentifyTypedSession
            key={question.id}
            question={question}
            imagesById={content.imagesById}
            onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
            onNext={advance}
            examMode={examMode}
          />
        )}
        {isMultiSelectQuestion(question) && (
          <MultiSelectSession
            key={question.id}
            question={question}
            onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
            onNext={advance}
            examMode={examMode}
          />
        )}
        {isOinaQuestion(question) && (
          <OinaSession
            key={question.id}
            question={question}
            onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
            onNext={advance}
            examMode={examMode}
          />
        )}
      </div>
    </AppShell>
  );
}
