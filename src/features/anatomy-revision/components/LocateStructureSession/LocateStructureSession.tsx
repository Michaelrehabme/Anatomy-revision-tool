import { useEffect, useState } from 'react';
import type { LocateQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import { HotspotImage } from './HotspotImage';
import { LocateWords } from './LocateWords';
import { useLocateAnswer, type LocateAnswerParams } from './useLocateAnswer';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { recordHintShown, shouldShowHint } from '../../lib/firstTimeHints';
import { questionHeaderLabel } from '../../lib/questionFormats';
import { FeedbackHeading } from '../shared/FeedbackHeading';

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

  return (
    <div className="flex flex-col items-center px-24 pt-14 pb-12">
      <div
        className="text-center"
        style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}
      >
        {questionHeaderLabel(question)}
      </div>
      <h2
        className="mt-5 text-center"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          // The question in words is a sentence, not three words: at the size
          // of "Tap the acromion." it ran to four lines.
          fontSize: wordsMode ? 36 : 52,
          lineHeight: wordsMode ? 1.15 : 1.05,
          letterSpacing: '-.024em',
          maxWidth: wordsMode ? '22em' : undefined,
          minHeight: '1.05em',
        }}
      >
        {locate.prompt}
      </h2>
      {showHint && !wordsMode && (
        <p className="mt-3 max-w-md text-center text-sm leading-snug" style={{ color: 'var(--ink2)' }}>
          Click where it sits on the image. Your first click is your answer.
        </p>
      )}

      <div className="mt-3 flex items-center gap-4" style={{ color: 'var(--ink3)' }}>
        {!wordsMode && (
          <span className="text-xs">
            {frames.length > 1 ? 'Scroll to zoom · drag to turn' : 'Scroll to zoom'}
          </span>
        )}
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
            className="text-xs underline decoration-dotted"
          >
            {wordsMode ? 'Answer on the picture' : 'Answer without the picture'}
          </button>
        )}
      </div>

      {!wordsMode ? (
        <div className="mt-2 flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full max-w-[560px]">
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
          </div>
        </div>
      ) : (
        routes && (
          <LocateWords
            routes={routes}
            targetStructureId={question.targetStructureId}
            result={result}
            chosenDescription={locate.chosenDescription}
            examMode={examMode}
            onDescription={locate.handleDescribedAnswer}
            onName={locate.handleListAnswer}
          />
        )
      )}

      {result && examMode && <ExamAnswerFooter onNext={onNext} compact />}

      {result && !examMode && (
        <div className="mt-8 w-full max-w-[720px] rounded-[3px] p-6" style={{ background: result.correct ? 'var(--accs)' : 'var(--acc2s)' }}>
          {/* Takes focus as it appears: answering without the picture disables
              every button that was pressed, and focus used to fall to the page body. */}
          <FeedbackHeading
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, color: result.correct ? 'var(--accd)' : 'var(--acc2d)' }}
            label={feedback.detail ? `${feedback.title}. ${feedback.detail}` : feedback.title}
          >
            {feedback.title}
          </FeedbackHeading>
          {feedback.detail && (
            <p className="mt-1 text-sm" style={{ color: 'var(--ink2)' }}>
              {feedback.detail}
            </p>
          )}
          {!rated ? (
            <div className="mt-4">
              <ConfidenceButtons onRate={locate.handleRate} />
            </div>
          ) : (
            <Button onClick={onNext} className="mt-4 min-w-[180px] min-h-[50px]">
              Next
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
