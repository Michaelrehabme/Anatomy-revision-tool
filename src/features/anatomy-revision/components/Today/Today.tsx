import { useEffect, useState } from 'react';
import type { AnatomyRepository } from '../../data/repository';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { StructureMastery, RevisionSessionSummary } from '../../types/attempt';
import type { RevisionQuestion, QuestionType } from '../../types/question';
import { isMuscle } from '../../types/structure';
import { REGION_LABELS } from '../../types/region';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import { computeStreak } from '../../lib/streak';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import { Button } from '../shared/Button';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';

const DEFAULT_TYPES: QuestionType[] = ['flashcard', 'mcq', 'locate', 'identify-typed'];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface TodayProps {
  repository: AnatomyRepository | null;
  userId: string | null;
  content: AnatomyContent;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onCustomSession: () => void;
  onOpenMuscle: (structureId: string) => void;
  onNavigate: (section: NavSection) => void;
}

function relativeDue(dueAt: string, now: Date): string {
  const days = Math.round((Date.parse(dueAt) - now.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export function Today({ repository, userId, content, onStart, onCustomSession, onOpenMuscle, onNavigate }: TodayProps) {
  const [due, setDue] = useState<StructureMastery[]>([]);
  const [allMastery, setAllMastery] = useState<StructureMastery[]>([]);
  const [summaries, setSummaries] = useState<RevisionSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    const now = new Date().toISOString();
    Promise.all([
      repository.listDueMastery(userId, now),
      repository.listMastery(userId),
      repository.listSessionSummaries(userId, 30),
    ]).then(([dueMastery, mastery, sessions]) => {
      if (cancelled) return;
      setDue(dueMastery);
      setAllMastery(mastery);
      setSummaries(sessions);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  const streak = computeStreak(summaries);
  // Muscles only in this footer stat, matching the mockup's "122 muscles" framing —
  // content also includes bones/landmarks, which aren't part of this count.
  const muscleIds = new Set(content.structures.filter(isMuscle).map((s) => s.id));
  const totalCount = muscleIds.size;
  const seenCount = allMastery.filter((m) => muscleIds.has(m.structureId)).length;
  const seenPct = totalCount > 0 ? Math.round((seenCount / totalCount) * 100) : 0;
  const dueMuscles = due.filter((m) => muscleIds.has(m.structureId));

  // Weakest/coming-due stay muscle-scoped too — this whole screen frames
  // itself around the muscle atlas ("122 muscles"), even though the
  // underlying repository also tracks bones/landmarks.
  const weakest = [...allMastery]
    .filter((m) => m.attemptsTotal > 0 && muscleIds.has(m.structureId))
    .sort((a, b) => a.attemptsCorrect / a.attemptsTotal - b.attemptsCorrect / b.attemptsTotal)
    .slice(0, 5);

  const comingDue = [...allMastery]
    .filter((m) => m.dueAt && muscleIds.has(m.structureId) && !dueMuscles.some((d) => d.structureId === m.structureId))
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
    .slice(0, 3);

  const now = new Date();
  const weekBuckets = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (6 - i));
    const key = day.toISOString().slice(0, 10);
    return summaries.filter((s) => s.startedAt.slice(0, 10) === key).length;
  });
  const weekMax = Math.max(1, ...weekBuckets);

  const handleStart = () => {
    const structureIds = dueMuscles.map((m) => m.structureId);
    const questions = generateRevisionSet(content.structures, content.images, {
      types: DEFAULT_TYPES,
      mode: 'practice',
      structureIds: structureIds.length ? structureIds : undefined,
      count: 20,
    });
    onStart(questions, { types: DEFAULT_TYPES, mode: 'practice' });
  };

  return (
    <AppShell
      sidebar={
        <NavSidebar
          active="today"
          onNavigate={onNavigate}
          footer={
            <>
              <div style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--acc2d)' }}>
                {streak}-day streak
              </div>
              <div className="mt-1.5" style={{ font: '400 11.5px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
                {totalCount} muscles · {seenPct}% seen
              </div>
            </>
          }
        />
      }
    >
      <div className="flex gap-20 px-16 pt-16 pb-12">
        <div className="w-[440px] flex-none">
          <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h2
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 76, lineHeight: 0.98, letterSpacing: '-.032em', margin: '20px 0 0' }}
          >
            {loading ? '…' : dueMuscles.length} due
            <br />
            for review
          </h2>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--ink2)' }}>
            {dueMuscles.length > 0
              ? 'Scheduled from your recent sessions.'
              : 'Nothing scheduled — start a custom session or drill the untouched set.'}
          </p>
          <div className="mt-9 flex gap-3.5">
            <Button onClick={handleStart} className="min-w-[180px] min-h-[56px]">
              Start review
            </Button>
            <Button variant="secondary" onClick={onCustomSession} className="min-w-[150px] min-h-[56px]">
              Custom session
            </Button>
          </div>

          <div
            className="mt-14"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
          >
            This week
          </div>
          <div className="mt-5 flex h-[110px] items-end gap-3">
            {weekBuckets.map((count, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ height: `${Math.max(8, (count / weekMax) * 100)}%`, background: count > 0 ? 'var(--acc)' : 'var(--accs)' }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex gap-3">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="flex-1 text-center" style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                {d}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            Weakest structures
          </div>
          <div className="mt-4 flex flex-col">
            {weakest.length === 0 && (
              <p className="py-4 text-sm" style={{ color: 'var(--ink3)' }}>
                No attempts recorded yet — finish a session to see this fill in.
              </p>
            )}
            {weakest.map((m) => {
              const structure = content.structuresById.get(m.structureId);
              const pct = Math.round((m.attemptsCorrect / m.attemptsTotal) * 100);
              return (
                <button
                  key={m.structureId}
                  type="button"
                  onClick={() => onOpenMuscle(m.structureId)}
                  className="flex items-baseline gap-4 py-4 text-left hover:opacity-70"
                >
                  <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 23, color: 'var(--ink)' }}>
                    {structure?.name ?? m.structureId}
                  </span>
                  <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                    {structure ? REGION_LABELS[structure.region] : ''}
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
                </button>
              );
            })}
          </div>

          {comingDue.length > 0 && (
            <>
              <div
                className="mt-14"
                style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
              >
                Coming due
              </div>
              <div className="mt-4 flex flex-col">
                {comingDue.map((m) => {
                  const structure = content.structuresById.get(m.structureId);
                  return (
                    <div key={m.structureId} className="flex items-baseline gap-4 py-3">
                      <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink2)' }}>
                        {structure?.name ?? m.structureId}
                      </span>
                      <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                        {relativeDue(m.dueAt!, now)}
                      </span>
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
