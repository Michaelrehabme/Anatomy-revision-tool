import { useEffect, useState } from 'react';
import type { FlashcardQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { AnatomyImageFigure } from '../shared/AnatomyImageFigure';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';

interface MobileFlashcardSessionProps {
  question: FlashcardQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: { structureId: string; correct: boolean; confidence: Confidence }) => void;
  onNext: () => void;
}

/**
 * Not one of the mobile mockup's 11 showcased screens (its rail lists
 * mcq/locate/type but not flashcard, even though "flashcard" is a
 * selectable format chip in Setup) — styled consistently with the other
 * mobile question screens rather than left as a design gap.
 */
export function MobileFlashcardSession({ question, imagesById, onAnswer, onNext }: MobileFlashcardSessionProps) {
  const [revealed, setRevealed] = useState(false);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setRevealed(false);
    setRated(false);
  }, [question.id]);

  const frontImage = question.front.imageId ? imagesById.get(question.front.imageId) : undefined;
  const backImage = question.back.imageId ? imagesById.get(question.back.imageId) : undefined;

  const handleRate = (confidence: Confidence) => {
    setRated(true);
    onAnswer({ structureId: question.structureId, correct: true, confidence });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6.5 pt-4.5 pb-7">
      <div className="min-h-[18rem] rounded-[3px] p-6" style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}>
        {!revealed ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            {frontImage ? (
              <AnatomyImageFigure image={frontImage} alt="Identify this structure" />
            ) : (
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24 }}>{question.front.text}</p>
            )}
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="rounded-[3px] border-0"
              style={{ minWidth: 180, minHeight: 46, background: 'var(--acc)', color: 'var(--onacc)', font: '500 15.5px/1 var(--font-ui)' }}
            >
              Reveal answer
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {backImage && <AnatomyImageFigure image={backImage} alt={question.structureId} />}
            <p className="whitespace-pre-line text-base" style={{ color: 'var(--ink)' }}>
              {question.back.text}
            </p>
          </div>
        )}
      </div>

      {revealed && !rated && (
        <div className="mt-5">
          <ConfidenceButtons onRate={handleRate} label="How did that feel?" />
        </div>
      )}
      {rated && (
        <button
          type="button"
          onClick={onNext}
          className="mt-5 w-full rounded-[3px] border-0"
          style={{ minHeight: 48, background: 'var(--ink)', color: 'var(--pg)', font: '500 15.5px/1 var(--font-ui)' }}
        >
          Next
        </button>
      )}
    </div>
  );
}
