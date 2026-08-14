import type { RevisionSessionSummary } from '../../types/attempt';
import type { AnatomyStructure } from '../../types/structure';
import { REGION_LABELS } from '../../types/region';
import { StructureFactsPanel } from '../shared/StructureFactsPanel';

interface RevisionResultsProps {
  summary: RevisionSessionSummary;
  structuresById: Map<string, AnatomyStructure>;
  onRetryIncorrect: () => void;
  onRestart: () => void;
}

const CATEGORY_LABELS: Record<string, string> = { muscle: 'Muscles', bone: 'Bones', landmark: 'Landmarks' };

export function RevisionResults({ summary, structuresById, onRetryIncorrect, onRestart }: RevisionResultsProps) {
  const scorePct =
    summary.totalQuestions === 0 ? 0 : Math.round((summary.correctCount / summary.totalQuestions) * 100);
  const missedStructures = summary.missedStructureIds
    .map((id) => structuresById.get(id))
    .filter((s): s is AnatomyStructure => !!s);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="text-center">
        <p className="text-sm font-medium text-slate-500">Session complete</p>
        <p className="mt-1 text-5xl font-bold text-slate-900">{scorePct}%</p>
        <p className="mt-1 text-sm text-slate-600">
          {summary.correctCount} of {summary.totalQuestions} correct
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">By category</h2>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(summary.breakdownByCategory)
            .filter(([, v]) => v.total > 0)
            .map(([category, v]) => (
              <div key={category} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <p className="text-xs text-slate-500">{CATEGORY_LABELS[category] ?? category}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {v.correct}/{v.total}
                </p>
              </div>
            ))}
        </div>
      </section>

      {Object.keys(summary.breakdownByRegion).length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">By region</h2>
          <div className="space-y-1">
            {Object.entries(summary.breakdownByRegion).map(([region, v]) => (
              <div key={region} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">{REGION_LABELS[region as keyof typeof REGION_LABELS] ?? region}</span>
                <span className="font-medium text-slate-900">
                  {v?.correct}/{v?.total}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {missedStructures.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Missed structures</h2>
          <div className="space-y-3">
            {missedStructures.map((s) => (
              <StructureFactsPanel key={s.id} structure={s} />
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        {missedStructures.length > 0 && (
          <button
            type="button"
            onClick={onRetryIncorrect}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Retry missed structures
          </button>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          New session
        </button>
      </div>
    </div>
  );
}
