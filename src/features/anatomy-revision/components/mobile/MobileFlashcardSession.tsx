import { useEffect, useState } from 'react';
import type { FlashcardQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import { AnatomyImageFigure } from '../shared/AnatomyImageFigure';

interface MobileFlashcardSessionProps {
  question: FlashcardQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: { structureId: string; correct: boolean; graded: false }) => void;
  onNext: () => void;
}

/**
 * Mobile learn card. Purely for learning since CR-018 — see
 * FlashcardSession for why the self-rating and typed attempt went away.
 */
export function MobileFlashcardSession({ question, imagesById, onAnswer, onNext }: MobileFlashcardSessionProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [question.id]);

  const frontImage = question.front.imageId ? imagesById.get(question.front.imageId) : undefined;
  const backImage = question.back.imageId ? imagesById.get(question.back.imageId) : undefined;

  const handleReveal = () => {
    setRevealed(true);
    onAnswer({ structureId: question.structureId, correct: true, graded: false });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6.5 pt-4.5 pb-7">
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        Learn · not scored
      </div>

      <div className="mt-4 min-h-[18rem] rounded-[3px] p-6" style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}>
        {!revealed ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            {frontImage ? (
              <AnatomyImageFigure image={frontImage} alt="Identify this structure" />
            ) : (
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24 }}>{question.front.text}</p>
            )}
            <button
              type="button"
              onClick={handleReveal}
              className="rounded-[3px] border-0"
              style={{ minWidth: 180, minHeight: 46, background: 'var(--acc)', color: 'var(--onacc)', font: '500 15.5px/1 var(--font-ui)' }}
            >
              Reveal answer
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {backImage && <AnatomyImageFigure image={backImage} alt={question.structureId} />}
            {question.front.text && (
              <p className="text-sm" style={{ color: 'var(--ink3)' }}>
                {question.front.text}
              </p>
            )}
            <p className="whitespace-pre-line text-lg leading-snug" style={{ color: 'var(--ink)' }}>
              {question.back.text}
            </p>
          </div>
        )}
      </div>

      {revealed && (
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
