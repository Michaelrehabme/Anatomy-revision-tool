import {
  useEffect, useRef, useState,
  type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent,
} from 'react';
import type { AnatomyImageAsset } from '../../types/image';
import { normalizePointerEvent } from '../../lib/hotspot/normalizeCoordinates';
import { rotationAngle } from '../../lib/rotationFrames';
import { AttributionBadge } from './AttributionBadge';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
/** Under this many pixels of movement a pointer gesture is a click, not a drag. */
const DRAG_THRESHOLD_PX = 8;
/** One frame of rotation per this many pixels of sideways drag. */
const PX_PER_FRAME = 48;

export interface ImageViewerProps {
  /** The opening frame, and the whole picture when there is no set to turn. */
  image: AnatomyImageAsset;
  /** Every angle of the same picture, `image` included, in angle order. */
  frames?: AnatomyImageAsset[];
  /** Drawn over the picture INSIDE the transformed box, so it zooms with it. */
  overlay?: (current: AnatomyImageAsset) => ReactNode;
  /** A tap on the picture, in normalised image coordinates. Omit for read-only. */
  onPick?: (point: [number, number], current: AnatomyImageAsset) => void;
  /** Stops turning and picking — the answer is in. */
  locked?: boolean;
  /** Zoom and frame reset when this changes; pass the question's id. */
  resetKey?: string;
  className?: string;
}

/**
 * The picture, and the two things a student can do to it: turn it, and move in.
 *
 * WHY THIS IS SHARED. A clinician looking at a real specimen walks round it and
 * leans in, and the app should not make that a privilege of one question type.
 * Zoom and rotation were built for locate and lived inside HotspotImage, so
 * identify and MCQ — which show the SAME plates — rendered them as flat
 * pictures. A structure you cannot turn towards you is one you have to identify
 * from whichever side the renderer happened to pick.
 *
 * The picture and its overlay sit in ONE transformed box, and
 * normalizePointerEvent reads that box's rendered rect — a transformed element
 * reports its transformed bounds — so a normalised tap is right at any
 * magnification without any inverse maths.
 *
 * The outer box is sized by CSS aspect-ratio from the asset's own width and
 * height so the <img> fills it 1:1. That is what keeps those coordinates
 * correct; object-fit: contain would letterbox and corrupt them.
 */
export function ImageViewer({ image, frames, overlay, onPick, locked, resetKey, className }: ImageViewerProps) {
  const zoomerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const frameList = frames && frames.length > 1 ? frames : [image];
  const [frameIndex, setFrameIndex] = useState(() => Math.max(0, frameList.findIndex((f) => f.id === image.id)));
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 });
  useEffect(() => {
    setFrameIndex(Math.max(0, frameList.findIndex((f) => f.id === image.id)));
    setView({ z: 1, tx: 0, ty: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey ?? image.id]);

  const current = frameList[frameIndex] ?? image;
  const canTurn = frameList.length > 1 && !locked;

  const gesture = useRef<null | {
    kind: 'pan' | 'turn' | 'pinch';
    x: number; y: number; tx: number; ty: number; z: number;
    moved: boolean; turned: number; dist?: number; mid?: [number, number];
  }>(null);
  const pointers = useRef(new Map<number, [number, number]>());
  const suppressClick = useRef(false);

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
    if (!onPick || locked || !zoomerRef.current) return;
    onPick(normalizePointerEvent(e, zoomerRef.current), current);
  };

  const zoomed = view.z > 1.001;
  const controlButton = 'rounded bg-sf/90 px-2 py-1 text-xs shadow-sm border border-line hover:bg-sf';
  const pickable = onPick && !locked;

  return (
    <figure className={className}>
      <div
        ref={stageRef}
        onClick={handleClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-full overflow-hidden rounded-lg border border-line bg-sf select-none ${
          pickable ? (zoomed ? 'cursor-grab' : 'cursor-crosshair') : zoomed ? 'cursor-grab' : ''
        }`}
        style={{
          aspectRatio: current.width && current.height ? `${current.width} / ${current.height}` : undefined,
          touchAction: 'none',
        }}
        role={pickable ? 'button' : undefined}
        aria-label={current.slideTitle ?? 'Anatomy image'}
      >
        <div
          ref={zoomerRef}
          className="absolute inset-0"
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`, transformOrigin: '0 0' }}
        >
          <img src={current.filePath} alt={current.slideTitle ?? 'Anatomy structure'} className="h-full w-full object-cover" draggable={false} />
          {overlay?.(current)}
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

/**
 * "Anterolateral · 60°".
 *
 * At thirty degrees a turntable has twelve frames and only eight names worth
 * having, so two frames share a name and the degrees are what tell them apart —
 * and "turn it another thirty" is how someone actually thinks about walking
 * round a specimen. A picture with no angle keeps the plain name.
 */
function angleLabel(image: AnatomyImageAsset): string {
  const name = image.view[0].toUpperCase() + image.view.slice(1);
  const deg = rotationAngle(image.id);
  return deg === null ? name : `${name} · ${deg}°`;
}
