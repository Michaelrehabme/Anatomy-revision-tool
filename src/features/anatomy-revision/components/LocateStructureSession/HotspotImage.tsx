import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import type { AnatomyImageAsset } from '../../types/image';
import { isAccuratePass, scoreAccuracy } from '../../lib/hotspot/accuracy';
import { hitTest, type HitTestCandidate } from '../../lib/hotspot/pointInPolygon';
import { normalizePointerEvent } from '../../lib/hotspot/normalizeCoordinates';
import { HotspotOverlay } from './HotspotOverlay';
import { AttributionBadge } from '../shared/AttributionBadge';

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

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Under this many pixels of movement a pointer gesture is a click, not a drag. */
const DRAG_THRESHOLD_PX = 8;
/** One frame of rotation per this many pixels of sideways drag. */
const PX_PER_FRAME = 48;

/**
 * Handles both `single-structure` and `atlas-slide` image modes with the
 * same component and click logic — image.hotspots may contain one polygon
 * (single-structure) or many (atlas-slide); hitTest always resolves
 * whichever polygon contains the click point, smallest-area-wins when they
 * overlap (see lib/hotspot/pointInPolygon.ts).
 *
 * ZOOM AND ROTATION LIVE HERE, not in the session, so the mobile session gets
 * them for free and so the click can be mapped correctly. Scroll or pinch
 * zooms about the pointer; a drag pans once zoomed in, and at 1x turns the
 * joint if there are frames to turn to. The picture and its overlay sit in
 * one transformed box, and normalizePointerEvent reads THAT box's rendered
 * rect — a transformed element reports its transformed bounds — so the
 * normalised click is right at any magnification without any inverse maths.
 *
 * Sizes its outer box via CSS aspect-ratio from the asset's natural
 * width/height so the rendered <img> always fills its box 1:1 — this is what
 * keeps normalizePointerEvent's coordinates correct; see that module's
 * comment for why object-fit: contain letterboxing would otherwise corrupt
 * them.
 */
export function HotspotImage({ image, frames, targetStructureId, toleranceMultiplier, onAnswer, examMode }: HotspotImageProps) {
  const zoomerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [answer, setAnswer] = useState<HotspotAnswerResult | null>(null);

  const frameList = frames && frames.length > 1 ? frames : [image];
  const [frameIndex, setFrameIndex] = useState(() => Math.max(0, frameList.findIndex((f) => f.id === image.id)));
  useEffect(() => {
    setFrameIndex(Math.max(0, frameList.findIndex((f) => f.id === image.id)));
    // A new question: the opening frame, unzoomed.
    setView({ z: 1, tx: 0, ty: 0 });
    setAnswer(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image.id]);
  const current = frameList[frameIndex] ?? image;
  const canTurn = frameList.length > 1 && !answer;

  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 });
  const gesture = useRef<null | {
    kind: 'pan' | 'turn' | 'pinch';
    x: number; y: number; tx: number; ty: number; z: number;
    moved: boolean; turned: number; dist?: number; mid?: [number, number];
  }>(null);
  const pointers = useRef(new Map<number, [number, number]>());
  const suppressClick = useRef(false);

  const hotspots = current.hotspots ?? [];
  const targetHotspot = hotspots.find((h) => h.structureId === targetStructureId);

  /** Keep the picture covering the stage: no gaps at the edges, zoom within bounds. */
  const clamp = (v: { z: number; tx: number; ty: number }) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return v;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z));
    return {
      z,
      tx: Math.min(0, Math.max(r.width - r.width * z, v.tx)),
      ty: Math.min(0, Math.max(r.height - r.height * z, v.ty)),
    };
  };
  const zoomAt = (factor: number, cx: number, cy: number) =>
    setView((v) => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * factor));
      const k = z / v.z;
      // The point under the pointer stays under the pointer.
      return clamp({ z, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k });
    });
  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = stageRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const [x, y] = local(e);
    zoomAt(Math.exp(-e.deltaY * 0.0015), x, y);
  };

  const turn = (step: number) => {
    if (!canTurn) return;
    setFrameIndex((i) => (i + step + frameList.length) % frameList.length);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-controls]')) return;
    pointers.current.set(e.pointerId, local(e));
    stageRef.current?.setPointerCapture(e.pointerId);
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = { kind: view.z > 1.001 ? 'pan' : 'turn', x: pts[0][0], y: pts[0][1], tx: view.tx, ty: view.ty, z: view.z, moved: false, turned: 0 };
    } else if (pts.length === 2) {
      gesture.current = {
        kind: 'pinch', x: 0, y: 0, tx: view.tx, ty: view.ty, z: view.z, moved: true, turned: 0,
        dist: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]),
        mid: [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2],
      };
    }
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    if (g.kind === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2 || !g.dist || !g.mid) return;
      const dist = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (g.z * dist) / g.dist));
      const k = z / g.z;
      const mid: [number, number] = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
      setView(clamp({ z, tx: mid[0] - (g.mid[0] - g.tx) * k, ty: mid[1] - (g.mid[1] - g.ty) * k }));
      return;
    }
    const [x, y] = pointers.current.get(e.pointerId)!;
    const dx = x - g.x;
    const dy = y - g.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) g.moved = true;
    if (!g.moved) return;
    if (g.kind === 'pan') {
      setView(clamp({ z: g.z, tx: g.tx + dx, ty: g.ty + dy }));
    } else if (canTurn) {
      const step = Math.round(dx / PX_PER_FRAME);
      if (step !== g.turned) {
        turn(step - g.turned);
        g.turned = step;
      }
    }
  };
  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current?.moved) suppressClick.current = true;
    if (pointers.current.size === 0 || gesture.current?.kind === 'pinch') gesture.current = null;
  };

  const handleClick = (e: ReactPointerEvent<HTMLDivElement> | { clientX: number; clientY: number; target: EventTarget }) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest?.('[data-controls]')) return;
    if (answer || !zoomerRef.current) return;

    // The zoomer is the transformed box; its rendered rect IS the picture's,
    // so a click maps to the same normalised point at any zoom or pan.
    const point = normalizePointerEvent(e, zoomerRef.current);
    const candidates: HitTestCandidate[] = hotspots.map((h) => ({
      structureId: h.structureId,
      polygons: h.polygons,
      area: h.area,
    }));
    const hit = hitTest(point, candidates, toleranceMultiplier);
    const hitDistance = targetHotspot ? distance(point, targetHotspot.centroid) : undefined;

    // A point target is graded on accuracy, not on landing inside the circle.
    // The circle is 2.5x the landmark's radius, so tapping its outer edge is a
    // near miss rather than a find — scoring 7 means you were ON the landmark.
    const accuracy = targetHotspot ? (scoreAccuracy(point, targetHotspot) ?? undefined) : undefined;
    const correct =
      accuracy !== undefined ? isAccuratePass(accuracy) : hit?.structureId === targetStructureId;

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

  if (hotspots.length === 0 && frameList.length === 1) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink3">
        No hotspot data for this image yet.
      </p>
    );
  }

  const zoomed = view.z > 1.001;
  const controlButton = 'rounded bg-sf/90 px-2 py-1 text-xs shadow-sm border border-line hover:bg-sf';

  return (
    <figure>
      <div
        ref={stageRef}
        onClick={handleClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-full overflow-hidden rounded-lg border border-line bg-sf select-none ${answer ? '' : zoomed ? 'cursor-grab' : 'cursor-crosshair'}`}
        style={{
          aspectRatio: current.width && current.height ? `${current.width} / ${current.height}` : undefined,
          touchAction: 'none',
        }}
        role="button"
        aria-label={current.slideTitle ?? 'Anatomy image, click to answer'}
      >
        <div
          ref={zoomerRef}
          className="absolute inset-0"
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`, transformOrigin: '0 0' }}
        >
          <img src={current.filePath} alt={current.slideTitle ?? 'Anatomy structure'} className="h-full w-full object-cover" draggable={false} />
          {answer && !examMode && (
            <HotspotOverlay
              hotspots={hotspots}
              highlightStructureId={targetStructureId}
              clickPoint={answer.point}
              clickWasCorrect={answer.correct}
            />
          )}
        </div>

        {/* Zoom: scroll or pinch does the same; these are for those who prefer buttons. */}
        <div data-controls className="absolute right-2 top-2 flex flex-col gap-1" style={{ color: 'var(--ink)' }}>
          <button type="button" className={controlButton} aria-label="Zoom in" onClick={() => { const r = stageRef.current!.getBoundingClientRect(); zoomAt(1.5, r.width / 2, r.height / 2); }}>+</button>
          <span className="rounded bg-sf/90 px-1 py-0.5 text-center text-[10px] tabular-nums" style={{ color: 'var(--ink3)' }}>{view.z.toFixed(1)}×</span>
          <button type="button" className={controlButton} aria-label="Zoom out" onClick={() => { const r = stageRef.current!.getBoundingClientRect(); zoomAt(1 / 1.5, r.width / 2, r.height / 2); }}>−</button>
          {zoomed && (
            <button type="button" className={controlButton} aria-label="Reset zoom" onClick={() => setView({ z: 1, tx: 0, ty: 0 })}>↺</button>
          )}
        </div>

        {/* Rotation: only for a rotation set, and only until the answer is in. */}
        {frameList.length > 1 && (
          <div data-controls className="absolute bottom-2 left-2 right-2 flex items-center justify-between" style={{ color: 'var(--ink)' }}>
            <button type="button" className={controlButton} aria-label="Rotate left" disabled={!canTurn} onClick={() => turn(-1)}>◀ rotate</button>
            <span className="rounded bg-sf/90 px-2 py-1 text-[10px] tabular-nums" style={{ color: 'var(--ink3)' }}>
              {angleLabel(current)} · {frameIndex + 1}/{frameList.length}
            </span>
            <button type="button" className={controlButton} aria-label="Rotate right" disabled={!canTurn} onClick={() => turn(1)}>rotate ▶</button>
          </div>
        )}
      </div>
      <AttributionBadge image={current} />
    </figure>
  );
}

function angleLabel(image: AnatomyImageAsset): string {
  return image.view[0].toUpperCase() + image.view.slice(1);
}

function distance(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}
