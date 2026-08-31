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
} from '../../types/question';
import { MobileFlashcardSession } from './MobileFlashcardSession';
import { MobileMCQSession } from './MobileMCQSession';
import { MobileLocateStructureSession } from './MobileLocateStructureSession';
import { MobileIdentifyTypedSession } from './MobileIdentifyTypedSession';
import { MobileMultiSelectSession } from './MobileMultiSelectSession';
import { FillBlankSession } from '../FillBlankSession/FillBlankSession';
import { PersistErrorBanner } from '../shared/PersistErrorBanner';

interface MobileStudySessionProps {
  session: ReturnType<typeof useRevisionSession>;
  content: AnatomyContent;
  onEnd: () => void;
  onOpenMuscle: (structureId: string, contextIds: string[]) => void;
}

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Screens 05–08 (mobile). Top bar (close + progress + counter), no persistent sidebar. */
export function MobileStudySession({ session, content, onEnd, onOpenMuscle }: MobileStudySessionProps) {
  const question = session.currentQuestion;
  const advance = () => (session.isLastQuestion ? session.finish() : session.next());
  const openFullCard = (structureId: string) =>
    onOpenMuscle(structureId, session.questions.map((q) => q.structureId));

  // See StudySession.tsx (desktop) for why exam mode/timer work this way.
  const examMode = session.setupParams?.mode === 'assessment';
  const timerMinutes = session.setupParams?.timerMinutes;
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(timerMinutes ? timerMinutes * 60 : null);
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

  if (!question) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6.5 text-center" style={{ background: 'var(--pg)' }}>
        <p style={{ color: 'var(--ink2)' }}>No questions matched this filter — widen your selection.</p>
        <button
          type="button"
          onClick={onEnd}
          className="mt-5 rounded-[3px] border-0 px-5 py-2.5"
          style={{ background: 'var(--acc)', color: 'var(--onacc)' }}
        >
          Back to setup
        </button>
      </div>
    );
  }

  const progressPct = Math.round(((session.currentIndex + 1) / session.questions.length) * 100);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      <div className="flex-none px-6.5 pt-3">
        <div className="flex items-center gap-3.5">
          <button type="button" onClick={onEnd} className="border-0 bg-transparent p-0 leading-none" style={{ fontSize: 19, color: 'var(--ink3)' }}>
            &times;
          </button>
          <div className="relative h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
            <div className="absolute inset-y-0 left-0 transition-all duration-300" style={{ width: `${progressPct}%`, background: 'var(--acc)' }} />
          </div>
          <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>
            {session.currentIndex + 1} / {session.questions.length}
          </span>
        </div>
        {examMode && (
          <div className="mt-1.5" style={{ font: '500 11px/1 var(--font-mono)', color: 'var(--accd)' }}>
            Exam{remainingSeconds !== null ? ` · ${formatClock(remainingSeconds)} left` : ''}
          </div>
        )}
      </div>

      {session.persistError && (
        <PersistErrorBanner
          message={session.persistError}
          onRetry={session.retryPersist}
          onDismiss={session.dismissPersistError}
        />
      )}

      {isFlashcardQuestion(question) && (
        <MobileFlashcardSession
          key={question.id}
          question={question}
          imagesById={content.imagesById}
          onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
          onNext={advance}
        />
      )}
      {isMcqQuestion(question) && (
        <MobileMCQSession
          key={question.id}
          question={question}
          imagesById={content.imagesById}
          onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
          onNext={advance}
          onFullCard={() => openFullCard(question.structureId)}
          examMode={examMode}
        />
      )}
      {isLocateQuestion(question) && (
        <MobileLocateStructureSession
          key={question.id}
          question={question}
          imagesById={content.imagesById}
          structuresById={content.structuresById}
          onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
          onNext={advance}
          onFullCard={() => openFullCard(question.targetStructureId)}
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
        <MobileIdentifyTypedSession
          key={question.id}
          question={question}
          imagesById={content.imagesById}
          onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
          onNext={advance}
          onFullCard={() => openFullCard(question.structureId)}
          examMode={examMode}
        />
      )}
      {isMultiSelectQuestion(question) && (
        <MobileMultiSelectSession
          key={question.id}
          question={question}
          onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
          onNext={advance}
          examMode={examMode}
        />
      )}
    </div>
  );
}
