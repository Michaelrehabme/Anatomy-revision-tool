import { useState } from 'react';
import { StructureWeaknessScreen } from './StructureWeaknessScreen';
import { DistractorAnalysisScreen } from './DistractorAnalysisScreen';
import { QuestionHealthPanel } from './QuestionHealthPanel';
import { CohortOverviewScreen } from './CohortOverviewScreen';

type Tab = 'weakness' | 'distractors' | 'health' | 'cohort';

const TABS: { key: Tab; label: string }[] = [
  { key: 'weakness', label: 'Structure weakness' },
  { key: 'distractors', label: 'Distractor analysis' },
  { key: 'health', label: 'Question health' },
  { key: 'cohort', label: 'Cohort overview' },
];

/**
 * All four screens share one mount point, and each screen's hook reads from
 * the analyticsSource singleton (see data/analyticsSource.ts) — so switching
 * tabs here never re-queries attemptEvents; only the first tab ever visited
 * pays for the fetch.
 */
export function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('weakness');

  return (
    <div className="px-16 pt-16 pb-16">
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 40,
          lineHeight: 1.05,
          letterSpacing: '-.02em',
          margin: 0,
        }}
      >
        Analytics
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ink2)' }}>
        Cohort weakness analytics, aggregated from the most recent attempt data.
      </p>

      <div className="mt-8 flex gap-1 border-b" style={{ borderColor: 'var(--line)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5"
            style={{
              font: '500 13px/1 var(--font-ui)',
              color: tab === t.key ? 'var(--accd)' : 'var(--ink3)',
              borderBottom: tab === t.key ? '2px solid var(--acc)' : '2px solid transparent',
              marginBottom: -1,
              background: 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'weakness' && <StructureWeaknessScreen />}
        {tab === 'distractors' && <DistractorAnalysisScreen />}
        {tab === 'health' && <QuestionHealthPanel />}
        {tab === 'cohort' && <CohortOverviewScreen />}
      </div>
    </div>
  );
}
