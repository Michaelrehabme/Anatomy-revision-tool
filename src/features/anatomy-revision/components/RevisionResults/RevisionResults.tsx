import type { RevisionSessionSummary } from '../../types/attempt';
import type { AnatomyStructure } from '../../types/structure';
import { isMuscle } from '../../types/structure';
import { REGION_LABELS } from '../../types/region';
import { Button } from '../shared/Button';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

interface RevisionResultsProps {
  summary: RevisionSessionSummary;
  structuresById: Map<string, AnatomyStructure>;
  streak: number;
  onRetryIncorrect: () => void;
  onRestart: () => void;
  onOpenMuscle: (structureId: string) => void;
  onNavigate: (section: NavSection) => void;
}

function formatDuration(startedAt: string, finishedAt?: string): string {
  if (!finishedAt) return '';
  const seconds = Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins} min ${secs} s`;
}

export function RevisionResults({
  summary,
  structuresById,
  streak,
  onRetryIncorrect,
  onRestart,
  onOpenMuscle,
  onNavigate,
}: RevisionResultsProps) {
  const missedStructures = summary.missedStructureIds
    .map((id) => structuresById.get(id))
    .filter((s): s is AnatomyStructure => !!s);

  const regionEntries = Object.entries(summary.breakdownByRegion) as [string, { total: number; correct: number }][];
  const duration = formatDuration(summary.startedAt, summary.finishedAt);
  const perQuestion =
    summary.finishedAt && summary.totalQuestions > 0
      ? Math.round((Date.parse(summary.finishedAt) - Date.parse(summary.startedAt)) / 1000 / summary.totalQuestions)
      : null;

  return (
    <AppShell
      sidebar={
        <NavSidebar
          active="study"
          onNavigate={onNavigate}
          footer={<div style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--acc2d)' }}>{streak}-day streak</div>}
        />
      }
    >
      <div className="flex gap-[88px] px-16 pt-[72px] pb-12">
        <div className="w-[400px] flex-none">
          <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            Session complete
          </div>
          <div className="mt-5 flex items-baseline gap-3.5">
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 130, lineHeight: 0.82, letterSpacing: '-.05em' }}>
              {summary.correctCount}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, color: 'var(--ink3)' }}>/ {summary.totalQuestions}</span>
          </div>

          <div className="mt-10 flex flex-col gap-3">
            {missedStructures.length > 0 && (
              <Button onClick={onRetryIncorrect} className="min-h-[56px] w-full">
                Retry the {missedStructures.length} missed
              </Button>
            )}
            <Button variant="secondary" onClick={onRestart} className="min-h-[52px] w-full">
              Back to Today
            </Button>
          </div>

          {(duration || perQuestion !== null) && (
            <div className="mt-11" style={{ font: '400 13px/1.9 var(--font-mono)', color: 'var(--ink3)' }}>
              {duration}
              {duration && perQuestion !== null ? ' · ' : ''}
              {perQuestion !== null ? `${perQuestion}s per question` : ''}
            </div>
          )}
        </div>

        <div className="flex-1">
          {missedStructures.length > 0 && (
            <>
              <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                Missed
              </div>
              <div className="mt-4.5 flex flex-col">
                {missedStructures.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpenMuscle(s.id)}
                    className="flex items-baseline gap-5 py-4.5 text-left hover:opacity-70"
                  >
                    <span className="w-[200px] flex-none" style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>
                      {s.name}
                    </span>
                    <span className="flex-1 text-[15px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
                      {isMuscle(s) ? s.actionText : s.description}
                    </span>
                    <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                      {REGION_LABELS[s.region]}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {regionEntries.length > 0 && (
            <>
              <div
                className="mt-12"
                style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
              >
                By region this session
              </div>
              <div className="mt-5 flex max-w-[520px] flex-col gap-4.5">
                {regionEntries.map(([region, v]) => {
                  const pct = v.total > 0 ? (v.correct / v.total) * 100 : 0;
                  const good = v.correct === v.total;
                  return (
                    <div key={region}>
                      <div className="flex items-baseline gap-3">
                        <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>
                          {REGION_LABELS[region as keyof typeof REGION_LABELS] ?? region}
                        </span>
                        <span style={{ font: '500 12.5px/1 var(--font-mono)', color: good ? 'var(--accd)' : 'var(--acc2d)' }}>
                          {v.correct} / {v.total}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5" style={{ background: 'var(--line)' }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: good ? 'var(--acc)' : 'var(--acc2)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
