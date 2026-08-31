import { useEffect, useState } from 'react';
import type { LocateQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import type { Confidence } from '../../types/attempt';
import { HotspotImage, type HotspotAnswerResult } from './HotspotImage';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';

interface LocateStructureSessionProps {
  question: LocateQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  structuresById: Map<string, AnatomyStructure>;
  onAnswer: (params: { structureId: string; correct: boolean; hitDistance?: number; confidence?: Confidence }) => void;
  onNext: () => void;
  /** No color reveal, no self-rating — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
}

const ZOOM_LEVELS = [1, 1.5, 2];

/**
 * Wraps HotspotImage with zoom controls and a keyboard/list-based fallback
 * for students who can't (or don't want to) click precisely on the image —
 * both paths funnel through the same result handling so scoring is
 * identical either way.
 */
export function LocateStructureSession({
  question,
  imagesById,
  structuresById,
  onAnswer,
  onNext,
  examMode,
}: LocateStructureSessionProps) {
  const [result, setResult] = useState<HotspotAnswerResult | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [listMode, setListMode] = useState(false);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setResult(null);
    setZoomIndex(0);
    setListMode(false);
    setRated(false);
  }, [question.id]);

  const image = imagesById.get(question.imageId);
  if (!image) {
    return <p className="p-6 text-sm" style={{ color: 'var(--acc2d)' }}>Image "{question.imageId}" not found.</p>;
  }

  const submitExamAnswer = (r: HotspotAnswerResult) => {
    onAnswer({ structureId: question.targetStructureId, correct: r.correct, hitDistance: r.hitDistance });
  };
  const handleImageAnswer = (r: HotspotAnswerResult) => {
    setResult(r);
    if (examMode) submitExamAnswer(r);
  };
  const handleListAnswer = (structureId: string) => {
    if (result) return;
    const r: HotspotAnswerResult = { structureId, correct: structureId === question.targetStructureId, point: [0, 0] as [number, number] };
    setResult(r);
    if (examMode) submitExamAnswer(r);
  };
  const handleRate = (confidence: Confidence) => {
    if (!result) return;
    setRated(true);
    onAnswer({ structureId: question.targetStructureId, correct: result.correct, hitDistance: result.hitDistance, confidence });
  };

  const candidateStructures = (image.hotspots ?? [])
    .map((h) => structuresById.get(h.structureId))
    .filter((s): s is AnatomyStructure => !!s);

  return (
    <div className="flex flex-col items-center px-24 pt-14 pb-12">
      <div
        className="text-center"
        style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--acc)' }}
      >
        Locate
      </div>
      <h2
        className="mt-5 text-center"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.05, letterSpacing: '-.024em' }}
      >
        {question.prompt}
      </h2>

      <div className="mt-3 flex items-center gap-4" style={{ color: 'var(--ink3)' }}>
        <div className="flex gap-1">
          {ZOOM_LEVELS.map((level, i) => (
            <button
              key={level}
              type="button"
              onClick={() => setZoomIndex(i)}
              className="rounded px-2 py-1 text-xs"
              style={{ background: zoomIndex === i ? 'var(--ink)' : 'var(--sf)', color: zoomIndex === i ? 'var(--sf)' : 'var(--ink3)' }}
            >
              {level}x
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setListMode((v) => !v)} className="text-xs underline decoration-dotted">
          {listMode ? 'Switch to image click' : "Can't click precisely? Choose from a list"}
        </button>
      </div>

      {!listMode ? (
        <div className="mt-2 flex min-h-0 flex-1 items-center justify-center overflow-auto">
          <div style={{ transform: `scale(${ZOOM_LEVELS[zoomIndex]})`, transformOrigin: 'center', maxHeight: 560 }}>
            <HotspotImage
              key={question.id}
              image={image}
              targetStructureId={question.targetStructureId}
              toleranceMultiplier={question.toleranceMultiplier}
              onAnswer={handleImageAnswer}
              examMode={examMode}
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 grid max-w-2xl grid-cols-3 gap-2.5">
          {candidateStructures.map((s) => {
            const isTarget = s.id === question.targetStructureId;
            const isSelected = result?.structureId === s.id;
            let style = { border: '1.2px solid var(--line)', background: 'var(--sf)', color: 'var(--ink)' };
            if (result && !examMode && isTarget) style = { border: '1.4px solid var(--acc)', background: 'var(--accs)', color: 'var(--accd)' };
            else if (result && !examMode && isSelected) style = { border: '1.4px solid var(--acc2)', background: 'var(--acc2s)', color: 'var(--acc2d)' };
            return (
              <button
                key={s.id}
                type="button"
                disabled={!!result}
                onClick={() => handleListAnswer(s.id)}
                className="rounded-[3px] p-2.5 text-sm disabled:cursor-default"
                style={style}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {result && examMode && <ExamAnswerFooter onNext={onNext} compact />}

      {result && !examMode && (
        <div className="mt-8 w-full max-w-[720px] rounded-[3px] p-6" style={{ background: result.correct ? 'var(--accs)' : 'var(--acc2s)' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, color: result.correct ? 'var(--accd)' : 'var(--acc2d)' }}>
            {result.correct
              ? 'Correct'
              : `Not quite — that was ${structuresById.get(question.targetStructureId)?.name ?? question.targetStructureId}.`}
          </p>
          {!rated ? (
            <div className="mt-4">
              <ConfidenceButtons onRate={handleRate} />
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
