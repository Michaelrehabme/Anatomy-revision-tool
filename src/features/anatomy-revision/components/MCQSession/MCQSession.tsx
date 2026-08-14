import { useEffect, useState } from 'react';
import type { MCQQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import { AttributionBadge } from '../shared/AttributionBadge';
import { HotspotOverlay } from '../LocateStructureSession/HotspotOverlay';

interface MCQSessionProps {
  question: MCQQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: { structureId: string; correct: boolean }) => void;
  onNext: () => void;
}

export function MCQSession({ question, imagesById, onAnswer, onNext }: MCQSessionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(null);
  }, [question.id]);

  const promptImage = question.promptImageId ? imagesById.get(question.promptImageId) : undefined;
  // Atlas-slide images need the polygon drawn to show which structure is "highlighted";
  // single-structure images already ARE the answer, so no overlay is needed.
  const highlightHotspots =
    promptImage?.mode === 'atlas-slide' ? (promptImage.hotspots ?? []) : [];

  const handleSelect = (index: number) => {
    if (selectedIndex !== null) return;
    setSelectedIndex(index);
    onAnswer({ structureId: question.structureId, correct: index === question.correctIndex });
  };

  const answered = selectedIndex !== null;

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

      <div className="space-y-2">
        {question.choices.map((choice, index) => {
          const isCorrect = index === question.correctIndex;
          const isSelected = index === selectedIndex;
          let className = 'border-slate-200 bg-white hover:border-slate-300';
          if (answered && isCorrect) className = 'border-emerald-500 bg-emerald-50';
          else if (answered && isSelected && !isCorrect) className = 'border-rose-500 bg-rose-50';

          return (
            <button
              key={choice}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(index)}
              className={`w-full rounded-lg border p-3 text-left text-sm transition disabled:cursor-default ${className}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="space-y-3">
          <div
            className={`rounded-lg p-3 text-sm ${selectedIndex === question.correctIndex ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
          >
            <p className="font-medium">
              {selectedIndex === question.correctIndex ? 'Correct.' : 'Not quite.'}
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
