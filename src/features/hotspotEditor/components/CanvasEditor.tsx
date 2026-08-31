import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { AnatomyImageAsset, HotspotPolygon } from '../../anatomy-revision/types/image';
import type { AnatomyStructure } from '../../anatomy-revision/types/structure';
import { hitTest } from '../../anatomy-revision/lib/hotspot/pointInPolygon';
import { normalizePointerEvent } from '../../anatomy-revision/lib/hotspot/normalizeCoordinates';
import { HotspotOverlay } from '../../anatomy-revision/components/LocateStructureSession/HotspotOverlay';
import { polygonSetArea, polygonSetCentroid, validateHotspot } from '../lib/polygonMath';
import { StructureSelect } from './StructureSelect';

interface CanvasEditorProps {
  image: AnatomyImageAsset;
  hotspots: HotspotPolygon[];
  structures: AnatomyStructure[];
  onChange: (next: HotspotPolygon[]) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const CLOSE_RING_THRESHOLD = 0.025;
const VIEWPORT_HEIGHT = 560;

function deepCopyRings(rings: number[][][]): number[][][] {
  return rings.map((ring) => ring.map(([x, y]) => [x, y]));
}

/**
 * The click-to-place / drag-to-adjust polygon editor. Sizes its "stage" div
 * via aspect-ratio from the image's own naturalWidth/naturalHeight (captured
 * on load, not from AnatomyImageAsset.width/height — no seed image has that
 * populated yet), then panning/zooming is a plain CSS transform on that
 * stage. normalizePointerEvent already reads getBoundingClientRect(), which
 * reflects the CURRENT on-screen transform, so coordinates stay correct
 * under any pan/zoom without extra math — see its test for proof.
 */
export function CanvasEditor({ image, hotspots, structures, onChange }: CanvasEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const panDragRef = useRef<{ startX: number; startY: number; origPan: { x: number; y: number } } | null>(null);

  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [activeHotspotIndex, setActiveHotspotIndex] = useState<number | null>(null);
  const [activeRings, setActiveRings] = useState<number[][][]>([]);

  // Reset all in-progress editing state when switching images.
  useEffect(() => {
    setSelectedStructureId(null);
    setActiveHotspotIndex(null);
    setActiveRings([]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNaturalSize(null);
  }, [image.id]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') setIsSpaceDown(true);
      const target = e.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
      if (e.key === 'Backspace' && !isTyping && activeRings.length > 0) {
        e.preventDefault();
        removeLastVertex();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setIsSpaceDown(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeRings]);

  function removeLastVertex() {
    setActiveRings((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.map((r) => r.slice());
      const lastRingIdx = next.length - 1;
      next[lastRingIdx].pop();
      return next;
    });
  }

  function startEditing(existingIndex: number | null, structureId: string) {
    const hasUnsavedWork = activeRings.some((r) => r.length > 0);
    if (hasUnsavedWork && !window.confirm('Discard the shape in progress?')) return;

    if (existingIndex !== null) {
      setActiveHotspotIndex(existingIndex);
      setActiveRings(deepCopyRings(hotspots[existingIndex].polygons));
    } else {
      setActiveHotspotIndex(null);
      setActiveRings([[]]);
    }
    setSelectedStructureId(structureId);
  }

  function handleStructurePicked(structureId: string) {
    const existingIndex = hotspots.findIndex((h) => h.structureId === structureId);
    startEditing(existingIndex === -1 ? null : existingIndex, structureId);
  }

  function cancelActive() {
    setSelectedStructureId(null);
    setActiveHotspotIndex(null);
    setActiveRings([]);
  }

  function commitActive() {
    if (!selectedStructureId) return;
    const cleanRings = activeRings.filter((r) => r.length >= 3);
    if (cleanRings.length === 0) {
      window.alert('Add at least 3 vertices before saving.');
      return;
    }
    const entry: HotspotPolygon = {
      structureId: selectedStructureId,
      polygons: cleanRings,
      area: polygonSetArea(cleanRings),
      centroid: polygonSetCentroid(cleanRings),
    };
    const next = [...hotspots];
    if (activeHotspotIndex !== null) next[activeHotspotIndex] = entry;
    else next.push(entry);
    onChange(next);
    cancelActive();
  }

  function deleteActive() {
    if (activeHotspotIndex === null) return;
    onChange(hotspots.filter((_, i) => i !== activeHotspotIndex));
    cancelActive();
  }

  function addPart() {
    setActiveRings((prev) => [...prev, []]);
  }

  function handleStageClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (isSpaceDown || !stageRef.current) return;
    const point = normalizePointerEvent(e, stageRef.current);

    if (!selectedStructureId) {
      const candidates = hotspots.map((h) => ({ structureId: h.structureId, polygons: h.polygons, area: h.area }));
      const hit = hitTest(point, candidates);
      if (hit) {
        const idx = hotspots.findIndex((h) => h.structureId === hit.structureId);
        startEditing(idx, hit.structureId);
      }
      return;
    }

    setActiveRings((prev) => {
      const ringIdx = prev.length - 1;
      const ring = prev[ringIdx];
      if (ring.length >= 3) {
        const [fx, fy] = ring[0];
        const dist = Math.hypot(point[0] - fx, point[1] - fy);
        if (dist < CLOSE_RING_THRESHOLD / zoom) return prev; // proximity-close: stop accepting points on this ring
      }
      const next = prev.map((r) => r.slice());
      next[ringIdx] = [...next[ringIdx], point];
      return next;
    });
  }

  function handleStageContextMenu(e: ReactMouseEvent<HTMLDivElement>) {
    if (activeRings.length === 0) return;
    e.preventDefault();
    removeLastVertex();
  }

  function handleVertexPointerDown(e: ReactPointerEvent<SVGCircleElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.dataset.dragging = 'true';
  }

  function handleVertexPointerMove(e: ReactPointerEvent<SVGCircleElement>, ringIdx: number, vertexIdx: number) {
    if (e.currentTarget.dataset.dragging !== 'true' || !stageRef.current) return;
    const [x, y] = normalizePointerEvent(e, stageRef.current);
    setActiveRings((prev) => {
      const next = prev.map((r) => r.slice());
      next[ringIdx][vertexIdx] = [x, y];
      return next;
    });
  }

  function handleVertexPointerUp(e: ReactPointerEvent<SVGCircleElement>) {
    e.stopPropagation();
    delete e.currentTarget.dataset.dragging;
  }

  function handleViewportPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isSpaceDown) return;
    panDragRef.current = { startX: e.clientX, startY: e.clientY, origPan: pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleViewportPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = panDragRef.current;
    if (!d) return;
    setPan({ x: d.origPan.x + (e.clientX - d.startX), y: d.origPan.y + (e.clientY - d.startY) });
  }

  function handleViewportPointerUp() {
    panDragRef.current = null;
  }

  function handleWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))));
  }

  const otherHotspots = hotspots.filter((_, i) => i !== activeHotspotIndex);
  const warnings = useMemo(() => {
    if (!selectedStructureId) return [];
    return validateHotspot({ structureId: selectedStructureId, polygons: activeRings }, otherHotspots);
  }, [selectedStructureId, activeRings, otherHotspots]);

  const activeVertexCount = activeRings.reduce((sum, r) => sum + r.length, 0);
  const activeArea = polygonSetArea(activeRings);

  return (
    <div className="flex h-full gap-4">
      <div className="flex-1">
        <div
          className="relative overflow-hidden rounded-[3px]"
          style={{ height: VIEWPORT_HEIGHT, background: '#1a1a1a', cursor: isSpaceDown ? 'grab' : 'default' }}
          onWheel={handleWheel}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
        >
          <div
            ref={stageRef}
            onClick={handleStageClick}
            onContextMenu={handleStageContextMenu}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: VIEWPORT_HEIGHT,
              aspectRatio: naturalSize ? `${naturalSize.width} / ${naturalSize.height}` : '1 / 1',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              cursor: selectedStructureId && !isSpaceDown ? 'crosshair' : undefined,
            }}
          >
            <img
              src={image.filePath}
              alt={image.slideTitle ?? image.id}
              draggable={false}
              onLoad={(e) => setNaturalSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
              style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill' }}
            />

            {otherHotspots.map((h) => (
              <HotspotOverlay key={h.structureId} hotspots={otherHotspots} highlightStructureId={h.structureId} />
            ))}

            {selectedStructureId && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
                {activeRings.map((ring, ringIdx) => (
                  <g key={ringIdx}>
                    {ring.length >= 2 && (
                      <polyline
                        points={ring.map(([x, y]) => `${x},${y}`).join(' ')}
                        className="fill-none stroke-sky-400"
                        strokeWidth={0.0025}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {ring.length >= 3 && (
                      <polygon
                        points={ring.map(([x, y]) => `${x},${y}`).join(' ')}
                        className="fill-sky-400/25 stroke-none"
                      />
                    )}
                    {ring.map(([x, y], vertexIdx) => (
                      <circle
                        key={vertexIdx}
                        cx={x}
                        cy={y}
                        r={0.007}
                        className="pointer-events-auto fill-sky-400 stroke-white"
                        strokeWidth={0.0018}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: 'move' }}
                        onPointerDown={handleVertexPointerDown}
                        onPointerMove={(e) => handleVertexPointerMove(e, ringIdx, vertexIdx)}
                        onPointerUp={handleVertexPointerUp}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ))}
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink3)' }}>
          <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.5).toFixed(2)))} className="rounded-[3px] border px-2 py-1" style={{ borderColor: 'var(--line)' }}>
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.5).toFixed(2)))} className="rounded-[3px] border px-2 py-1" style={{ borderColor: 'var(--line)' }}>
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="rounded-[3px] border px-2 py-1"
            style={{ borderColor: 'var(--line)' }}
          >
            Reset view
          </button>
          <span>Hold Space + drag to pan · scroll to zoom · right-click/Backspace to undo a vertex</span>
        </div>
      </div>

      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div>
          <div className="mb-1 text-[12px] font-medium" style={{ color: 'var(--ink2)' }}>
            Structure
          </div>
          <StructureSelect
            structures={structures}
            imageRegion={image.region}
            value={selectedStructureId}
            onChange={handleStructurePicked}
          />
        </div>

        {selectedStructureId && (
          <div className="rounded-[3px] border p-2.5 text-[12.5px]" style={{ borderColor: 'var(--line)' }}>
            <div style={{ color: 'var(--ink2)' }}>
              {activeHotspotIndex !== null ? 'Editing' : 'New'}: <strong>{selectedStructureId}</strong>
            </div>
            <div style={{ color: 'var(--ink3)' }}>
              {activeRings.length} part(s), {activeVertexCount} vertices, area {activeArea.toFixed(4)}
            </div>
            {warnings.length > 0 && (
              <ul className="mt-1.5 list-disc pl-4" style={{ color: 'var(--acc2d)' }}>
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={addPart} className="rounded-[3px] border px-2 py-1" style={{ borderColor: 'var(--line)' }}>
                Add part
              </button>
              <button type="button" onClick={commitActive} className="rounded-[3px] px-2 py-1" style={{ background: 'var(--acc)', color: 'var(--onacc)' }}>
                Finish & save
              </button>
              {activeHotspotIndex !== null && (
                <button type="button" onClick={deleteActive} className="rounded-[3px] px-2 py-1" style={{ background: 'var(--acc2s)', color: 'var(--acc2d)' }}>
                  Delete
                </button>
              )}
              <button type="button" onClick={cancelActive} className="rounded-[3px] border px-2 py-1" style={{ borderColor: 'var(--line)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 text-[12px] font-medium" style={{ color: 'var(--ink2)' }}>
            Existing polygons ({hotspots.length})
          </div>
          <ul className="flex flex-col gap-1">
            {hotspots.map((h, idx) => (
              <li key={h.structureId}>
                <button
                  type="button"
                  onClick={() => startEditing(idx, h.structureId)}
                  className="w-full truncate rounded-[3px] border px-2 py-1 text-left text-[12px]"
                  style={{
                    borderColor: 'var(--line)',
                    background: idx === activeHotspotIndex ? 'var(--accs)' : 'transparent',
                    color: 'var(--ink2)',
                  }}
                >
                  {h.structureId} — area {h.area.toFixed(3)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
