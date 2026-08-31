import { useMemo, useRef, useState } from 'react';
import { ALL_IMAGES, ALL_STRUCTURES } from '../anatomy-revision/data/seed';
import type { AnatomyImageAsset, HotspotPolygon } from '../anatomy-revision/types/image';
import { normalizePointerEvent } from '../anatomy-revision/lib/hotspot/normalizeCoordinates';
import {
  polygonsArea,
  polygonsCentroid,
} from '../anatomy-revision/lib/hotspot/polygonGeometry';
import { HotspotOverlay } from '../anatomy-revision/components/LocateStructureSession/HotspotOverlay';

/** Distance in normalized units within which a click grabs an existing vertex. */
const GRAB_RADIUS = 0.012;

interface Draft {
  structureId: string;
  /** Closed rings. The ring currently being drawn lives in `pending`. */
  polygons: number[][][];
}

export function HotspotAuthoring() {
  const [imageId, setImageId] = useState(ALL_IMAGES[0].id);
  const image = ALL_IMAGES.find((img) => img.id === imageId)!;

  const [structureId, setStructureId] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pending, setPending] = useState<number[][]>([]);
  const [natural, setNatural] = useState<[number, number] | null>(null);
  const [dragging, setDragging] = useState<{ ring: number; index: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const draft = drafts.find((d) => d.structureId === structureId);

  const structures = useMemo(
    () => [...ALL_STRUCTURES].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  function loadImage(nextId: string) {
    const next = ALL_IMAGES.find((img) => img.id === nextId)!;
    setImageId(nextId);
    setNatural(null);
    setPending([]);
    setStructureId('');
    // Seed the draft from whatever the converter already produced, so this is
    // a correction surface rather than a blank page.
    setDrafts(
      (next.hotspots ?? []).map((h) => ({ structureId: h.structureId, polygons: h.polygons })),
    );
  }

  function updateDraft(polygons: number[][][]) {
    setDrafts((current) => {
      const rest = current.filter((d) => d.structureId !== structureId);
      return polygons.length > 0 ? [...rest, { structureId, polygons }] : rest;
    });
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!structureId || !wrapperRef.current) return;
    const point = normalizePointerEvent(event, wrapperRef.current);

    // Grabbing an existing vertex takes priority over adding a new one.
    if (draft) {
      for (let ring = 0; ring < draft.polygons.length; ring++) {
        for (let index = 0; index < draft.polygons[ring].length; index++) {
          const [vx, vy] = draft.polygons[ring][index];
          if (Math.hypot(vx - point[0], vy - point[1]) < GRAB_RADIUS) {
            if (dragging?.ring === ring && dragging.index === index) {
              const polygons = draft.polygons.map((r) => [...r]);
              polygons[ring][index] = point;
              updateDraft(polygons);
              setDragging(null);
            } else {
              setDragging({ ring, index });
            }
            return;
          }
        }
      }
    }

    setPending((current) => [...current, point]);
  }

  function closeRing() {
    if (pending.length < 3) return;
    updateDraft([...(draft?.polygons ?? []), pending]);
    setPending([]);
  }

  function undoVertex() {
    setPending((current) => current.slice(0, -1));
  }

  function clearStructure() {
    setPending([]);
    updateDraft([]);
  }

  const exported = useMemo(() => buildExport(image, drafts, natural), [image, drafts, natural]);
  const dimensionMismatch =
    natural && image.width && image.height && (natural[0] !== image.width || natural[1] !== image.height);

  const previewHotspots: HotspotPolygon[] = drafts.map((d) => ({
    structureId: d.structureId,
    polygons: d.polygons,
    area: polygonsArea(d.polygons),
    centroid: polygonsCentroid(d.polygons),
  }));

  return (
    <div className="mx-auto max-w-6xl p-6 text-sm">
      <h1 className="mb-1 text-xl font-semibold">Hotspot authoring</h1>
      <p className="mb-4 text-slate-500">
        Dev-only. Click to place vertices, close the ring, then copy the JSON into
        <code className="mx-1 rounded bg-slate-100 px-1">importHotspots.ts</code>.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex flex-col">
          <span className="text-xs uppercase text-slate-500">Image</span>
          <select className="rounded border px-2 py-1" value={imageId} onChange={(e) => loadImage(e.target.value)}>
            {ALL_IMAGES.map((img) => (
              <option key={img.id} value={img.id}>
                {img.hotspots?.length ? `● ${img.id}` : `○ ${img.id}`} ({img.region})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-xs uppercase text-slate-500">Structure</span>
          <select
            className="rounded border px-2 py-1"
            value={structureId}
            onChange={(e) => {
              setStructureId(e.target.value);
              setPending([]);
            }}
          >
            <option value="">— pick a structure —</option>
            {structures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.region})
              </option>
            ))}
          </select>
        </label>
      </div>

      {dimensionMismatch && (
        <p className="mb-3 rounded border border-rose-300 bg-rose-50 p-2 text-rose-700">
          Image is {natural![0]}×{natural![1]} but the seed says {image.width}×{image.height}. Every
          polygon authored here will be offset until that is fixed.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div>
          <div
            ref={wrapperRef}
            onClick={handleClick}
            className="relative w-full cursor-crosshair overflow-hidden rounded border bg-slate-100"
            style={natural ? { aspectRatio: `${natural[0]} / ${natural[1]}` } : undefined}
          >
            <img
              src={image.filePath}
              alt=""
              className="h-full w-full"
              onLoad={(e) => setNatural([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])}
            />
            {/* Non-target polygons render fully transparent in HotspotOverlay, so
                the structure being edited must be passed as the highlight. */}
            <HotspotOverlay hotspots={previewHotspots} highlightStructureId={structureId} />
            {pending.length > 0 && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
              >
                <polyline
                  points={pending.map(([x, y]) => `${x},${y}`).join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth={0.004}
                  vectorEffect="non-scaling-stroke"
                />
                {pending.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={0.006} fill="#f97316" />
                ))}
              </svg>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded border px-3 py-1" onClick={closeRing} disabled={pending.length < 3}>
              Close ring ({pending.length})
            </button>
            <button className="rounded border px-3 py-1" onClick={undoVertex} disabled={pending.length === 0}>
              Undo vertex
            </button>
            <button className="rounded border px-3 py-1" onClick={clearStructure} disabled={!structureId}>
              Clear structure
            </button>
            {dragging && <span className="self-center text-orange-600">Click a new spot to move the grabbed vertex</span>}
          </div>

          <p className="mt-2 text-slate-500">
            {natural ? `Natural size ${natural[0]}×${natural[1]}.` : 'Loading image…'}{' '}
            {draft
              ? `${draft.polygons.length} part(s), area ${polygonsArea(draft.polygons).toFixed(5)}.`
              : 'No polygon for this structure yet.'}
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-semibold">On this image ({drafts.length})</h2>
          <ul className="mb-4 space-y-1">
            {drafts.map((d) => (
              <li key={d.structureId} className={d.structureId === structureId ? 'font-semibold' : ''}>
                {d.structureId} — {d.polygons.length} part(s), {polygonsArea(d.polygons).toFixed(5)}
              </li>
            ))}
          </ul>

          <button
            className="mb-2 rounded border px-3 py-1"
            onClick={() => navigator.clipboard.writeText(exported)}
          >
            Copy JSON
          </button>
          <textarea className="h-64 w-full rounded border p-2 font-mono text-xs" readOnly value={exported} />
        </div>
      </div>
    </div>
  );
}

/** Emits the v2 importHotspots.ts shape so edits go back through the same path. */
function buildExport(
  image: AnatomyImageAsset,
  drafts: Draft[],
  natural: [number, number] | null,
): string {
  const hotspots: Record<string, unknown> = {};
  for (const draft of drafts) {
    if (draft.polygons.length === 0) continue;
    hotspots[draft.structureId] = {
      polygons: draft.polygons,
      area: polygonsArea(draft.polygons),
      centroid: polygonsCentroid(draft.polygons),
      points: draft.polygons.reduce((total, ring) => total + ring.length, 0),
    };
  }

  return JSON.stringify(
    {
      schemaVersion: 2,
      normalised: true,
      images: {
        [image.id]: {
          filePath: image.filePath,
          width: natural?.[0] ?? image.width ?? 0,
          height: natural?.[1] ?? image.height ?? 0,
          panelStructureNames: Object.keys(hotspots),
          hotspots,
        },
      },
    },
    null,
    2,
  );
}
