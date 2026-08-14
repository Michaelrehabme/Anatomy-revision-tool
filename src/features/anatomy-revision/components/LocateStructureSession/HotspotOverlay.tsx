import type { HotspotPolygon } from '../../types/image';

interface HotspotOverlayProps {
  hotspots: HotspotPolygon[];
  /** Structure id to render in the "correct" style; others render neutrally (for atlas review mode). */
  highlightStructureId?: string;
  /** Where the student actually clicked, normalized [0,1] — rendered as a marker after answering. */
  clickPoint?: [number, number] | null;
  clickWasCorrect?: boolean;
}

/**
 * SVG reveal layer drawn over a HotspotImage after an answer, using the
 * exact same polygon data the click was tested against — so the shown
 * "correct area" is always pixel-accurate to the hit-test, never an
 * approximation. viewBox 0-1 matches the normalized coordinate system used
 * throughout (see lib/hotspot).
 */
export function HotspotOverlay({ hotspots, highlightStructureId, clickPoint, clickWasCorrect }: HotspotOverlayProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {hotspots.map((hotspot) =>
        hotspot.polygons.map((polygon, partIndex) => {
          const isTarget = hotspot.structureId === highlightStructureId;
          return (
            <polygon
              key={`${hotspot.structureId}-${partIndex}`}
              points={polygon.map(([x, y]) => `${x},${y}`).join(' ')}
              className={isTarget ? 'fill-emerald-400/40 stroke-emerald-500' : 'fill-transparent stroke-transparent'}
              strokeWidth={0.003}
              vectorEffect="non-scaling-stroke"
            />
          );
        }),
      )}
      {clickPoint && (
        <circle
          cx={clickPoint[0]}
          cy={clickPoint[1]}
          r={0.012}
          className={clickWasCorrect ? 'fill-emerald-500' : 'fill-rose-500'}
          stroke="white"
          strokeWidth={0.003}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
