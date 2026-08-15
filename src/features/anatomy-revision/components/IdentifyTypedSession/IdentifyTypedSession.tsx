import { useEffect, useState } from 'react';
import type { TypedIdentifyQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import { AttributionBadge } from '../shared/AttributionBadge';
import { HotspotOverlay } from '../LocateStructureSession/HotspotOverlay';
import { isAnswerMatch } from '../../lib/answerMatching';

interface IdentifyTypedSessionProps {
  question: TypedIdentifyQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: { structureId: string; correct: boolean }) => void;
  onNext: () => void;
}

export function IdentifyTypedSession({ question, imagesById, onAnswer, onNext }: IdentifyTypedSessionProps) {
  const [attempt, setAttempt] = useState('');
  const [submitted, setSubmitted] = useState<{ correct: boolean } | null>(null);

  useEffect(() => {
    setAttempt('');
    setSubmitted(null);
  }, [question.id]);

  const promptImage = imagesById.get(question.promptImageId);
  const highlightHotspots = promptImage?.mode === 'atlas-slide' ? (promptImage.hotspots ?? []) : [];

  const handleSubmit = () => {
    if (submitted || !attempt.trim()) return;
    const correct = isAnswerMatch(attempt, question.acceptedAnswers);
    setSubmitted({ correct });
    onAnswer({ structureId: question.structureId, correct });
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <p className="text-lg font-semibold text-slate-900">{question.prompt}</p>

      {promptImage && (
        <figure>
          <div
            className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            style={
              promptImage.width && promptImage.height
                ? { aspectRatio: `${promptImage.width} / ${promptImage.height}` }
                : undefined
            }
          >
            <img src={promptImage.filePath} alt={question.prompt} className="h-full w-full object-cover" />
            {highlightHotspots.length > 0 && (
              <HotspotOverlay hotspots={highlightHotspots} highlightStructureId={question.structureId} />
            )}
          </div>
          <AttributionBadge image={promptImage} />
        </figure>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-2"
      >
        <input
          type="text"
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          disabled={!!submitted}
          placeholder="Type the structure's name…"
          autoFocus
          className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 disabled:bg-slate-50"
        />
        {!submitted && (
          <button
            type="submit"
            disabled={!attempt.trim()}
            className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check answer
          </button>
        )}
      </form>

      {submitted && (
        <div className="space-y-3">
          <div className={`rounded-lg p-3 text-sm ${submitted.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            <p className="font-medium">{submitted.correct ? 'Correct.' : 'Not quite.'}</p>
            <p className="mt-1 text-slate-700">
              Answer: <span className="font-medium">{question.acceptedAnswers[0]}</span>
            </p>
            <p className="mt-1 whitespace-pre-line text-slate-700">{question.explanation}</p>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
