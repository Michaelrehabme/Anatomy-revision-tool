import { useEffect, useState } from 'react';
import type { AnatomyImageAsset } from '../../types/image';
import { distanceToTarget, isAccuratePass, scoreAccuracy, scoreRegion } from '../../lib/hotspot/accuracy';
import { hitTest, isOnTarget, type HitTestCandidate } from '../../lib/hotspot/pointInPolygon';
import { HotspotOverlay } from './HotspotOverlay';
import { ImageViewer } from '../shared/ImageViewer';

export interface HotspotAnswerResult {
  structureId: string | null;
  correct: boolean;
  point: [number, number];
  hitDistance?: number;
  /**
   * 10 for dead centre down to 0 outside the target, for landmarks only — a
   * point on a bone, where how close you were IS the answer. Undefined for a
   * muscle or bone outline, where being inside it is simply right.
   */
  accuracy?: number;
  /** Which frame of a rotation set was showing when the student answered. */
  imageId: string;
}

interface HotspotImageProps {
  image: AnatomyImageAsset;
  /**
   * The other angles of the same picture, `image` included, in angle order.
   * When there is more than one the student can turn the joint: arrows, or a
   * sideways drag at 1x. Each frame carries its own hotspots.
   */
  frames?: AnatomyImageAsset[];
  /** The structure id the student is being asked to find. */
  targetStructureId: string;
  toleranceMultiplier?: number;
  onAnswer: (result: HotspotAnswerResult) => void;
  /** Suppresses the correct/incorrect overlay reveal — CR-009 exam mode. */
  examMode?: boolean;
}

/**
 * Grading a tap on an anatomy picture.
 *
 * Handles both `single-structure` and `atlas-slide` image modes with the same
 * click logic — image.hotspots may contain one polygon (single-structure) or
 * many (atlas-slide); hitTest always resolves whichever polygon contains the
 * click point, smallest-area-wins when they overlap (see
 * lib/hotspot/pointInPolygon.ts).
 *
 * TURNING AND ZOOMING ARE NOT HERE ANY MORE. They were, and that was why
 * identify and MCQ — which show the same plates — showed them flat. They live
 * in shared/ImageViewer.tsx now, which hands back a tap already normalised
 * against whatever frame was showing. What is left here is the part that is
 * really about answering a question.
 */
export function HotspotImage({ image, frames, targetStructureId, toleranceMultiplier, onAnswer, examMode }: HotspotImageProps) {
  const [answer, setAnswer] = useState<HotspotAnswerResult | null>(null);
  useEffect(() => setAnswer(null), [image.id]);

  const grade = (point: [number, number], current: AnatomyImageAsset) => {
    const hotspots = current.hotspots ?? [];
    // ALL of them, not the first: a picture can carry several traced pieces of
    // one structure — a ligament split around whatever crosses it, 55 cases in
    // the seed — and grading against only the first marks a tap on the other
    // piece wrong while the overlay cheerfully draws both in green.
    const targetHotspots = hotspots.filter((h) => h.structureId === targetStructureId);
    const targetPolygons = targetHotspots.flatMap((h) => h.polygons);

    const candidates: HitTestCandidate[] = hotspots.map((h) => ({
      structureId: h.structureId,
      polygons: h.polygons,
      area: h.area,
    }));
    const hit = hitTest(point, candidates, toleranceMultiplier);
    // Measured to the landmark's spine, so it stays meaningful for a crest or
    // a ridge. Identical to the old centroid distance for a point target.
    const hitDistance = targetHotspots.length
      ? Math.min(...targetHotspots.map((h) => distanceToTarget(point, h)))
      : undefined;

    // A point target is graded on accuracy, not on landing inside the circle.
    // The circle is 2.5x the landmark's radius, so tapping its outer edge is a
    // near miss rather than a find — scoring 7 means you were ON the landmark.
    // A point or a capsule scores by rings. A traced region has no centre to
    // measure from, but where it carries a core — the anatomy itself, inside
    // the grown hitbox — it still separates a tap ON the landmark from one in
    // the margin, which is the same distinction the rings make.
    const scores = targetHotspots
      .map((h) => scoreAccuracy(point, h) ?? scoreRegion(point, h))
      .filter((s): s is number => s !== null);
    const accuracy = scores.length ? Math.max(...scores) : undefined;
    // An outline target is graded against the TARGET's own polygons plus a few
    // pixels of slack, not against whatever hitTest resolved: hitTest answers
    // "what is under the finger", and for two structures that share an edge
    // that is the wrong question to grade on. See isOnTarget.
    const correct =
      accuracy !== undefined
        ? isAccuratePass(accuracy)
        : targetPolygons.length
          ? isOnTarget(point, targetPolygons)
          : hit?.structureId === targetStructureId;

    const result: HotspotAnswerResult = {
      structureId: hit?.structureId ?? null,
      correct,
      point,
      hitDistance,
      accuracy,
      imageId: current.id,
    };
    setAnswer(result);
    onAnswer(result);
  };

  const frameList = frames && frames.length > 1 ? frames : [image];
  if ((image.hotspots ?? []).length === 0 && frameList.length === 1) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink3">
        No hotspot data for this image yet.
      </p>
    );
  }

  return (
    <ImageViewer
      image={image}
      frames={frames}
      onPick={grade}
      locked={!!answer}
      resetKey={image.id}
      overlay={(current) =>
        answer && !examMode ? (
          <HotspotOverlay
            hotspots={current.hotspots ?? []}
            highlightStructureId={targetStructureId}
            clickPoint={answer.point}
            clickWasCorrect={answer.correct}
          />
        ) : null
      }
    />
  );
}
