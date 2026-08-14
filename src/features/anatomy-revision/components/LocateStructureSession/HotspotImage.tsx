import { useRef, useState, type MouseEvent } from 'react';
import type { AnatomyImageAsset } from '../../types/image';
import { hitTest, type HitTestCandidate } from '../../lib/hotspot/pointInPolygon';
import { normalizePointerEvent } from '../../lib/hotspot/normalizeCoordinates';
import { HotspotOverlay } from './HotspotOverlay';
import { AttributionBadge } from '../shared/AttributionBadge';

export interface HotspotAnswerResult {
  structureId: string | null;
  correct: boolean;
  point: [number, number];
  hitDistance?: number;
}

interface HotspotImageProps {
  image: AnatomyImageAsset;
  /** The structure id the student is being asked to find. */
  targetStructureId: string;
  toleranceMultiplier?: number;
  onAnswer: (result: HotspotAnswerResult) => void;
}

/**
 * Handles both `single-structure` and `atlas-slide` image modes with the
 * same component and click logic — image.hotspots may contain one polygon
 * (single-structure) or many (atlas-slide); hitTest always resolves
 * whichever polygon contains the click point, smallest-area-wins when they
 * overlap (see lib/hotspot/pointInPolygon.ts).
 *
 * Sizes its box via CSS aspect-ratio from the asset's natural width/height
 * so the rendered <img> always fills its box 1:1 — this is what keeps
 * normalizePointerEvent's coordinates correct; see that module's comment
 * for why object-fit: contain letterboxing would otherwise corrupt them.
 */
export function HotspotImage({ image, targetStructureId, toleranceMultiplier, onAnswer }: HotspotImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [answer, setAnswer] = useState<HotspotAnswerResult | null>(null);

  const hotspots = image.hotspots ?? [];
  const targetHotspot = hotspots.find((h) => h.structureId === targetStructureId);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (answer || !wrapperRef.current) return;

    const point = normalizePointerEvent(event, wrapperRef.current);
    const candidates: HitTestCandidate[] = hotspots.map((h) => ({
      structureId: h.structureId,
      polygons: h.polygons,
      area: h.area,
    }));
    const hit = hitTest(point, candidates, toleranceMultiplier);
    const correct = hit?.structureId === targetStructureId;
    const hitDistance = targetHotspot ? distance(point, targetHotspot.centroid) : undefined;

    const result: HotspotAnswerResult = { structureId: hit?.structureId ?? null, correct, point, hitDistance };
    setAnswer(result);
    onAnswer(result);
  };

  if (hotspots.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No hotspot data for this image yet.
      </p>
    );
  }

  return (
    <figure>
      <div
        ref={wrapperRef}
        onClick={handleClick}
        className={`relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ${answer ? '' : 'cursor-crosshair'}`}
        style={image.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
        role="button"
        aria-label={image.slideTitle ?? 'Anatomy image, click to answer'}
      >
        <img src={image.filePath} alt={image.slideTitle ?? 'Anatomy structure'} className="h-full w-full object-cover" />
        {answer && (
          <HotspotOverlay
            hotspots={hotspots}
            highlightStructureId={targetStructureId}
            clickPoint={answer.point}
            clickWasCorrect={answer.correct}
          />
        )}
      </div>
      <AttributionBadge image={image} />
    </figure>
  );
}

function distance(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}
