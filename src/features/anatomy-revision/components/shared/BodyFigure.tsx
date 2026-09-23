import type { CSSProperties } from 'react';
import type { Area, Region } from '../../types/region';
import { AREA_LABELS, REGION_LABELS } from '../../types/region';

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
type Rect = [number, number, number, number];

const REGION_RECTS: { key: Region; rect: Rect }[] = [
  { key: 'shoulder-arm', rect: [0, 0.16, 0.27, 0.28] },
  { key: 'shoulder-arm', rect: [0.73, 0.16, 0.27, 0.28] },
  { key: 'forearm-hand', rect: [0, 0.44, 0.27, 0.16] },
  { key: 'forearm-hand', rect: [0.73, 0.44, 0.27, 0.16] },
  { key: 'back-core', rect: [0.27, 0.12, 0.46, 0.36] },
  { key: 'hip-thigh', rect: [0.21, 0.48, 0.58, 0.28] },
  { key: 'lower-leg-foot', rect: [0.21, 0.76, 0.58, 0.24] },
];

/**
 * The same silhouette split by Area instead of Region (CR-017). Areas are finer
 * than regions everywhere, so every band subdivides: the old shoulder-arm band
 * splits into shoulder and elbow, hip-thigh/lower-leg-foot become hip, knee and
 * ankle-foot, and the trunk band stacks into the three spine levels (CR-032).
 */
const AREA_RECTS: { key: Area; rect: Rect }[] = [
  { key: 'shoulder', rect: [0, 0.16, 0.27, 0.15] },
  { key: 'shoulder', rect: [0.73, 0.16, 0.27, 0.15] },
  { key: 'elbow', rect: [0, 0.31, 0.27, 0.13] },
  { key: 'elbow', rect: [0.73, 0.31, 0.27, 0.13] },
  { key: 'wrist-hand', rect: [0, 0.44, 0.27, 0.16] },
  { key: 'wrist-hand', rect: [0.73, 0.44, 0.27, 0.16] },
  { key: 'cervical-spine', rect: [0.27, 0.12, 0.46, 0.07] },
  { key: 'thoracic-spine', rect: [0.27, 0.19, 0.46, 0.16] },
  { key: 'lumbar-spine', rect: [0.27, 0.35, 0.46, 0.13] },
  { key: 'hip', rect: [0.21, 0.48, 0.58, 0.16] },
  { key: 'knee', rect: [0.21, 0.64, 0.58, 0.12] },
  { key: 'ankle-foot', rect: [0.21, 0.76, 0.58, 0.24] },
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

interface FigureProps<K extends string> {
  bands: { key: K; rect: Rect }[];
  labels: Record<K, string>;
  /** Selection mode (pickers): binary selected/unselected tint, clickable. Ignored when `fills` is set. */
  selected?: ReadonlySet<K>;
  /**
   * Bands the paywall shuts (CR-027). They stay on the figure — the silhouette
   * is the map of the body, and a body missing its knee is a worse thing to
   * show than a knee marked shut — but they do not respond to a click and
   * their title says why.
   */
  locked?: readonly K[];
  onToggle?: (key: K) => void;
  /**
   * Read-only mode (Progress screen): an explicit CSS color per band
   * (e.g. a mastery-mixed `color-mix(...)`), not clickable. Presence of
   * this prop — even partial — switches the whole figure to read-only,
   * matching the mobile mockup's Progress screen (no `interactive`/`on-*`
   * handlers passed to its BodyFigure there, unlike the picker).
   */
  fills?: Partial<Record<K, string>>;
  className?: string;
}

/**
 * Posterior body figure, banded either by Area (the study pickers, CR-017) or by
 * Region (Progress, mastery-shaded). Generic over the band key so both callers
 * keep full type safety rather than sharing a stringly-typed prop. Not used for
 * locate-question hit-testing — that stays on the per-image polygon system in
 * lib/hotspot/, which targets a single cropped structure image rather than the
 * whole-body figure.
 */
function Figure<K extends string>({ bands, labels, selected, locked, onToggle, fills, className }: FigureProps<K>) {
  const readOnly = fills !== undefined;
  return (
    // forcedColorAdjust: the figure is drawn entirely from background-color
    // under a mask, and Windows High Contrast forces every background to
    // Canvas — which makes the whole body vanish rather than merely restyle.
    <div
      className={className}
      style={{ position: 'relative', width: '100%', aspectRatio: '608 / 1440', forcedColorAdjust: 'none' }}
    >
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

      {bands.map(({ key, rect }, i) => {
        const [x, y, w, h] = rect;
        const fillColor = fills?.[key];
        const isLocked = !readOnly && (locked?.includes(key) ?? false);
        const isSelected = !readOnly && !isLocked && (selected?.has(key) ?? false);
        const color = readOnly ? (fillColor ?? 'transparent') : isSelected ? 'var(--acc)' : 'transparent';
        const tint = (
          <span
            aria-hidden
            className={readOnly ? 'block' : 'block transition-colors duration-150 group-hover:[background-color:var(--accs)]'}
            style={{
              position: 'absolute',
              left: `${-(x / w) * 100}%`,
              top: `${-(y / h) * 100}%`,
              width: `${(1 / w) * 100}%`,
              height: `${(1 / h) * 100}%`,
              backgroundColor: color,
              ...maskStyle(FILL_SRC),
            }}
          />
        );

        if (readOnly) {
          return (
            <div
              key={`${key}-${i}`}
              aria-hidden
              className="absolute"
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, overflow: 'hidden' }}
            >
              {tint}
            </div>
          );
        }

        return (
          <button
            key={`${key}-${i}`}
            type="button"
            title={isLocked ? `${labels[key]} — locked` : labels[key]}
            aria-pressed={isSelected}
            aria-disabled={isLocked}
            onClick={() => !isLocked && onToggle?.(key)}
            className={
              isLocked
                ? 'absolute border-0 bg-transparent p-0'
                : 'group absolute cursor-pointer border-0 bg-transparent p-0'
            }
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${w * 100}%`,
              height: `${h * 100}%`,
              overflow: 'hidden',
              cursor: isLocked ? 'default' : 'pointer',
              // Enough to read as "not yours yet" without making the figure
              // look broken or half-loaded.
              opacity: isLocked ? 0.45 : 1,
            }}
          >
            {tint}
          </button>
        );
      })}
    </div>
  );
}

/** Area-banded figure — the study pickers (desktop + mobile). */
export function BodyFigure(props: Omit<FigureProps<Area>, 'bands' | 'labels'>) {
  return <Figure bands={AREA_RECTS} labels={AREA_LABELS} {...props} />;
}

/** Region-banded figure — the Progress screen's mastery shading. */
export function RegionBodyFigure(props: Omit<FigureProps<Region>, 'bands' | 'labels'>) {
  return <Figure bands={REGION_RECTS} labels={REGION_LABELS} {...props} />;
}
