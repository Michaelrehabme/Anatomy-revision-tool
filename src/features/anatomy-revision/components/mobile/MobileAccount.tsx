import { useEffect, useState } from 'react';
import { MobileShell } from './MobileShell';
import { CohortMembership } from '../shared/CohortMembership';
import { AccuracyTrendChart } from '../shared/AccuracyTrendChart';
import { MyClasses } from '../Account/MyClasses';
import { AuthScreen } from '../Auth/AuthScreen';
import { Button } from '../shared/Button';
import { useAuth, AUTH_ENABLED } from '../../context/AuthProvider';
import { useProgressData } from '../../hooks/useProgressData';
import { accuracyTrend, accuracyDeltaByAttempts } from '../../lib/accuracyTrend';
import type { UserAttempt } from '../../types/attempt';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { MobileTab } from './MobileTabBar';

const ATTEMPT_LIMIT = 5000;

interface MobileAccountProps {
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onNavigateTab: (tab: MobileTab) => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-[4px] px-3.5 py-3" style={{ background: 'var(--sf)', border: '1px solid var(--line)', minWidth: 140 }}>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        {label}
      </div>
      <div className="mt-1.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, letterSpacing: '-.01em' }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Mobile counterpart to Account/Account.tsx — same four things (who you are,
 * how you're doing, the class you're in, the classes you teach) at the mobile
 * type scale, reusing the same chart and class components.
 *
 * It exists as a tab because creating a class had no mobile entry point at
 * all: the account bits were a strip at the bottom of Progress, which nobody
 * would think to scroll to in order to start teaching.
 */
export function MobileAccount({ content, repository, userId, onNavigateTab }: MobileAccountProps) {
  const { user, signOut } = useAuth();
  const { streak, seenCount, muscles } = useProgressData(repository, userId, content);
  const [attempts, setAttempts] = useState<UserAttempt[] | null>(null);
  const [showAuthScreen, setShowAuthScreen] = useState(false);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    repository
      .listAttempts({ userId, limit: ATTEMPT_LIMIT })
      .then((result) => {
        if (!cancelled) setAttempts(result);
      })
      .catch(() => {
        if (!cancelled) setAttempts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  const answered = attempts ?? [];
  const correct = answered.filter((a) => a.correct).length;
  const accuracyPct = answered.length > 0 ? Math.round((correct / answered.length) * 100) : null;
  // No cohort series: a student can't read their classmates' attempts (firestore.rules).
  const trend = accuracyTrend(answered, []);
  const delta = accuracyDeltaByAttempts(answered);

  return (
    <MobileShell tabs={{ active: 'account', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4.5 pb-7.5">
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 35, lineHeight: 1.04, letterSpacing: '-.022em', margin: 0 }}>
          Account
        </h2>
        <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
          {user?.displayName ?? user?.email ?? 'Signed in'}
          {user?.isAnonymous && ' — this device only, until you create an account.'}
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Stat label="Attempts" value={String(answered.length)} />
          <Stat label="Accuracy" value={accuracyPct !== null ? `${accuracyPct}%` : '—'} />
          <Stat label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
          <Stat label="Seen" value={`${seenCount} / ${muscles.length}`} />
        </div>

        <section className="mt-9">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
            Accuracy over time
          </h3>
          {delta && (
            <div className="mt-1.5" style={{ font: '500 12.5px/1.4 var(--font-mono)', color: delta.deltaPts >= 0 ? 'var(--accd)' : 'var(--acc2d)' }}>
              {delta.deltaPts >= 0 ? '+' : ''}
              {delta.deltaPts} pts
              <span style={{ color: 'var(--ink3)' }}>
                {' '}
                · first {delta.sliceSize} {delta.firstPct}% → last {delta.sliceSize} {delta.lastPct}%
              </span>
            </div>
          )}
          <AccuracyTrendChart points={trend} studentName="You" />
        </section>

        {AUTH_ENABLED && user && (
          <section className="mt-9">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
              Classes
            </h3>
            <CohortMembership uid={user.uid} compact />
            <MyClasses uid={user.uid} compact />

            <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
              {user.isAnonymous ? (
                <Button variant="secondary" onClick={() => setShowAuthScreen(true)} className="min-h-[46px] w-full">
                  Create account
                </Button>
              ) : (
                <button type="button" onClick={() => signOut()} className="min-h-[44px] text-[13.5px]" style={{ color: 'var(--ink3)' }}>
                  Sign out
                </button>
              )}
            </div>
          </section>
        )}

        {showAuthScreen && <AuthScreen onClose={() => setShowAuthScreen(false)} />}
      </div>
    </MobileShell>
  );
}
