import { useEffect, useState } from 'react';
import type { FlashcardQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import { AnatomyImageFigure } from '../shared/AnatomyImageFigure';
import { Button } from '../shared/Button';

interface FlashcardSessionProps {
  question: FlashcardQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: { structureId: string; correct: boolean; graded: false }) => void;
  onNext: () => void;
}

/**
 * A flashcard is purely for learning (CR-018): reveal the answer, move on.
 *
 * It used to collect a typed attempt and a self-rated confidence, and record
 * `correct: true` for whoever rated themselves at all — which meant a card
 * both inflated session accuracy and drove SM-2 scheduling off a self-report.
 * Neither survives: the card is the teaching step that precedes an OINA
 * question, and the question is where the judgement happens. The exposure is
 * still recorded, and still earns XP, but it is `graded: false` throughout.
 */
export function FlashcardSession({ question, imagesById, onAnswer, onNext }: FlashcardSessionProps) {
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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-8 py-10">
      <div
        className="text-center"
        style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
      >
        Learn · not scored
      </div>

      <div
        className="mt-5 min-h-[26rem] rounded-[3px] p-8"
        style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}
      >
        {!revealed ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            {frontImage ? (
              <AnatomyImageFigure image={frontImage} alt="Identify this structure" />
            ) : (
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30 }}>{question.front.text}</p>
            )}
            <Button onClick={handleReveal} className="min-w-[200px] min-h-[50px]">
              Reveal answer
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {backImage && <AnatomyImageFigure image={backImage} alt={question.structureId} />}
            {question.front.text && (
              <p className="text-lg" style={{ color: 'var(--ink3)' }}>
                {question.front.text}
              </p>
            )}
            <p className="whitespace-pre-line text-2xl leading-snug" style={{ color: 'var(--ink)' }}>
              {question.back.text}
            </p>
          </div>
        )}
      </div>

      {revealed && (
        <Button onClick={onNext} className="mt-6 min-h-[50px] w-full">
          Next
        </Button>
      )}
    </div>
  );
}
