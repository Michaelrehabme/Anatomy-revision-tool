import { useEffect, useState } from 'react';
import type { LocateQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import { HotspotImage, type HotspotAnswerResult } from './HotspotImage';

interface LocateStructureSessionProps {
  question: LocateQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  structuresById: Map<string, AnatomyStructure>;
  onAnswer: (params: { structureId: string; correct: boolean; hitDistance?: number }) => void;
  onNext: () => void;
}

const ZOOM_LEVELS = [1, 1.5, 2];

/**
 * Wraps HotspotImage with zoom controls and a keyboard/list-based fallback
 * for students who can't (or don't want to) click precisely on the image —
 * both paths funnel through the same onAnswer/result handling so scoring is
 * identical either way.
 */
export function LocateStructureSession({
  question,
  imagesById,
  structuresById,
  onAnswer,
  onNext,
}: LocateStructureSessionProps) {
  const [result, setResult] = useState<HotspotAnswerResult | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [listMode, setListMode] = useState(false);

  useEffect(() => {
    setResult(null);
    setZoomIndex(0);
    setListMode(false);
  }, [question.id]);

  const image = imagesById.get(question.imageId);
  if (!image) {
    return <p className="p-6 text-sm text-rose-600">Image "{question.imageId}" not found.</p>;
  }

  const handleImageAnswer = (r: HotspotAnswerResult) => {
    setResult(r);
    onAnswer({ structureId: question.targetStructureId, correct: r.correct, hitDistance: r.hitDistance });
  };

  const handleListAnswer = (structureId: string) => {
    if (result) return;
    const correct = structureId === question.targetStructureId;
    const fakeResult: HotspotAnswerResult = { structureId, correct, point: [0, 0] };
    setResult(fakeResult);
    onAnswer({ structureId: question.targetStructureId, correct });
  };

  const candidateStructures = (image.hotspots ?? [])
    .map((h) => structuresById.get(h.structureId))
    .filter((s): s is AnatomyStructure => !!s);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <p className="text-lg font-semibold text-slate-900">{question.prompt}</p>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex gap-1">
          {ZOOM_LEVELS.map((level, i) => (
            <button
              key={level}
              type="button"
              onClick={() => setZoomIndex(i)}
              className={`rounded px-2 py-1 ${zoomIndex === i ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
            >
              {level}x
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setListMode((v) => !v)}
          className="rounded px-2 py-1 underline decoration-dotted hover:bg-slate-100"
        >
          {listMode ? 'Switch to image click' : "Can't click precisely? Choose from a list"}
        </button>
      </div>

      {!listMode ? (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <div
            style={{ transform: `scale(${ZOOM_LEVELS[zoomIndex]})`, transformOrigin: 'top left' }}
            className="transition-transform"
          >
            <HotspotImage
              key={question.id}
              image={image}
              targetStructureId={question.targetStructureId}
              toleranceMultiplier={question.toleranceMultiplier}
              onAnswer={handleImageAnswer}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {candidateStructures.map((s) => {
            const isTarget = s.id === question.targetStructureId;
            const isSelected = result?.structureId === s.id;
            let className = 'border-slate-200 bg-white hover:border-slate-300';
            if (result && isTarget) className = 'border-emerald-500 bg-emerald-50';
            else if (result && isSelected) className = 'border-rose-500 bg-rose-50';
            return (
              <button
                key={s.id}
                type="button"
                disabled={!!result}
                onClick={() => handleListAnswer(s.id)}
                className={`rounded-lg border p-2 text-sm transition disabled:cursor-default ${className}`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div
            className={`rounded-lg p-3 text-sm ${result.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
          >
            {result.correct
              ? 'Correct.'
              : `Not quite — the highlighted area shows ${structuresById.get(question.targetStructureId)?.name ?? question.targetStructureId}.`}
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
