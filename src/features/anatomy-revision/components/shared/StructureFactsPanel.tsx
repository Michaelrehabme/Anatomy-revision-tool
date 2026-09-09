import type { AnatomyStructure } from '../../types/structure';
import { describeStructure } from '../../lib/facts';
import { PronounceButton } from './PronounceButton';

export function StructureFactsPanel({ structure }: { structure: AnatomyStructure }) {
  const lines = describeStructure(structure);

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-center gap-1.5">
        <h3 className="text-lg font-semibold text-ink">{structure.name}</h3>
        <PronounceButton structure={structure} size={16} />
      </div>
      {structure.phoneticSpelling && <p className="text-sm text-ink3">{structure.phoneticSpelling}</p>}
      {structure.latin && <p className="text-sm italic text-ink3">{structure.latin}</p>}
      <p className="mt-2 text-sm text-ink2">{structure.description}</p>
      <dl className="mt-3 space-y-1 text-sm text-ink2">
        {lines.map((line) => {
          const [label, ...rest] = line.split(': ');
          return (
            <div key={label} className="flex gap-2">
              <dt className="shrink-0 font-medium text-ink3">{label}:</dt>
              <dd>{rest.join(': ')}</dd>
            </div>
          );
        })}
      </dl>
      {structure.aliases.length > 0 && (
        <p className="mt-3 text-xs text-ink3">Also known as: {structure.aliases.join(', ')}</p>
      )}
    </div>
  );
}
