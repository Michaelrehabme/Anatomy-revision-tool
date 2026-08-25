import type { CSSProperties } from 'react';
import type { Region } from '../../types/region';
import { REGION_LABELS } from '../../types/region';

/**
 * The design project's line-art layer (anatomy/figure-posterior.png) is a
 * large, detailed illustration that exceeds the design-asset fetch tool's
 * per-file cap (256 KiB of base64) — every fetch attempt came back silently
 * truncated (valid PNG header, no IEND). Only the small silhouette mask
 * (anatomy/figure-posterior-fill.png, ~3 KB) fetched intact. Until someone
 * re-exports a smaller/optimized line-art file, this component approximates
 * an outline by rendering the same silhouette mask twice (a slightly
 * upscaled --fig-line "stroke" behind the --fig-off fill) instead of the
 * true contour linework.
 */
const FILL_SRC = '/anatomy/figure/figure-posterior-fill.png';

/**
 * Fractional [x, y, w, h] rectangles against the 608x1440 canvas the design
 * prototype's BodyFigure.dc.html composited on <canvas> (silhouette mask,
 * tinted per-region, clipped to these same rectangles, line art on top).
 * Reimplemented here with CSS mask-image instead of canvas compositing —
 * see the plan's "Body figure" section for why: there's no actual vector
 * region outline data anywhere, only this rectangle-over-silhouette-mask
 * technique, which translates directly to CSS without a <canvas>.
 */
const REGION_RECTS: { region: Region; rect: [number, number, number, number] }[] = [
  { region: 'shoulder-arm', rect: [0, 0.16, 0.27, 0.28] },
  { region: 'shoulder-arm', rect: [0.73, 0.16, 0.27, 0.28] },
  { region: 'forearm-hand', rect: [0, 0.44, 0.27, 0.16] },
  { region: 'forearm-hand', rect: [0.73, 0.44, 0.27, 0.16] },
  { region: 'back-core', rect: [0.27, 0.12, 0.46, 0.36] },
  { region: 'hip-thigh', rect: [0.21, 0.48, 0.58, 0.28] },
  { region: 'lower-leg-foot', rect: [0.21, 0.76, 0.58, 0.24] },
];

function maskStyle(src: string): CSSProperties {
  return {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  };
}

export interface BodyFigureProps {
  selected: ReadonlySet<Region>;
  onToggle: (region: Region) => void;
  className?: string;
}

/**
 * Posterior body figure with five clickable, multi-select regions, tinted
 * when selected. Used by the Region Picker (desktop screen 03). Not used
 * for locate-question hit-testing — that stays on the existing per-image
 * polygon system in lib/hotspot/, which targets a single cropped structure
 * image rather than the whole-body figure.
 */
export function BodyFigure({ selected, onToggle, className }: BodyFigureProps) {
  return (
    <div className={className} style={{ position: 'relative', width: '100%', aspectRatio: '608 / 1440' }}>
      {/* Approximate outline: same mask, upscaled, in the darker stroke color, behind the fill */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'scale(1.018)',
          backgroundColor: 'var(--fig-line)',
          ...maskStyle(FILL_SRC),
        }}
      />
      {/* Base silhouette, unselected/neutral fill */}
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--fig-off)', ...maskStyle(FILL_SRC) }}
      />

      {REGION_RECTS.map(({ region, rect }, i) => {
        const [x, y, w, h] = rect;
        const isSelected = selected.has(region);
        return (
          <button
            key={`${region}-${i}`}
            type="button"
            title={REGION_LABELS[region]}
            aria-pressed={isSelected}
            onClick={() => onToggle(region)}
            className="group absolute cursor-pointer border-0 bg-transparent p-0"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, overflow: 'hidden' }}
          >
            <span
              aria-hidden
              className="block transition-colors duration-150 group-hover:[background-color:var(--accs)]"
              style={{
                position: 'absolute',
                left: `${-(x / w) * 100}%`,
                top: `${-(y / h) * 100}%`,
                width: `${(1 / w) * 100}%`,
                height: `${(1 / h) * 100}%`,
                backgroundColor: isSelected ? 'var(--acc)' : 'transparent',
                ...maskStyle(FILL_SRC),
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
