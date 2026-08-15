import { useEffect, useState } from 'react';
import type { FlashcardQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { AnatomyImageFigure } from '../shared/AnatomyImageFigure';

interface FlashcardSessionProps {
  question: FlashcardQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: { structureId: string; correct: boolean; confidence: Confidence }) => void;
  onNext: () => void;
}

const CONFIDENCE_OPTIONS: { value: Confidence; label: string; className: string }[] = [
  { value: 'hard', label: 'Hard', className: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
  { value: 'medium', label: 'Medium', className: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  { value: 'easy', label: 'Easy', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
];

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

  // New question -> reset local flip/rate/attempt state.
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
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <div className="min-h-[16rem] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {!revealed ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            {frontImage ? (
              <AnatomyImageFigure image={frontImage} alt="Identify this structure" />
            ) : (
              <p className="text-xl font-semibold text-slate-900">{question.front.text}</p>
            )}
            <textarea
              value={attempt}
              onChange={(e) => setAttempt(e.target.value)}
              placeholder="Type your answer (optional)…"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Reveal answer
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {backImage && <AnatomyImageFigure image={backImage} alt={question.structureId} />}
            {attempt.trim() && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Your answer</p>
                <p className="whitespace-pre-line rounded-lg bg-slate-50 p-2 text-sm text-slate-600">{attempt}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Correct answer</p>
              <p className="whitespace-pre-line text-sm text-slate-700">{question.back.text}</p>
            </div>
          </div>
        )}
      </div>

      {revealed && !rated && (
        <div>
          <p className="mb-2 text-center text-sm font-medium text-slate-600">How well did you know it?</p>
          <div className="flex gap-2">
            {CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleRate(opt.value)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${opt.className}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {rated && (
        <button
          type="button"
          onClick={onNext}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Next
        </button>
      )}
    </div>
  );
}
