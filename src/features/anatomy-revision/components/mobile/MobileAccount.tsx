import { AccountDataControls } from '../shared/AccountDataControls';
import { useEffect, useState } from 'react';
import { MobileShell } from './MobileShell';
import { CohortMembership } from '../shared/CohortMembership';
import { SubscriptionSummary } from '../shared/SubscriptionSummary';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { AccuracyTrendChart } from '../shared/AccuracyTrendChart';
import { MyClasses } from '../Account/MyClasses';
import { AdminSection } from '../Account/AdminSection';
import { AuthScreen } from '../Auth/AuthScreen';
import { Button } from '../shared/Button';
import { useAuth, AUTH_ENABLED } from '../../context/AuthProvider';
import { useProgressData } from '../../hooks/useProgressData';
import { CATEGORIES, CATEGORY_LABELS } from '../../types/structure';
import { accuracyDeltaByAttempts, accuracyTrendSplit, gradedAttempts } from '../../lib/accuracyTrend';
import type { UserAttempt } from '../../types/attempt';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { MobileTab } from './MobileTabBar';

const ATTEMPT_LIMIT = 5000;

interface MobileAccountProps {
  /** What this account may reach — the billing block and the free-area swap read it. */
  access: UseEntitlement;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onNavigateTab: (tab: MobileTab) => void;
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex-1 rounded-[4px] px-3.5 py-3" style={{ background: 'var(--sf)', border: '1px solid var(--line)', minWidth: 140 }}>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        {label}
      </div>
      <div className="mt-1.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, letterSpacing: '-.01em' }}>
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

/**
 * Mobile counterpart to Account/Account.tsx — same four things (who you are,
 * how you're doing, the class you're in, the classes you teach) at the mobile
 * type scale, reusing the same chart and class components.
 *
 * It exists as a tab because creating a class had no mobile entry point at
 * all: the account bits were a strip at the bottom of Progress, which nobody
 * would think to scroll to in order to start teaching.
 */
export function MobileAccount({ access, content, repository, userId, onNavigateTab }: MobileAccountProps) {
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
  // No cohort series: a student can't read their classmates' attempts (firestore.rules).
  // Two lines for one person: structures met for the first time, and
  // structures seen before. No cohort series — a student cannot read their
  // classmates' attempts. The headline reads the seen-before attempts and
  // falls back to everything while those are too few.
  const split = accuracyTrendSplit(answered);
  const delta = accuracyDeltaByAttempts(split.seenBefore) ?? accuracyDeltaByAttempts(answered);

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
          <Stat label="Seen" value={`${totalSeen} / ${totalStructures}`} detail={seenDetail} />
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
          <AccuracyTrendChart
            points={split.seenBeforeTrend}
            studentName="Seen before"
            secondary={{ label: 'First sight', points: split.firstSightTrend }}
          />
        </section>

        {AUTH_ENABLED && user && (
          <section className="mt-9">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
              Subscription
            </h3>
            <SubscriptionSummary access={access} />

            <h3 className="mt-9" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
              Classes
            </h3>
            <CohortMembership uid={user.uid} compact />
            <MyClasses uid={user.uid} compact />
            <AdminSection compact />

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

            {!user.isAnonymous && <AccountDataControls uid={user.uid} onDeleted={() => signOut()} compact />}
          </section>
        )}

        {showAuthScreen && <AuthScreen onClose={() => setShowAuthScreen(false)} />}
      </div>
    </MobileShell>
  );
}
