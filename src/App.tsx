import { useRepository } from './features/anatomy-revision/hooks/useRepository';
import { useAnonymousUser } from './features/anatomy-revision/context/AnonymousUserProvider';
import { useAnatomyContent } from './features/anatomy-revision/hooks/useAnatomyContent';
import { useRevisionSession } from './features/anatomy-revision/hooks/useRevisionSession';
import { generateRevisionSet } from './features/anatomy-revision/lib/questionGenerators/generateSet';
import { RevisionSetup } from './features/anatomy-revision/components/RevisionSetup/RevisionSetup';
import { FlashcardSession } from './features/anatomy-revision/components/FlashcardSession/FlashcardSession';
import { MCQSession } from './features/anatomy-revision/components/MCQSession/MCQSession';
import { LocateStructureSession } from './features/anatomy-revision/components/LocateStructureSession/LocateStructureSession';
import { RevisionResults } from './features/anatomy-revision/components/RevisionResults/RevisionResults';
import { isFlashcardQuestion, isMcqQuestion, isLocateQuestion } from './features/anatomy-revision/types/question';

/**
 * Top-level setup -> in-progress -> results state machine (no router — see
 * project plan's "no router in v1" decision). The in-progress view renders
 * whichever session component matches the CURRENT question's type, so a
 * mixed-type session (flashcard + MCQ + locate all selected in
 * RevisionSetup) switches component per question rather than needing
 * separate screens per type.
 */
function App() {
  const { repository, loading: repoLoading } = useRepository();
  const { userId } = useAnonymousUser();
  const content = useAnatomyContent(repository);
  const session = useRevisionSession(repository, userId);

  if (repoLoading || content.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading anatomy content…
      </div>
    );
  }

  if (session.phase === 'setup') {
    return <RevisionSetup content={content} onStart={session.start} />;
  }

  if (session.phase === 'results' && session.summary) {
    return (
      <RevisionResults
        summary={session.summary}
        structuresById={content.structuresById}
        onRestart={session.reset}
        onRetryIncorrect={() => {
          const retryQuestions = generateRevisionSet(content.structures, content.images, {
            types: session.setupParams?.types ?? ['flashcard', 'mcq'],
            mode: 'practice',
            structureIds: session.summary!.missedStructureIds,
          });
          session.start(retryQuestions, session.setupParams ?? { types: ['flashcard', 'mcq'], mode: 'practice' });
        }}
      />
    );
  }

  const question = session.currentQuestion;
  if (!question) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center text-sm text-slate-500">
        No questions matched this filter — go back and widen your selection.
        <button
          type="button"
          onClick={session.reset}
          className="mt-4 block w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to setup
        </button>
      </div>
    );
  }

  const advance = () => {
    if (session.isLastQuestion) session.finish();
    else session.next();
  };

  return (
    <div>
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-brand-600 transition-all"
            style={{ width: `${((session.currentIndex + 1) / session.questions.length) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Question {session.currentIndex + 1} of {session.questions.length}
        </p>
      </div>

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
    </div>
  );
}

export default App;
