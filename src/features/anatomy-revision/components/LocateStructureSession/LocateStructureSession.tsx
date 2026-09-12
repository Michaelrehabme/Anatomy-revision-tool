import { useEffect, useState } from 'react';
import type { LocateQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import type { Confidence } from '../../types/attempt';
import { HotspotImage, type HotspotAnswerResult } from './HotspotImage';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { recordHintShown, shouldShowHint } from '../../lib/firstTimeHints';

interface LocateStructureSessionProps {
  question: LocateQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  structuresById: Map<string, AnatomyStructure>;
  onAnswer: (params: { structureId: string; correct: boolean; hitDistance?: number; confidence?: Confidence }) => void;
  onNext: () => void;
  /** No color reveal, no self-rating — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
}

/**
 * Wraps HotspotImage with a keyboard/list-based fallback for students who
 * can't (or don't want to) click precisely on the image — both paths funnel
 * through the same result handling so scoring is identical either way.
 * Zoom and rotation live in HotspotImage itself, so the mobile session has
 * them too and the click maps through them correctly.
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
  const [listMode, setListMode] = useState(false);
  const [rated, setRated] = useState(false);
  // Nothing on screen says the image itself is the answer surface — the
  // crosshair cursor is the only affordance. Said out loud the first couple of times.
  const [showHint] = useState(() => shouldShowHint('locate'));
  useEffect(() => {
    if (showHint) recordHintShown('locate');
  }, [showHint]);

  useEffect(() => {
    setResult(null);
    setListMode(false);
    setRated(false);
  }, [question.id]);

  const image = imagesById.get(question.imageId);
  if (!image) {
    return <p className="p-6 text-sm" style={{ color: 'var(--acc2d)' }}>Image "{question.imageId}" not found.</p>;
  }
  // The other angles of a rotation set, if the question has them.
  const frames = (question.frameImageIds ?? [])
    .map((id) => imagesById.get(id))
    .filter((f): f is AnatomyImageAsset => !!f);

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

  // The list fallback offers every structure visible from any angle.
  const candidateStructures = [
    ...new Set([image, ...frames].flatMap((f) => (f.hotspots ?? []).map((h) => h.structureId))),
  ]
    .map((id) => structuresById.get(id))
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
      {showHint && !listMode && (
        <p className="mt-3 max-w-md text-center text-sm leading-snug" style={{ color: 'var(--ink2)' }}>
          Click where the muscle sits on the image. Your first click is your answer.
        </p>
      )}

      <div className="mt-3 flex items-center gap-4" style={{ color: 'var(--ink3)' }}>
        <span className="text-xs">
          {frames.length > 1 ? 'Scroll to zoom · drag to turn' : 'Scroll to zoom'}
        </span>
        <button type="button" onClick={() => setListMode((v) => !v)} className="text-xs underline decoration-dotted">
          {listMode ? 'Switch to image click' : "Can't click precisely? Choose from a list"}
        </button>
      </div>

      {!listMode ? (
        <div className="mt-2 flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full max-w-[560px]">
            <HotspotImage
              key={question.id}
              image={image}
              frames={frames.length > 1 ? frames : undefined}
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
