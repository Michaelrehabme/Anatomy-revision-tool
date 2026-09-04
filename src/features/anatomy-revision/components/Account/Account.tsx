import { useEffect, useState } from 'react';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import { AuthScreen } from '../Auth/AuthScreen';
import { CohortMembership } from '../shared/CohortMembership';
import { AccuracyTrendChart } from '../shared/AccuracyTrendChart';
import { MyClasses } from './MyClasses';
import { useAuth, AUTH_ENABLED } from '../../context/AuthProvider';
import { useProgressData } from '../../hooks/useProgressData';
import { accuracyTrend, accuracyDeltaByAttempts, type AccuracyTrendPoint } from '../../lib/accuracyTrend';
import type { UserAttempt } from '../../types/attempt';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';

const ATTEMPT_LIMIT = 5000;

const heading = {
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 22,
  letterSpacing: '-.01em',
  margin: 0,
} as const;

const statLabel = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[4px] px-4 py-3" style={{ background: 'var(--sf)', border: '1px solid var(--line)', minWidth: 150 }}>
      <div style={statLabel}>{label}</div>
      <div className="mt-1.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, letterSpacing: '-.01em' }}>
        {value}
      </div>
    </div>
  );
}

interface AccountProps {
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onNavigate: (section: NavSection) => void;
}

/**
 * The account screen: who you are, how you're doing, the class you're in, and
 * the classes you teach.
 *
 * Teaching lives here because it isn't a role anyone grants — anyone can
 * create a class and own it — so it belongs with the rest of "your account"
 * rather than behind a door most people would never think to try.
 *
 * The accuracy chart is the same component an educator sees about a student,
 * minus the class-average line: a student cannot read their classmates'
 * attempts (firestore.rules), so that comparison is genuinely not theirs.
 */
export function Account({ content, repository, userId, onNavigate }: AccountProps) {
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
  // No cohort series: the second argument is the class's attempts, which a student can't read.
  const trend: AccuracyTrendPoint[] = accuracyTrend(answered, []);
  const delta = accuracyDeltaByAttempts(answered);

  return (
    <AppShell
      sidebar={
        <NavSidebar
          active="account"
          onNavigate={onNavigate}
          footer={<div style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--acc2d)' }}>{streak}-day streak</div>}
        />
      }
    >
      <div className="px-16 pt-[72px] pb-12">
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.02, letterSpacing: '-.026em', margin: '0 0 12px' }}>
          Account
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink2)', maxWidth: 620 }}>
          {user?.displayName ?? user?.email ?? 'Signed in'}
          {user?.isAnonymous && ' — this device only, until you create an account.'}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Stat label="Attempts" value={String(answered.length)} />
          <Stat label="Accuracy" value={accuracyPct !== null ? `${accuracyPct}%` : '—'} />
          <Stat label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
          <Stat label="Structures seen" value={`${seenCount} / ${muscles.length}`} />
        </div>

        <section className="mt-12">
          <h3 style={heading}>
            Accuracy over time
            {delta && (
              <span className="ml-3" style={{ font: '500 13px/1 var(--font-mono)', color: delta.deltaPts >= 0 ? 'var(--accd)' : 'var(--acc2d)' }}>
                {delta.deltaPts >= 0 ? '+' : ''}
                {delta.deltaPts} pts
                <span style={{ color: 'var(--ink3)' }}>
                  {' '}
                  · first {delta.sliceSize} attempts {delta.firstPct}% → last {delta.sliceSize} {delta.lastPct}%
                </span>
              </span>
            )}
          </h3>
          <AccuracyTrendChart points={trend} studentName="You" />
        </section>

        {AUTH_ENABLED && user && (
          <section className="mt-12" style={{ maxWidth: 620 }}>
            <h3 style={heading}>Classes</h3>
            <CohortMembership uid={user.uid} />
            <MyClasses uid={user.uid} />

            <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
              {user.isAnonymous ? (
                <button
                  type="button"
                  onClick={() => setShowAuthScreen(true)}
                  className="rounded-[3px] px-3.5 py-2"
                  style={{ font: '500 13.5px/1 var(--font-ui)', background: 'var(--accs)', color: 'var(--accd)' }}
                >
                  Create account
                </button>
              ) : (
                <button type="button" onClick={() => signOut()} style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--ink3)' }}>
                  Sign out
                </button>
              )}
            </div>
          </section>
        )}

        {showAuthScreen && <AuthScreen onClose={() => setShowAuthScreen(false)} />}
      </div>
    </AppShell>
  );
}
