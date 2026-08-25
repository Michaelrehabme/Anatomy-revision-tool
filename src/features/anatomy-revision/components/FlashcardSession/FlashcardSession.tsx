import { useEffect, useState } from 'react';
import type { FlashcardQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { AnatomyImageFigure } from '../shared/AnatomyImageFigure';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { Button } from '../shared/Button';

interface FlashcardSessionProps {
  question: FlashcardQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: { structureId: string; correct: boolean; confidence: Confidence }) => void;
  onNext: () => void;
}

/**
 * Single-flashcard view: flip to reveal, then self-rate confidence. A
 * flashcard has no objectively "wrong" answer — `correct` is recorded as
 * true for the mastery/results pipeline whenever the student reveals and
 * rates themselves at all (confidence itself carries the real signal).
 */
export function FlashcardSession({ question, imagesById, onAnswer, onNext }: FlashcardSessionProps) {
  const [revealed, setRevealed] = useState(false);
  const [rated, setRated] = useState(false);
  const [attempt, setAttempt] = useState('');

  useEffect(() => {
    setRevealed(false);
    setRated(false);
    setAttempt('');
  }, [question.id]);

  const frontImage = question.front.imageId ? imagesById.get(question.front.imageId) : undefined;
  const backImage = question.back.imageId ? imagesById.get(question.back.imageId) : undefined;

  const handleRate = (confidence: Confidence) => {
    setRated(true);
    onAnswer({ structureId: question.structureId, correct: true, confidence });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-8 py-10">
      <div className="min-h-[26rem] rounded-[3px] p-8" style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}>
        {!revealed ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            {frontImage ? (
              <AnatomyImageFigure image={frontImage} alt="Identify this structure" />
            ) : (
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30 }}>{question.front.text}</p>
            )}
            <textarea
              value={attempt}
              onChange={(e) => setAttempt(e.target.value)}
              placeholder="Type your answer (optional)…"
              rows={3}
              className="w-full resize-none rounded-[3px] p-3 text-sm"
              style={{ border: '1.2px solid var(--line)', color: 'var(--ink)', background: 'var(--pg)' }}
            />
            <Button onClick={() => setRevealed(true)} className="min-w-[200px] min-h-[50px]">
              Reveal answer
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {backImage && <AnatomyImageFigure image={backImage} alt={question.structureId} />}
            {attempt.trim() && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink3)' }}>
                  Your answer
                </p>
                <p className="whitespace-pre-line rounded-[3px] p-2.5 text-sm" style={{ background: 'var(--pg)', color: 'var(--ink2)' }}>
                  {attempt}
                </p>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink3)' }}>
                Correct answer
              </p>
              <p className="whitespace-pre-line text-base" style={{ color: 'var(--ink)' }}>
                {question.back.text}
              </p>
            </div>
          </div>
        )}
      </div>

      {revealed && !rated && (
        <div className="mt-6">
          <ConfidenceButtons onRate={handleRate} />
        </div>
      )}

      {rated && (
        <Button onClick={onNext} className="mt-6 min-h-[50px] w-full">
          Next
        </Button>
      )}
    </div>
  );
}
