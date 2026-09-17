import type { HotspotPolygon } from '../../types/image';
import { isAccuracyTarget, PASS_FRACTION, RING_COUNT, targetSpines } from '../../lib/hotspot/accuracy';

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
 *
 * A SCORABLE TARGET IS DRAWN AS A TARGET FACE, not as one flat blob. It used
 * to be a single translucent disc covering the whole target, which is 2.5x the
 * landmark's own radius — so a student could tap well inside the green, be
 * told "not quite", and have no way to see why. The pass zone was the inner
 * 40% and was never drawn. Ten rings make the boundary the grading uses the
 * same boundary the eye sees, and the emphasised stroke at PASS_FRACTION is
 * the most important mark here: it is the literal line between correct and
 * not.
 *
 * A ring band is a round-capped stroke along the target's spine, which IS a
 * capsule of that half-width — so a point landmark and a linear one (a crest,
 * the linea aspera) draw through the same code, the point being a spine of one
 * vertex. Bands go outermost first and paint over each other, exactly as a
 * target face is printed.
 */
export function HotspotOverlay({ hotspots, highlightStructureId, clickPoint, clickWasCorrect }: HotspotOverlayProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {hotspots.map((hotspot) => {
        const isTarget = hotspot.structureId === highlightStructureId;
        if (isTarget && isAccuracyTarget(hotspot)) {
          return (
            <TargetFace
              key={`${hotspot.structureId}-face`}
              hotspot={hotspot}
              // A reveal without a click (an MCQ answer, the atlas, the dev
              // editor) is answering "where is it", not "how close were you".
              scored={Boolean(clickPoint)}
            />
          );
        }
        return hotspot.polygons.map((polygon, partIndex) => (
          <polygon
            key={`${hotspot.structureId}-${partIndex}`}
            points={polygon.map(([x, y]) => `${x},${y}`).join(' ')}
            className={isTarget ? 'fill-emerald-400/40 stroke-emerald-500' : 'fill-transparent stroke-transparent'}
            strokeWidth={0.003}
            vectorEffect="non-scaling-stroke"
          />
        ));
      })}
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

/**
 * The ten ring colours, innermost first, in the pairs a real target face uses:
 * gold, red, blue, black, white. Muted from competition colours because these
 * are painted over a bone and have to let it show through.
 *
 * The pass mark falls between index 3 and 4 — the red/blue change — which is
 * not a coincidence: PASS_SCORE is 7 precisely because that is where the
 * landmark itself ends. See lib/hotspot/accuracy.ts.
 */
const RING_COLOURS = [
  '#f5c518', '#f5c518', // 10, 9 — gold
  '#e05260', '#e05260', // 8, 7 — red   (pass boundary is the outer edge of this pair)
  '#4aa3d8', '#4aa3d8', // 6, 5 — blue
  '#3f4a5a', '#3f4a5a', // 4, 3 — black
  '#e8eaed', '#e8eaed', // 2, 1 — white
];

/**
 * Painted at this opacity AS A GROUP, not per band. Each band is opaque inside
 * the group, so an inner ring replaces the one beneath it instead of adding to
 * it — ten translucent discs stacked would accumulate alpha into a muddy blob
 * at the centre and lose the archery colours entirely.
 */
const FACE_OPACITY = 0.42;

/**
 * The dark rim marking the pass boundary, in normalized units. Laid down just
 * under the band that covers it, so what survives is a hairline.
 */
const BOUNDARY_WIDTH = 0.005;

/**
 * Which band's outer edge is the pass boundary, counting from the middle. A
 * tap passes while `floor(d / ring) <= RING_COUNT - PASS_SCORE`, so band
 * number `RING_COUNT - PASS_SCORE + 1` is the last one still inside.
 */
const PASS_BAND = Math.round(PASS_FRACTION * RING_COUNT);

function TargetFace({ hotspot, scored }: { hotspot: HotspotPolygon; scored: boolean }) {
  const radius = hotspot.targetRadius!;
  // One spine, or one per side when the landmark has a twin. Every band is
  // drawn on all of them before the next band in, so two faces that overlap
  // still read as one printed target rather than one face stamped on another.
  const spines = targetSpines(hotspot);

  /** A capsule of half-width `r` about each spine: one stroke, or one circle. */
  const band = (key: string, r: number, colour: string, opacity?: number, mark?: boolean) =>
    spines.map((spine, side) =>
      // An explicit branch rather than a degenerate `M x y L x y`, whose
      // round-cap rendering is left to the browser and differs between them.
      spine.length > 1 ? (
        <path
          key={`${key}-${side}`}
          d={`M ${spine.map(([x, y]) => `${x} ${y}`).join(' L ')}`}
          fill="none"
          stroke={colour}
          strokeWidth={2 * r}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
          data-pass-boundary={mark ? '' : undefined}
          data-band-width={2 * r}
        />
      ) : (
        <circle
          key={`${key}-${side}`}
          cx={spine[0][0]}
          cy={spine[0][1]}
          r={r}
          fill={colour}
          opacity={opacity}
          data-pass-boundary={mark ? '' : undefined}
          data-band-width={2 * r}
        />
      ),
    );

  if (!scored) {
    // Where it is, not how close you were. The old overlay showed the whole
    // 2.5x target here, which answers "where is the greater trochanter" with a
    // disc two and a half times too big.
    return (
      <g data-target-face>
        {band('halo', radius, '#34d399', 0.12)}
        {band('zone', radius * PASS_FRACTION, '#34d399', 0.45)}
      </g>
    );
  }

  const bands = [];
  // Outermost first, each inner band painting over the one beneath it. The
  // pass boundary is drawn the same way: a slightly wider dark capsule laid
  // down just before the band that covers it, leaving a hairline rim exactly
  // at PASS_FRACTION. That works for a capsule, where a true offset outline
  // around an N-point spine would not be a one-liner.
  for (let i = RING_COUNT; i >= 1; i--) {
    if (i === PASS_BAND) {
      bands.push(band('pass-boundary', (radius * i) / RING_COUNT + BOUNDARY_WIDTH, '#1b2430', undefined, true));
    }
    bands.push(band(`ring-${i}`, (radius * i) / RING_COUNT, RING_COLOURS[RING_COUNT - i]));
  }

  return (
    <g opacity={FACE_OPACITY} data-target-face>
      {bands}
    </g>
  );
}
