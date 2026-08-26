import { useState } from 'react';
import { useStructureWeakness } from '../../hooks/useStructureWeakness';
import { STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT } from '../../lib/analyticsAggregation';
import type { AnalyticsFilters as AnalyticsFiltersState } from '../../types/analytics';
import { AnalyticsFilters } from './AnalyticsFilters';
import { StructureWeaknessTable } from './StructureWeaknessTable';

export function StructureWeaknessScreen() {
  const [filters, setFilters] = useState<AnalyticsFiltersState>({});
  const [minAttempts, setMinAttempts] = useState(STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT);
  const { rows, loading, error } = useStructureWeakness(filters, minAttempts);

  return (
    <div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--ink2)', maxWidth: 640 }}>
        Every structure, worst accuracy first. First-attempt accuracy below overall means students are learning it
        through repetition; first-attempt above overall means they knew it once and are now forgetting it — those
        call for different teaching responses.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <AnalyticsFilters filters={filters} onChange={setFilters} />
        <label className="flex items-center gap-2" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)' }}>
          Min attempts
          <input
            type="number"
            min={1}
            value={minAttempts}
            onChange={(e) => setMinAttempts(Math.max(1, Number(e.target.value) || 1))}
            className="w-16"
            style={{
              font: '500 12.5px/1 var(--font-mono)',
              color: 'var(--ink2)',
              background: 'var(--sf)',
              border: '1.2px solid var(--line)',
              borderRadius: 3,
              padding: '6px 8px',
            }}
          />
        </label>
      </div>

      {loading && (
        <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
          Loading attempt data…
        </div>
      )}
      {error && (
        <div className="mt-10 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}
      {!loading && !error && <StructureWeaknessTable rows={rows} />}
    </div>
  );
}
