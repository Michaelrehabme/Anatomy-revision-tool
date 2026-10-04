import { useEffect, useState } from 'react';
import type { LocateQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import { HotspotImage } from '../LocateStructureSession/HotspotImage';
import { LocateWords } from '../LocateStructureSession/LocateWords';
import { useLocateAnswer, type LocateAnswerParams } from '../LocateStructureSession/useLocateAnswer';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { BottomSheet } from '../shared/BottomSheet';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { recordHintShown, shouldShowHint } from '../../lib/firstTimeHints';

interface MobileLocateStructureSessionProps {
  question: LocateQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  structuresById: Map<string, AnatomyStructure>;
  onAnswer: (params: LocateAnswerParams) => void;
  onNext: () => void;
  onFullCard: () => void;
  /** No color reveal, no self-rating — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
}

/**
 * The mobile mockup's own "locate" mechanic is a 2x2 grid of cropped atlas
 * panels (pick which panel shows muscle X) — a different interaction from
 * the app's existing point-and-click hotspot system. Reusing the existing
 * HotspotImage mechanic here instead (restyled, not reinvented), per the
 * plan's deliberate-simplification note.
 *
 * The routes are the desktop's (LocateStructureSession.tsx, useLocateAnswer):
 * the picture — by tap, or by the crosshair for a phone with a keyboard or a
 * switch attached — and the question in words for someone who cannot see it.
 */
export function MobileLocateStructureSession({
  question,
  imagesById,
  structuresById,
  onAnswer,
  onNext,
  onFullCard,
  examMode,
}: MobileLocateStructureSessionProps) {
  const locate = useLocateAnswer({ question, imagesById, structuresById, onAnswer, examMode });
  const { image, frames, routes, result, rated, wordsMode, feedback } = locate;
  // Nothing on screen says the image itself is the answer surface — the
  // crosshair cursor is the only affordance. Said out loud the first couple of times.
  const [showHint] = useState(() => shouldShowHint('locate'));
  useEffect(() => {
    if (showHint) recordHintShown('locate');
  }, [showHint]);

  if (!image) {
    return (
      <p className="p-6 text-sm" style={{ color: 'var(--acc2d)' }}>
        Image "{question.imageId}" not found.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6.5 pb-5">
        <div
          className="mt-4.5"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}
        >
          Locate
        </div>
        <h2
          className="mt-3"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: wordsMode ? 22 : 26, lineHeight: 1.14, letterSpacing: '-.012em', minHeight: '1.14em' }}
        >
          {locate.prompt}
        </h2>
        {showHint && !wordsMode && (
          <p className="mt-2.5 text-sm leading-snug" style={{ color: 'var(--ink2)' }}>
            Tap where it sits on the image. Your first tap is your answer.
          </p>
        )}

        {/* Gone once answered: the other route would be a second go at a question already marked. */}
        {!result && (
          <button
            type="button"
            onClick={locate.toggleWords}
            // A link-sized line of text is not a touch target; the padding makes it one.
            className="mt-1 -ml-1 inline-flex min-h-[44px] items-center border-0 bg-transparent px-1 text-xs underline decoration-dotted"
            style={{ color: 'var(--ink2)' }}
          >
            {wordsMode ? 'Answer on the picture' : 'Answer without the picture'}
          </button>
        )}

        {!wordsMode ? (
          <div className="mt-2 flex justify-center">
            <div className="w-full max-w-xs">
              <p className="sr-only">
                This question is answered on the anatomical image, by tapping it or from a keyboard: focus the image,
                move the pointer with the arrow keys and press Enter. If you cannot see the image, use the
                &ldquo;Answer without the picture&rdquo; button above to be asked in words instead. You can make
                that the default under Accessibility on the Account screen.
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
              compact
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
      </div>

      {result && examMode && <ExamAnswerFooter onNext={onNext} compact />}

      {result && !examMode && (
        <BottomSheet correct={result.correct} title={feedback.title} body={feedback.detail ?? ''} onFullCard={onFullCard}>
          {rated ? (
            <button
              type="button"
              onClick={onNext}
              className="mt-4.5 w-full rounded-[3px] border-0"
              style={{ minHeight: 52, background: 'var(--acc-fill)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
            >
              Next
            </button>
          ) : (
            <div className="mt-4.5">
              <ConfidenceButtons onRate={locate.handleRate} label="How did that feel?" />
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
