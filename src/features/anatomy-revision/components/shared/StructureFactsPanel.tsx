import type { AnatomyStructure } from '../../types/structure';
import { describeStructure } from '../../lib/facts';

export function StructureFactsPanel({ structure }: { structure: AnatomyStructure }) {
  const lines = describeStructure(structure);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-900">{structure.name}</h3>
      {structure.latin && <p className="text-sm italic text-slate-500">{structure.latin}</p>}
      <p className="mt-2 text-sm text-slate-700">{structure.description}</p>
      <dl className="mt-3 space-y-1 text-sm text-slate-600">
        {lines.map((line) => {
          const [label, ...rest] = line.split(': ');
          return (
            <div key={label} className="flex gap-2">
              <dt className="shrink-0 font-medium text-slate-500">{label}:</dt>
              <dd>{rest.join(': ')}</dd>
            </div>
          );
        })}
      </dl>
      {structure.aliases.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">Also known as: {structure.aliases.join(', ')}</p>
      )}
    </div>
  );
}
