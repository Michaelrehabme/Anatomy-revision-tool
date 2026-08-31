import { useMemo, useState } from 'react';
import type { AnatomyStructure } from '../../anatomy-revision/types/structure';
import type { Region } from '../../anatomy-revision/types/region';

interface StructureSelectProps {
  structures: AnatomyStructure[];
  imageRegion: Region;
  value: string | null;
  onChange: (structureId: string) => void;
}

/** Searchable structure dropdown, defaulting to the image's own region with a "show all" escape hatch — per CR-007. */
export function StructureSelect({ structures, imageRegion, value, onChange }: StructureSelectProps) {
  const [query, setQuery] = useState('');
  const [showAllRegions, setShowAllRegions] = useState(false);

  const filtered = useMemo(() => {
    const scoped = showAllRegions ? structures : structures.filter((s) => s.region === imageRegion);
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [structures, imageRegion, showAllRegions, query]);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search structures…"
        className="rounded-[3px] border px-2.5 py-1.5 text-[13px]"
        style={{ borderColor: 'var(--line)', background: 'var(--sf)', color: 'var(--ink)' }}
      />
      <label className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink3)' }}>
        <input type="checkbox" checked={showAllRegions} onChange={(e) => setShowAllRegions(e.target.checked)} />
        Show all regions
      </label>
      <select
        size={6}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[3px] border text-[13px]"
        style={{ borderColor: 'var(--line)', background: 'var(--sf)', color: 'var(--ink)' }}
      >
        {filtered.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.id})
          </option>
        ))}
      </select>
    </div>
  );
}
