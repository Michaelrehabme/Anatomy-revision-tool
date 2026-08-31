import { useEffect, useState } from 'react';
import { ACHIEVEMENT_DEFINITIONS, type AchievementDoc, type AchievementDefinition } from '../../lib/achievements';
import type { AnatomyRepository } from '../../data/repository';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

interface AchievementsProps {
  repository: AnatomyRepository | null;
  userId: string | null;
  onNavigate: (section: NavSection) => void;
}

function formatRecordValue(def: AchievementDefinition, value: number): string {
  if (def.id === 'record-fastest-correct-answer-ms') return `${(value / 1000).toFixed(1)}s`;
  if (def.id === 'record-longest-streak') return `${value} day${value === 1 ? '' : 's'}`;
  return `${Math.round(value)}`;
}

function AchievementRow({ def, doc }: { def: AchievementDefinition; doc?: AchievementDoc }) {
  const earned = !!doc;
  return (
    <div
      className="flex items-center justify-between gap-4 py-4"
      style={{ borderBottom: '1px solid var(--line)', opacity: earned ? 1 : 0.45 }}
    >
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>{def.title}</div>
        <div className="mt-1 text-[13.5px]" style={{ color: 'var(--ink3)' }}>
          {def.description}
        </div>
      </div>
      <div className="flex-none text-right">
        {earned && doc.value !== undefined && (
          <div style={{ font: '500 15px/1 var(--font-mono)', color: 'var(--accd)' }}>{formatRecordValue(def, doc.value)}</div>
        )}
        <div style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>
          {earned ? new Date(doc.earnedAt).toLocaleDateString() : 'Not yet earned'}
        </div>
      </div>
    </div>
  );
}

/** Desktop achievements screen — reached from Progress, not a persistent nav tab (keeps the 4-item NavSidebar/MobileTabBar untouched). */
export function Achievements({ repository, userId, onNavigate }: AchievementsProps) {
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
    <AppShell sidebar={<NavSidebar active="progress" onNavigate={onNavigate} />}>
      <div className="px-16 pt-[72px] pb-12">
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.02, letterSpacing: '-.026em', margin: '0 0 12px' }}>
          Achievements
        </h2>
        <p className="text-base" style={{ color: 'var(--ink2)' }}>
          {achievements.length} of {ACHIEVEMENT_DEFINITIONS.length} earned
        </p>

        <div className="mt-13 flex gap-[88px]">
          <div className="w-[460px] flex-none">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Personal records
            </div>
            <div className="mt-2 flex flex-col">
              {records.map((def) => (
                <AchievementRow key={def.id} def={def} doc={byId.get(def.id)} />
              ))}
            </div>
          </div>

          <div className="w-[460px] flex-none">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Milestones
            </div>
            <div className="mt-2 flex flex-col">
              {milestones.map((def) => (
                <AchievementRow key={def.id} def={def} doc={byId.get(def.id)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
