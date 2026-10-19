import { AccountDataControls } from '../shared/AccountDataControls';
import { useState } from 'react';
import { MobileShell } from './MobileShell';
import { CohortMembership } from '../shared/CohortMembership';
import { SubscriptionSummary } from '../shared/SubscriptionSummary';
import { ThemeControls } from '../shared/ThemeControls';
import { StudyPreferences } from '../shared/StudyPreferences';
import { LegalLinks } from '../shared/LegalLinks';
import { OfflineDownloads } from '../../../pwa/offline/OfflineDownloads';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { MyClasses } from '../Account/MyClasses';
import { AdminSection } from '../Account/AdminSection';
import { WeeklyReminderSetting } from '../../../reminders/WeeklyReminderSetting';
import { AuthScreen } from '../Auth/AuthScreen';
import { GuestAccountPanel } from '../Auth/GuestAccountPanel';
import { useAuth, AUTH_ENABLED } from '../../context/AuthProvider';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { MobileTab } from './MobileTabBar';

interface MobileAccountProps {
  /** What this account may reach — the billing block and the free-area swap read it. */
  access: UseEntitlement;
  content: AnatomyContent;
  /** Unread here since the stat tiles and accuracy chart moved to Progress; kept so the route need not change. */
  repository: AnatomyRepository | null;
  userId: string | null;
  onNavigateTab: (tab: MobileTab) => void;
}

/**
 * Mobile counterpart to Account/Account.tsx — who you are, the class you're
 * in and the classes you teach, at the mobile type scale. How you're doing
 * (the tiles and the accuracy chart) moved to MobileProgress
 * (shared/AccuracySection).
 *
 * It exists as a tab because creating a class had no mobile entry point at
 * all: the account bits were a strip at the bottom of Progress, which nobody
 * would think to scroll to in order to start teaching.
 */
export function MobileAccount({ access, content, onNavigateTab }: MobileAccountProps) {
  const { user, signOut } = useAuth();
  const [showAuthScreen, setShowAuthScreen] = useState<false | 'sign-up' | 'sign-in'>(false);

  return (
    <MobileShell tabs={{ active: 'account', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4.5 pb-7.5">
        <h1 data-in style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 35, lineHeight: 1.04, letterSpacing: '-.022em', margin: 0 }}>
          Account
        </h1>
        <p data-in className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
          {user?.displayName ?? user?.email ?? 'Signed in'}
          {user?.isAnonymous && ' — this device only, until you create an account.'}
        </p>

        {/* What sessions ask — see Account.tsx. */}
        {!access.guest && (
          <section data-in className="mt-9">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
              Study preferences
            </h3>
            <div className="mt-3.5">
              <StudyPreferences access={access} compact />
            </div>
          </section>
        )}

        {/* Above the signed-in block — see Account.tsx for why. */}
        <section data-in className="mt-9">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
            Appearance
          </h3>
          <div className="mt-3.5">
            <ThemeControls compact />
          </div>
        </section>

        {/* Outside the signed-in block, and not for a guest — see Account.tsx for why. */}
        {!access.guest && (
          <OfflineDownloads
            access={access}
            compact
            className="mt-9"
            headingStyle={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}
          />
        )}

        {/* A guest: the way to an account, in place of the sections below — see Account.tsx. */}
        {AUTH_ENABLED && access.guest && (
          <section data-in className="mt-9">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
              Create a free account
            </h3>
            <div className="mt-3.5">
              <GuestAccountPanel
                compact
                freeArea={access.freeArea?.area ?? null}
                onCreate={() => setShowAuthScreen('sign-up')}
                onSignIn={() => setShowAuthScreen('sign-in')}
              />
            </div>
          </section>
        )}

        {AUTH_ENABLED && user && !access.guest && (
          <section data-in className="mt-9">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
              Subscription
            </h3>
            <SubscriptionSummary access={access} />

            <h3 className="mt-9" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
              Reminders
            </h3>
            <div className="mt-3">
              <WeeklyReminderSetting uid={user.uid} email={user.email} />
            </div>

            <h3 className="mt-9" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
              Classes
            </h3>
            <CohortMembership uid={user.uid} sitting={{ areas: access.areas, missing: content.facts.missing }} compact />
            <MyClasses uid={user.uid} compact />
            <AdminSection compact />

            <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
              <button type="button" onClick={() => signOut()} className="min-h-[44px] text-[13.5px]" style={{ color: 'var(--ink3)' }}>
                Sign out
              </button>
            </div>

            <AccountDataControls uid={user.uid} onDeleted={() => signOut()} compact />
          </section>
        )}

        <section data-in className="mt-9">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
            About this app
          </h3>
          <div className="mt-2">
            <LegalLinks compact />
          </div>
        </section>

        {showAuthScreen && <AuthScreen initialMode={showAuthScreen} onClose={() => setShowAuthScreen(false)} />}
      </div>
    </MobileShell>
  );
}
