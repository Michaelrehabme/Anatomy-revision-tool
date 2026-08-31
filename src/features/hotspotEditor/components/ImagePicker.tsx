import { useMemo, useState } from 'react';
import type { AnatomyImageAsset } from '../../anatomy-revision/types/image';
import type { DraftsByImageId } from '../lib/draftStore';

interface ImagePickerProps {
  images: AnatomyImageAsset[];
  drafts: DraftsByImageId;
  selectedImageId: string | null;
  onSelect: (imageId: string) => void;
}

/** Lists every seed image with its live authored-hotspot count, so progress across all 45 images is visible at a glance. */
export function ImagePicker({ images, drafts, selectedImageId, onSelect }: ImagePickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return images;
    return images.filter((img) => img.id.toLowerCase().includes(q) || img.slideTitle?.toLowerCase().includes(q));
  }, [images, query]);

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search images…"
        className="rounded-[3px] border px-2.5 py-1.5 text-[13px]"
        style={{ borderColor: 'var(--line)', background: 'var(--sf)', color: 'var(--ink)' }}
      />
      <div className="flex-1 overflow-y-auto">
        {filtered.map((img) => {
          const count = drafts[img.id]?.length ?? 0;
          const isSelected = img.id === selectedImageId;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => onSelect(img.id)}
              className="flex w-full items-center justify-between gap-2 border-b px-2.5 py-2 text-left text-[12.5px]"
              style={{
                borderColor: 'var(--line)',
                background: isSelected ? 'var(--accs)' : 'transparent',
                color: isSelected ? 'var(--accd)' : 'var(--ink2)',
              }}
            >
              <span className="truncate">{img.slideTitle ?? img.id}</span>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px]"
                style={{ background: count > 0 ? 'var(--accs)' : 'var(--line)', color: count > 0 ? 'var(--accd)' : 'var(--ink3)' }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
