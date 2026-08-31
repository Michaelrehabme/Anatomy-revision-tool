import { useEffect, useState } from 'react';
import { ACHIEVEMENT_DEFINITIONS, type AchievementDoc, type AchievementDefinition } from '../../lib/achievements';
import type { AnatomyRepository } from '../../data/repository';

interface MobileAchievementsProps {
  repository: AnatomyRepository | null;
  userId: string | null;
  onBack: () => void;
}

function formatRecordValue(def: AchievementDefinition, value: number): string {
  if (def.id === 'record-fastest-correct-answer-ms') return `${(value / 1000).toFixed(1)}s`;
  if (def.id === 'record-longest-streak') return `${value} day${value === 1 ? '' : 's'}`;
  return `${Math.round(value)}`;
}

function AchievementRow({ def, doc }: { def: AchievementDefinition; doc?: AchievementDoc }) {
  const earned = !!doc;
  return (
    <div className="flex items-center justify-between gap-3 py-3.5" style={{ borderBottom: '1px solid var(--line)', opacity: earned ? 1 : 0.45 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{def.title}</div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: 'var(--ink3)' }}>
          {def.description}
        </div>
      </div>
      <div className="flex-none text-right">
        {earned && doc.value !== undefined && (
          <div style={{ font: '500 13.5px/1 var(--font-mono)', color: 'var(--accd)' }}>{formatRecordValue(def, doc.value)}</div>
        )}
        <div style={{ font: '400 10px/1 var(--font-mono)', color: 'var(--ink3)' }}>
          {earned ? new Date(doc.earnedAt).toLocaleDateString() : 'Not yet'}
        </div>
      </div>
    </div>
  );
}

/** Reached from Progress's "View achievements" link — no tab bar, same back-navigation pattern as MobileMuscleCard. */
export function MobileAchievements({ repository, userId, onBack }: MobileAchievementsProps) {
  const [achievements, setAchievements] = useState<AchievementDoc[]>([]);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    repository.listAchievements(userId).then((docs) => {
      if (!cancelled) setAchievements(docs);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  const byId = new Map(achievements.map((a) => [a.id, a]));
  const records = ACHIEVEMENT_DEFINITIONS.filter((d) => d.tier === 'record');
  const milestones = ACHIEVEMENT_DEFINITIONS.filter((d) => d.tier === 'milestone');

  return (
    <div className="flex min-h-screen flex-col px-6.5 pt-4 pb-7.5" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      <button type="button" onClick={onBack} className="border-0 bg-transparent p-0 pb-2" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
        &larr; Back
      </button>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30, lineHeight: 1.04, letterSpacing: '-.02em', margin: '8px 0 4px' }}>
        Achievements
      </h2>
      <p className="text-[13.5px]" style={{ color: 'var(--ink2)' }}>
        {achievements.length} of {ACHIEVEMENT_DEFINITIONS.length} earned
      </p>

      <div className="mt-6" style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        Personal records
      </div>
      <div className="mt-1 flex flex-col">
        {records.map((def) => (
          <AchievementRow key={def.id} def={def} doc={byId.get(def.id)} />
        ))}
      </div>

      <div className="mt-7" style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        Milestones
      </div>
      <div className="mt-1 flex flex-col">
        {milestones.map((def) => (
          <AchievementRow key={def.id} def={def} doc={byId.get(def.id)} />
        ))}
      </div>
    </div>
  );
}
