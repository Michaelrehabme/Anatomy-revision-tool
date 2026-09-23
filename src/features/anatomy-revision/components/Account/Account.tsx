import { AccountDataControls } from '../shared/AccountDataControls';
import { useEffect, useState } from 'react';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import { AuthScreen } from '../Auth/AuthScreen';
import { CohortMembership } from '../shared/CohortMembership';
import { SubscriptionSummary } from '../shared/SubscriptionSummary';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { AccuracyTrendChart } from '../shared/AccuracyTrendChart';
import { MyClasses } from './MyClasses';
import { AdminSection } from './AdminSection';
import { useAuth, AUTH_ENABLED } from '../../context/AuthProvider';
import { useProgressData } from '../../hooks/useProgressData';
import { CATEGORIES, CATEGORY_LABELS } from '../../types/structure';
import { accuracyDeltaByAttempts, accuracyTrendSplit, gradedAttempts } from '../../lib/accuracyTrend';
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

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[4px] px-4 py-3" style={{ background: 'var(--sf)', border: '1px solid var(--line)', minWidth: 150 }}>
      <div style={statLabel}>{label}</div>
      <div className="mt-1.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, letterSpacing: '-.01em' }}>
        {value}
      </div>
      {detail && (
        <div className="mt-1" style={{ font: '400 11px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>
          {detail}
        </div>
      )}
    </div>
  );
}

interface AccountProps {
  /** What this account may reach — the billing block and the free-area swap read it. */
  access: UseEntitlement;
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
export function Account({ access, content, repository, userId, onNavigate }: AccountProps) {
  const { user, signOut } = useAuth();
  const { streak, seenByCategory, totalSeen, totalStructures } = useProgressData(repository, userId, content);
  const seenDetail = CATEGORIES.map((c) => `${seenByCategory[c].seen}/${seenByCategory[c].total} ${CATEGORY_LABELS[c].toLowerCase()}`).join(' · ');
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

  // Graded answers only: a flashcard learn card is recorded as an attempt
  // but carries no judgement, and was inflating both the tile and the line.
  const answered = gradedAttempts(attempts ?? []);
  const correct = answered.filter((a) => a.correct).length;
  const accuracyPct = answered.length > 0 ? Math.round((correct / answered.length) * 100) : null;
  // Two lines for one person: structures met for the first time, and
  // structures seen before. No cohort series — a student cannot read their
  // classmates' attempts.
  const split = accuracyTrendSplit(answered);
  // A line too sparse for a weekly window is widened rather than dropped, so
  // the chart has to say which window each one is over (accuracyTrend.ts).
  const windowNote = split.seenBeforeWindowDays === split.firstSightWindowDays
    ? `${split.seenBeforeWindowDays}-day rolling accuracy`
    : `rolling accuracy: ${split.seenBeforeWindowDays} days seen before, ${split.firstSightWindowDays} days first sight`;
  // The headline number is about revision, so it reads the seen-before
  // attempts; a student with too few of those falls back to everything.
  const delta = accuracyDeltaByAttempts(split.seenBefore) ?? accuracyDeltaByAttempts(answered);

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
          <Stat label="Structures seen" value={`${totalSeen} / ${totalStructures}`} detail={seenDetail} />
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
          <AccuracyTrendChart
            points={split.seenBeforeTrend}
            studentName="Seen before"
            secondary={{ label: 'First sight', points: split.firstSightTrend }}
            windowNote={windowNote}
          />
        </section>

        {AUTH_ENABLED && user && (
          <section className="mt-12" style={{ maxWidth: 620 }}>
            <h3 style={heading}>Subscription</h3>
            <SubscriptionSummary access={access} />

            <h3 className="mt-10" style={heading}>Classes</h3>
            <CohortMembership uid={user.uid} />
            <MyClasses uid={user.uid} />
            <AdminSection />

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

            {/* Anonymous users have nothing to export and nothing to erase that
                outlives the browser, so the controls appear once there is a
                real account behind them. */}
            {!user.isAnonymous && <AccountDataControls uid={user.uid} onDeleted={() => signOut()} />}
          </section>
        )}

        {showAuthScreen && <AuthScreen onClose={() => setShowAuthScreen(false)} />}
      </div>
    </AppShell>
  );
}
