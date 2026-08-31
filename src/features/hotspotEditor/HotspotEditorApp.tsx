import { useEffect, useMemo, useState } from 'react';
import { ALL_IMAGES, ALL_STRUCTURES } from '../anatomy-revision/data/seed';
import type { HotspotPolygon } from '../anatomy-revision/types/image';
import { ImagePicker } from './components/ImagePicker';
import { CanvasEditor } from './components/CanvasEditor';
import { loadDrafts, saveDrafts, type DraftsByImageId } from './lib/draftStore';
import { buildHotspotsFile } from './lib/exportHotspots';

const structuresById = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

/**
 * Dev-only hotspot authoring tool (CR-007) — never routed to in production,
 * see App.tsx's `import.meta.env.DEV` route guard. Authoring state lives in
 * localStorage only; it is never written back into images.seed.ts
 * automatically (that stays a hand-paste step via the "Copy JSON" export +
 * scripts/importHotspots.ts, matching how the Blender pipeline output was
 * always meant to be ingested).
 */
export default function HotspotEditorApp() {
  const [drafts, setDrafts] = useState<DraftsByImageId>({});
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    const loaded = loadDrafts();
    // Seed drafts from the existing seed data for any image not yet touched
    // this session, so pre-existing hotspots (once any exist) are editable.
    const seeded: DraftsByImageId = { ...loaded };
    for (const image of ALL_IMAGES) {
      if (!seeded[image.id] && image.hotspots?.length) seeded[image.id] = image.hotspots;
    }
    setDrafts(seeded);
  }, []);

  const selectedImage = useMemo(() => ALL_IMAGES.find((img) => img.id === selectedImageId) ?? null, [selectedImageId]);

  function updateHotspots(imageId: string, next: HotspotPolygon[]) {
    setDrafts((prev) => {
      const updated = { ...prev, [imageId]: next };
      saveDrafts(updated);
      return updated;
    });
  }

  async function handleCopyJson() {
    const file = buildHotspotsFile(drafts, structuresById);
    await navigator.clipboard.writeText(JSON.stringify(file, null, 2));
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  }

  const totalAuthored = Object.values(drafts).reduce((sum, list) => sum + list.length, 0);

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      <header className="flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Hotspot authoring (dev only)</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--ink3)' }}>
            {totalAuthored} polygon(s) authored across {Object.keys(drafts).filter((id) => drafts[id]?.length).length} image(s) this session.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyJson}
          className="rounded-[3px] px-4 py-2 text-[13px] font-medium"
          style={{ background: 'var(--acc)', color: 'var(--onacc)' }}
        >
          {copyStatus === 'copied' ? 'Copied!' : 'Copy JSON'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 border-r p-3" style={{ borderColor: 'var(--line)' }}>
          <ImagePicker images={ALL_IMAGES} drafts={drafts} selectedImageId={selectedImageId} onSelect={setSelectedImageId} />
        </div>
        <div className="flex-1 overflow-auto p-4">
          {selectedImage ? (
            <CanvasEditor
              key={selectedImage.id}
              image={selectedImage}
              hotspots={drafts[selectedImage.id] ?? []}
              structures={ALL_STRUCTURES}
              onChange={(next) => updateHotspots(selectedImage.id, next)}
            />
          ) : (
            <p style={{ color: 'var(--ink3)' }}>Pick an image from the left to start authoring hotspots.</p>
          )}
        </div>
      </div>
    </div>
  );
}
