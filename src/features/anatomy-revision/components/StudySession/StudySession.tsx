import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { useRevisionSession } from '../../hooks/useRevisionSession';
import {
  isFlashcardQuestion,
  isMcqQuestion,
  isLocateQuestion,
  isFillBlankQuestion,
  isTypedIdentifyQuestion,
} from '../../types/question';
import { FlashcardSession } from '../FlashcardSession/FlashcardSession';
import { MCQSession } from '../MCQSession/MCQSession';
import { LocateStructureSession } from '../LocateStructureSession/LocateStructureSession';
import { FillBlankSession } from '../FillBlankSession/FillBlankSession';
import { IdentifyTypedSession } from '../IdentifyTypedSession/IdentifyTypedSession';
import { AppShell } from '../shell/AppShell';
import { SessionSidebar } from '../shell/SessionSidebar';

interface StudySessionProps {
  session: ReturnType<typeof useRevisionSession>;
  content: AnatomyContent;
  onEnd: () => void;
}

/** Screens 05–08: the active-question shell shared by every question format. */
export function StudySession({ session, content, onEnd }: StudySessionProps) {
  const question = session.currentQuestion;
  const advance = () => (session.isLastQuestion ? session.finish() : session.next());

  const correctCount = session.answers.filter((a) => a.correct).length;
  const wrongCount = session.answers.length - correctCount;

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
          current={session.currentIndex + 1}
          total={session.questions.length}
          correctCount={correctCount}
          wrongCount={wrongCount}
          onEnd={onEnd}
        />
      }
    >
      <div className="flex min-h-screen flex-col">
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
          />
        )}
        {isFillBlankQuestion(question) && (
          <FillBlankSession
            key={question.id}
            question={question}
            onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
            onNext={advance}
          />
        )}
        {isTypedIdentifyQuestion(question) && (
          <IdentifyTypedSession
            key={question.id}
            question={question}
            imagesById={content.imagesById}
            onAnswer={(params) => session.submitAnswer({ ...params, questionId: question.id })}
            onNext={advance}
          />
        )}
      </div>
    </AppShell>
  );
}
