import { AccountDataControls } from '../shared/AccountDataControls';
import { useState } from 'react';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import { AuthScreen } from '../Auth/AuthScreen';
import { GuestAccountPanel } from '../Auth/GuestAccountPanel';
import { CohortMembership } from '../shared/CohortMembership';
import { SubscriptionSummary } from '../shared/SubscriptionSummary';
import { ThemeControls } from '../shared/ThemeControls';
import { StudyPreferences } from '../shared/StudyPreferences';
import { LegalLinks } from '../shared/LegalLinks';
import { OfflineDownloads } from '../../../pwa/offline/OfflineDownloads';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { MyClasses } from './MyClasses';
import { AdminSection } from './AdminSection';
import { WeeklyReminderSetting } from '../../../reminders/WeeklyReminderSetting';
import { useAuth, AUTH_ENABLED } from '../../context/AuthProvider';
import { useProgressData } from '../../hooks/useProgressData';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';

const heading = {
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 22,
  letterSpacing: '-.01em',
  margin: 0,
} as const;

interface AccountProps {
  /** What this account may reach — the billing block and the free-area swap read it. */
  access: UseEntitlement;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onNavigate: (section: NavSection) => void;
}

/**
 * The account screen: who you are, the class you're in, and the classes you
 * teach. How you're doing — the tiles and the accuracy chart — moved to
 * Progress (shared/AccuracySection).
 *
 * Teaching lives here because it isn't a role anyone grants — anyone can
 * create a class and own it — so it belongs with the rest of "your account"
 * rather than behind a door most people would never think to try.
 */
export function Account({ access, content, repository, userId, onNavigate }: AccountProps) {
  const { user, signOut } = useAuth();
  const { streak } = useProgressData(repository, userId, content);
  const [showAuthScreen, setShowAuthScreen] = useState<false | 'sign-up' | 'sign-in'>(false);

  return (
    <AppShell
      sidebar={
        <NavSidebar
          active="account"
          onNavigate={onNavigate}
          // A guest is offered the account in the page itself, below.
          hideAccount={access.guest}
          footer={<div style={{ font: '500 11.5px/1 var(--font-mono)', color: 'var(--acc2d)' }}>{streak}-day streak</div>}
        />
      }
    >
      <div className="px-16 pt-[72px] pb-12">
        <h1 data-in style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.02, letterSpacing: '-.026em', margin: '0 0 12px' }}>
          Account
        </h1>
        <p data-in className="text-sm leading-relaxed" style={{ color: 'var(--ink2)', maxWidth: 620 }}>
          {user?.displayName ?? user?.email ?? 'Signed in'}
          {user?.isAnonymous && ' — this device only, until you create an account.'}
        </p>

        {/* What sessions ask: the questionnaire, this week's focus, teaching
            cards (components/shared/StudyPreferences.tsx). First, because it
            is the setting a student comes here to change. Not for a guest,
            who has no sessions to shape. */}
        {!access.guest && (
          <section data-in className="mt-12" style={{ maxWidth: 620 }}>
            <h3 style={heading}>Study preferences</h3>
            <div className="mt-4">
              <StudyPreferences access={access} />
            </div>
          </section>
        )}

        {/* Above the signed-in block deliberately: everything below it is
            hidden for an anonymous user, and appearance is not an account
            setting — it is a per-device one. */}
        <section data-in className="mt-12" style={{ maxWidth: 620 }}>
          <h3 style={heading}>Appearance</h3>
          <div className="mt-4">
            <ThemeControls />
          </div>
        </section>

        {/* Per-device like appearance, and for the same reason outside the
            signed-in block: a download belongs to this browser. Not offered
            to a guest, who holds no area to download. */}
        {!access.guest && <OfflineDownloads access={access} headingStyle={heading} className="mt-12" />}

        {/* A guest: the way to an account, in place of the sections below,
            none of which a guest can use. */}
        {AUTH_ENABLED && access.guest && (
          <section data-in className="mt-12" style={{ maxWidth: 620 }}>
            <h3 style={heading}>Create a free account</h3>
            <div className="mt-4">
              <GuestAccountPanel
                freeArea={access.freeArea?.area ?? null}
                onCreate={() => setShowAuthScreen('sign-up')}
                onSignIn={() => setShowAuthScreen('sign-in')}
              />
            </div>
          </section>
        )}

        {AUTH_ENABLED && user && !access.guest && (
          <section data-in className="mt-12" style={{ maxWidth: 620 }}>
            <h3 style={heading}>Subscription</h3>
            <SubscriptionSummary access={access} />

            <h3 className="mt-10" style={heading}>Reminders</h3>
            <div className="mt-3">
              <WeeklyReminderSetting uid={user.uid} email={user.email} />
            </div>

            <h3 className="mt-10" style={heading}>Classes</h3>
            <CohortMembership uid={user.uid} sitting={{ areas: access.areas, missing: content.facts.missing }} />
            <MyClasses uid={user.uid} />
            <AdminSection />

            <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
              <button type="button" onClick={() => signOut()} style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--ink3)' }}>
                Sign out
              </button>
            </div>

            <AccountDataControls uid={user.uid} onDeleted={() => signOut()} />
          </section>
        )}

        <section data-in className="mt-12" style={{ maxWidth: 620 }}>
          <h3 style={heading}>About this app</h3>
          <div className="mt-3">
            <LegalLinks />
          </div>
        </section>

        {showAuthScreen && <AuthScreen initialMode={showAuthScreen} onClose={() => setShowAuthScreen(false)} />}
      </div>
    </AppShell>
  );
}
