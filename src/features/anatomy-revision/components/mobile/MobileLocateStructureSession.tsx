import { useEffect, useState } from 'react';
import type { LocateQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import type { Confidence } from '../../types/attempt';
import { HotspotImage, type HotspotAnswerResult } from '../LocateStructureSession/HotspotImage';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { BottomSheet } from '../shared/BottomSheet';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { recordHintShown, shouldShowHint } from '../../lib/firstTimeHints';
import { locateFeedback } from '../LocateStructureSession/locateFeedback';

interface MobileLocateStructureSessionProps {
  question: LocateQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  structuresById: Map<string, AnatomyStructure>;
  onAnswer: (params: { structureId: string; correct: boolean; hitDistance?: number; accuracy?: number; confidence?: Confidence }) => void;
  onNext: () => void;
  onFullCard: () => void;
  /** No color reveal, no self-rating — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
}

/**
 * The mobile mockup's own "locate" mechanic is a 2x2 grid of cropped atlas
 * panels (pick which panel shows muscle X) — a different interaction from
 * the app's existing point-and-click hotspot system. Reusing the existing
 * HotspotImage/list-fallback mechanic here instead (restyled, not
 * reinvented), per the plan's deliberate-simplification note — no zoom
 * controls on mobile (no room for them at this width), list-mode is the
 * primary path here rather than a fallback.
 */
export function MobileLocateStructureSession({
  question,
  imagesById,
  structuresById,
  onAnswer,
  onNext,
  onFullCard,
  examMode,
}: MobileLocateStructureSessionProps) {
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
    return (
      <p className="p-6 text-sm" style={{ color: 'var(--acc2d)' }}>
        Image "{question.imageId}" not found.
      </p>
    );
  }
  const frames = (question.frameImageIds ?? [])
    .map((id) => imagesById.get(id))
    .filter((f): f is AnatomyImageAsset => !!f);

  const submitExamAnswer = (r: HotspotAnswerResult) => {
    onAnswer({ structureId: question.targetStructureId, correct: r.correct, hitDistance: r.hitDistance, accuracy: r.accuracy });
  };
  const handleImageAnswer = (r: HotspotAnswerResult) => {
    setResult(r);
    if (examMode) submitExamAnswer(r);
  };
  const handleListAnswer = (structureId: string) => {
    if (result) return;
    // The list fallback names a structure rather than pointing at one, so
    // there is no tap and no frame of its own — the question's own image is
    // the honest answer for `imageId`, and [0, 0] the conventional no-point.
    const r: HotspotAnswerResult = {
      structureId,
      correct: structureId === question.targetStructureId,
      point: [0, 0] as [number, number],
      imageId: question.imageId,
    };
    setResult(r);
    if (examMode) submitExamAnswer(r);
  };
  const handleRate = (confidence: Confidence) => {
    if (!result) return;
    setRated(true);
    onAnswer({ structureId: question.targetStructureId, correct: result.correct, hitDistance: result.hitDistance, accuracy: result.accuracy, confidence });
  };

  const candidateStructures = [
    ...new Set([image, ...frames].flatMap((f) => (f.hotspots ?? []).map((h) => h.structureId))),
  ]
    .map((id) => structuresById.get(id))
    .filter((s): s is AnatomyStructure => !!s);

  const feedback = result
    ? locateFeedback(
        result,
        structuresById.get(question.targetStructureId)?.name ?? question.targetStructureId,
        result.structureId ? structuresById.get(result.structureId)?.name : undefined,
      )
    : { title: '', detail: undefined as string | undefined };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6.5 pb-5">
        <div
          className="mt-4.5"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}
        >
          Locate
        </div>
        <h2
          className="mt-3"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, lineHeight: 1.14, letterSpacing: '-.012em' }}
        >
          {question.prompt}
        </h2>
        {showHint && !listMode && (
          <p className="mt-2.5 text-sm leading-snug" style={{ color: 'var(--ink2)' }}>
            Tap where it sits on the image. Your first tap is your answer.
          </p>
        )}

        <button
          type="button"
          onClick={() => setListMode((v) => !v)}
          className="mt-2.5 border-0 bg-transparent p-0 text-xs underline decoration-dotted"
          style={{ color: 'var(--ink3)' }}
        >
          {listMode ? 'Switch to image tap' : "Can't tap precisely? Choose from a list"}
        </button>

        {!listMode ? (
          <div className="mt-4 flex justify-center">
            <div className="w-full max-w-xs">
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
          <div className="mt-4 grid grid-cols-2 gap-2">
            {candidateStructures.map((s) => {
              const isTarget = s.id === question.targetStructureId;
              const isSelected = result?.structureId === s.id;
              let style = { border: '1.2px solid var(--line)', background: 'transparent', color: 'var(--ink)' };
              if (result && !examMode && isTarget) style = { border: '1.4px solid var(--acc)', background: 'var(--accs)', color: 'var(--accd)' };
              else if (result && !examMode && isSelected) style = { border: '1.4px solid var(--acc2)', background: 'var(--acc2s)', color: 'var(--acc2d)' };
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!!result}
                  onClick={() => handleListAnswer(s.id)}
                  className="rounded-[3px] p-3 text-sm disabled:cursor-default"
                  style={style}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {result && examMode && <ExamAnswerFooter onNext={onNext} compact />}

      {result && !examMode && (
        <BottomSheet
          correct={result.correct}
          title={feedback.title}
          body={feedback.detail ?? ''}
          onFullCard={onFullCard}
        >
          {rated ? (
            <button
              type="button"
              onClick={onNext}
              className="mt-4.5 w-full rounded-[3px] border-0"
              style={{ minHeight: 52, background: 'var(--acc-fill)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
            >
              Next
            </button>
          ) : (
            <div className="mt-4.5">
              <ConfidenceButtons onRate={handleRate} label="How did that feel?" />
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
