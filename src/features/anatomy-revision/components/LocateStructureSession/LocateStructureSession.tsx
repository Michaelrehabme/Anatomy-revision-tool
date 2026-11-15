import { useEffect, useState } from 'react';
import type { LocateQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import { HotspotImage } from './HotspotImage';
import { LocateWords } from './LocateWords';
import { useLocateAnswer, type LocateAnswerParams } from './useLocateAnswer';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { recordHintShown, shouldShowHint } from '../../lib/firstTimeHints';
import { questionHeaderLabel } from '../../lib/questionFormats';
import { DesktopQuestionLayout, RailFeedback, RailHeader, StagePicture, StageWords } from '../shared/DesktopQuestionLayout';

interface LocateStructureSessionProps {
  question: LocateQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  structuresById: Map<string, AnatomyStructure>;
  onAnswer: (params: LocateAnswerParams) => void;
  onNext: () => void;
  /** No color reveal, no self-rating — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
}

/**
 * A locate question on the desktop: the picture, and the route that needs no
 * picture.
 *
 * THE PICTURE is answered by a click, or from the keyboard — it is a focus
 * stop, the arrow keys move a crosshair over it and Enter answers where it is
 * (shared/ImageViewer.tsx). Both are the same exercise and are graded by the
 * same code. Zoom and rotation live in the viewer, so the phone has them too.
 *
 * WITHOUT THE PICTURE the question is asked in words — "which of these
 * describes where it sits?" — or, for the few structures the seed cannot
 * describe, from a list of at least four names (LocateWords.tsx). That is for
 * someone who cannot see the plate; it is a different exercise and is
 * recorded as one. What is the same on the phone is in useLocateAnswer.
 */
export function LocateStructureSession({
  question,
  imagesById,
  structuresById,
  onAnswer,
  onNext,
  examMode,
}: LocateStructureSessionProps) {
  const locate = useLocateAnswer({ question, imagesById, structuresById, onAnswer, examMode });
  const { image, frames, routes, result, rated, wordsMode, feedback } = locate;
  // Nothing on screen says the image itself is the answer surface — the
  // crosshair cursor is the only affordance. Said out loud the first couple of times.
  const [showHint] = useState(() => shouldShowHint('locate'));
  useEffect(() => {
    if (showHint) recordHintShown('locate');
  }, [showHint]);

  if (!image) {
    return <p className="p-6 text-sm" style={{ color: 'var(--acc2d)' }}>Image "{question.imageId}" not found.</p>;
  }

  const label = questionHeaderLabel(question);
  const ways = (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" style={{ color: 'var(--ink3)' }}>
      {!wordsMode && <span>{frames.length > 1 ? 'Scroll to zoom · drag to turn' : 'Scroll to zoom'}</span>}
        {/*
          * This toggle is the way to answer a locate question WITHOUT THE
          * PICTURE, which makes it an accessibility route and not merely a
          * convenience. (Without a pointer is no longer its job: the picture
          * itself answers to the keyboard.) It used to be labelled "Can't
          * click precisely?", which describes a shaky hand, and then "Answer
          * from a list instead", which described one name on a third of
          * questions. It goes once the question is answered: the other route
          * would be a second go.
          */}
        {!result && (
          <button
            type="button"
            onClick={locate.toggleWords}
            // The accessible name has to BEGIN with the words on the button, or
            // someone using voice control says what they can read and nothing
            // happens (WCAG 2.5.3).
            aria-label={
              wordsMode
                ? 'Answer on the picture: by clicking it, or with the arrow keys'
                : 'Answer without the picture: the question is asked in words instead'
            }
            className="underline decoration-dotted"
          >
            {wordsMode ? 'Answer on the picture' : 'Answer without the picture'}
          </button>
        )}
    </div>
  );

  return (
    <DesktopQuestionLayout
      stage={
        !wordsMode ? (
          <StagePicture>
            {/* Said plainly to a screen reader before it reaches the picture:
                what the picture is for, and that there is a way round it. */}
            <p className="sr-only">
              This question is answered on the anatomical image, by clicking it or from the keyboard: focus the image,
              move the pointer with the arrow keys and press Enter. If you cannot see the image, use the
              &ldquo;Answer without the picture&rdquo; button above to be asked in words instead. You can make that
              the default under Accessibility on the Account screen.
            </p>
            <HotspotImage
              key={question.id}
              image={image}
              frames={frames.length > 1 ? frames : undefined}
              targetStructureId={question.targetStructureId}
              toleranceMultiplier={question.toleranceMultiplier}
              onAnswer={locate.handleImageAnswer}
              examMode={examMode}
            />
          </StagePicture>
        ) : (
          // The question in words is a sentence, not three words, so it gets the stage.
          <StageWords label={label} prompt={locate.prompt} />
        )
      }
    >
      {!wordsMode ? (
        <RailHeader label={label} prompt={locate.prompt}>
          {showHint && (
            <p className="mt-3 text-[15px] leading-snug" style={{ color: 'var(--ink2)' }}>
              Click where it sits on the image. Your first click is your answer.
            </p>
          )}
          {ways}
        </RailHeader>
      ) : (
        <>
          {ways}
          {routes && (
            <div className="mt-4">
              <LocateWords
                routes={routes}
                targetStructureId={question.targetStructureId}
                result={result}
                chosenDescription={locate.chosenDescription}
                examMode={examMode}
                onDescription={locate.handleDescribedAnswer}
                onName={locate.handleListAnswer}
              />
            </div>
          )}
        </>
      )}

      {result && examMode && <ExamAnswerFooter onNext={onNext} compact />}

      {result && !examMode && (
        /* Takes focus as it appears: answering without the picture disables
           every button that was pressed, and focus used to fall to the page body. */
        <RailFeedback
          correct={result.correct}
          title={feedback.title}
          label={feedback.detail ? `${feedback.title}. ${feedback.detail}` : feedback.title}
          rated={rated}
          onRate={locate.handleRate}
          onNext={onNext}
          structureId={question.targetStructureId}
          explanation={feedback.detail}
        >
          {feedback.detail}
        </RailFeedback>
      )}
    </DesktopQuestionLayout>
  );
}
