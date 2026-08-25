import { useEffect, useMemo, useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { StructureMastery } from '../../types/attempt';
import { isMuscle } from '../../types/structure';
import { REGIONS, REGION_LABELS } from '../../types/region';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import { Button } from '../shared/Button';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import type { RevisionQuestion } from '../../types/question';
import { computeStreak } from '../../lib/streak';

interface ProgressProps {
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onNavigate: (section: NavSection) => void;
}

const FORECAST_DAYS = 14;

export function Progress({ content, repository, userId, onStart, onNavigate }: ProgressProps) {
  const [mastery, setMastery] = useState<StructureMastery[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    Promise.all([repository.listMastery(userId), repository.listSessionSummaries(userId, 60)]).then(
      ([m, summaries]) => {
        if (cancelled) return;
        setMastery(m);
        setStreak(computeStreak(summaries));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  const muscles = useMemo(() => content.structures.filter(isMuscle), [content.structures]);
  const masteryByStructureId = useMemo(() => new Map(mastery.map((m) => [m.structureId, m])), [mastery]);
  const seenIds = new Set(mastery.map((m) => m.structureId));
  const seenCount = muscles.filter((m) => seenIds.has(m.id)).length;
  const untouched = muscles.filter((m) => !seenIds.has(m.id));

  const byRegion = REGIONS.map((region) => {
    const regionMuscles = muscles.filter((m) => m.region === region);
    const seen = regionMuscles.filter((m) => {
      const row = masteryByStructureId.get(m.id);
      return row && row.attemptsCorrect / Math.max(1, row.attemptsTotal) >= 0.01; // seen at all
    });
    const correct = regionMuscles.reduce((sum, m) => {
      const row = masteryByStructureId.get(m.id);
      return sum + (row ? row.attemptsCorrect / Math.max(1, row.attemptsTotal) : 0);
    }, 0);
    const pct = regionMuscles.length > 0 ? Math.round((correct / regionMuscles.length) * 100) : 0;
    return { region, total: regionMuscles.length, seenCount: seen.length, pct };
  })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.pct - a.pct);

  const now = new Date();
  const forecast = Array.from({ length: FORECAST_DAYS }, (_, i) => {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    return mastery.filter((m) => m.dueAt?.slice(0, 10) === key).length;
  });
  const forecastMax = Math.max(1, ...forecast);

  const handleDrillUntouched = () => {
    const questions = generateRevisionSet(content.structures, content.images, {
      types: ['flashcard', 'mcq'],
      mode: 'practice',
      structureIds: untouched.map((m) => m.id),
    });
    onStart(questions, { types: ['flashcard', 'mcq'], mode: 'practice' });
  };

  return (
    <AppShell
      sidebar={
        <NavSidebar
          active="progress"
          onNavigate={onNavigate}
          footer={<div style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--acc2d)' }}>{streak}-day streak</div>}
        />
      }
    >
      <div className="px-16 pt-[72px] pb-12">
        <h2
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.02, letterSpacing: '-.026em', margin: '0 0 12px' }}
        >
          Progress
        </h2>
        <p className="text-base" style={{ color: 'var(--ink2)' }}>
          {muscles.length} muscles · {seenCount} seen at least once · {untouched.length} still untouched
        </p>

        <div className="mt-13 flex gap-[88px]">
          <div className="flex-1">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              By region
            </div>
            <div className="mt-5.5 flex flex-col gap-6.5">
              {byRegion.map(({ region, total, seenCount: rSeen, pct }) => (
                <div key={region}>
                  <div className="flex items-baseline gap-3.5">
                    <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 23 }}>
                      {REGION_LABELS[region]}
                    </span>
                    <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                      {rSeen} / {total}
                    </span>
                    <span
                      style={{
                        font: '500 13.5px/1 var(--font-mono)',
                        color: pct < 60 ? 'var(--acc2d)' : 'var(--accd)',
                        minWidth: 40,
                        textAlign: 'right',
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-2.5 h-2" style={{ background: 'var(--line)' }}>
                    <div className="h-full" style={{ width: `${pct}%`, background: pct < 60 ? 'var(--acc2)' : 'var(--acc)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-[460px] flex-none">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Due over the next fortnight
            </div>
            <div className="mt-5.5 flex h-[180px] items-end gap-2.5">
              {forecast.map((count, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ height: `${Math.max(4, (count / forecastMax) * 100)}%`, background: i === 0 ? 'var(--accd)' : count > 0 ? 'var(--acc)' : 'var(--accs)' }}
                />
              ))}
            </div>
            <div className="mt-2.5 flex justify-between">
              <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>today</span>
              <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>+7</span>
              <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>+14</span>
            </div>

            <div
              className="mt-13"
              style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
            >
              Untouched
            </div>
            <p className="mt-3.5 text-base leading-relaxed" style={{ color: 'var(--ink2)' }}>
              {untouched.length > 0
                ? `${untouched.length} muscles have never come up. Worth a dedicated session.`
                : 'Every muscle has come up at least once.'}
            </p>
            {untouched.length > 0 && (
              <Button variant="secondary" onClick={handleDrillUntouched} className="mt-5 min-h-[52px] px-6">
                Drill the untouched {untouched.length}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
