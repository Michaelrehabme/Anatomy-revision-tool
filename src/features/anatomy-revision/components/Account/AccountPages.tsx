import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AccountDataControls } from '../shared/AccountDataControls';
import { AuthScreen } from '../Auth/AuthScreen';
import { GuestAccountPanel } from '../Auth/GuestAccountPanel';
import { CohortMembership } from '../shared/CohortMembership';
import { SubscriptionSummary } from '../shared/SubscriptionSummary';
import { ThemeControls } from '../shared/ThemeControls';
import { StudyPreferences } from '../shared/StudyPreferences';
import { LegalLinks } from '../shared/LegalLinks';
import { OfflineDownloads } from '../../../pwa/offline/OfflineDownloads';
import { WeeklyReminderSetting } from '../../../reminders/WeeklyReminderSetting';
import { MyClasses } from './MyClasses';
import { AdminSection } from './AdminSection';
import { useAuth, AUTH_ENABLED } from '../../context/AuthProvider';
import { useStudyProfile } from '../../hooks/useStudyProfile';
import { dailyGoalFor, reviewNewShare } from '../../lib/studyProfile';
import { getLearnCardAttempts, LEARN_CARD_ATTEMPT_LABELS } from '../../lib/preferences';
import { isNativeShell } from '../../../native/nativeShell';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';

/**
 * Account as a short menu, each row its own page (owner, 17 Nov 2026: "the
 * amount of info in the app is beginning to get too complex"). It used to be
 * one long scroll of some eighteen settings under seven headings, with the
 * learning settings split between Study preferences and Appearance and the
 * two reminders in different places. Nothing was removed or renamed: every
 * setting is on exactly one of these pages.
 *
 * Shared by the desktop and mobile screens; `compact` is the mobile scale.
 */
export type AccountPageId = 'learning' | 'plan' | 'reminders' | 'appearance' | 'account' | 'about';

export const ACCOUNT_PAGE_TITLES: Record<AccountPageId, string> = {
  learning: 'Learning experience',
  plan: 'Study plan',
  reminders: 'Reminders',
  appearance: 'Appearance & accessibility',
  account: 'Subscription & account',
  about: 'About this app',
};

export function isAccountPageId(value: string | undefined): value is AccountPageId {
  return !!value && value in ACCOUNT_PAGE_TITLES;
}

interface AccountPagesProps {
  page: AccountPageId | null;
  access: UseEntitlement;
  content: AnatomyContent;
  compact?: boolean;
  headingStyle: CSSProperties;
}

/** Which rows this account has: a guest has no sessions to shape, and a browser has no notification to time. */
function availablePages(access: UseEntitlement, signedIn: boolean): AccountPageId[] {
  const pages: AccountPageId[] = ['learning'];
  if (!access.guest) pages.push('plan');
  if (isNativeShell() || (AUTH_ENABLED && signedIn && !access.guest)) pages.push('reminders');
  pages.push('appearance');
  if (!access.guest || AUTH_ENABLED) pages.push('account');
  pages.push('about');
  return pages;
}

export function AccountPages({ page, access, content, compact = false, headingStyle }: AccountPagesProps) {
  const { user, signOut } = useAuth();
  const { profile } = useStudyProfile();
  const [showAuthScreen, setShowAuthScreen] = useState<false | 'sign-up' | 'sign-in'>(false);
  const signedIn = !!user && !user.isAnonymous;
  const pages = availablePages(access, !!user);
  const current = page && pages.includes(page) ? page : null;

  const summary: Record<AccountPageId, string> = {
    learning: access.guest
      ? 'Latin names and the tours'
      : `${dailyGoalFor(profile)} questions a day · ${Math.round(reviewNewShare(profile) * 100)}% new · teaching cards ${LEARN_CARD_ATTEMPT_LABELS[getLearnCardAttempts()]?.toLowerCase() ?? ''}`,
    plan: 'Your starting answers and this week’s focus',
    reminders: 'When to remind you, and the weekly email',
    appearance: 'Theme, high contrast and answering in words',
    account: access.guest ? 'Create a free account or sign in' : 'Your plan, classes, offline areas and your data',
    about: 'Sources, privacy, attributions and terms',
  };

  // A page this account does not have (a reminder in a browser, say): back to the menu.
  if (page && !current) return <Navigate to="/account" replace />;

  let body: ReactNode;
  if (!current) {
    body = (
      <nav aria-label="Account" className={compact ? 'mt-6' : 'mt-10'} style={compact ? undefined : { maxWidth: 620 }}>
        <ul className="m-0 list-none p-0">
          {pages.map((id) => (
            <li key={id} style={{ borderTop: '1px solid var(--line)' }}>
              <Link
                to={`/account/${id}`}
                className="flex items-center gap-4 py-4 no-underline"
                style={{ minHeight: 64, color: 'var(--ink)' }}
              >
                <span className="flex-1">
                  <span className="block" style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 17 : 18, letterSpacing: '-.005em' }}>
                    {ACCOUNT_PAGE_TITLES[id]}
                  </span>
                  <span className="mt-1 block" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink3)' }}>
                    {summary[id]}
                  </span>
                </span>
                <span aria-hidden="true" style={{ fontSize: 18, color: 'var(--ink3)' }}>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div style={{ borderTop: '1px solid var(--line)' }} />
      </nav>
    );
  } else {
    body = (
      <div className={compact ? 'mt-6' : 'mt-8'} style={compact ? undefined : { maxWidth: 620 }}>
        {current === 'learning' && (
          <>
            {!access.guest && <StudyPreferences access={access} compact={compact} part="learning" />}
            <div className={access.guest ? '' : 'mt-7'}>
              <ThemeControls compact={compact} part="learning" />
            </div>
          </>
        )}
        {current === 'plan' && <StudyPreferences access={access} compact={compact} part="plan" />}
        {current === 'reminders' && (
          <>
            {isNativeShell() && <StudyPreferences access={access} compact={compact} part="reminder" />}
            {AUTH_ENABLED && user && !access.guest && (
              <div className={isNativeShell() ? 'mt-7' : ''}>
                <WeeklyReminderSetting uid={user.uid} email={user.email} />
              </div>
            )}
          </>
        )}
        {current === 'appearance' && <ThemeControls compact={compact} part="appearance" />}
        {current === 'account' && (
          <>
            {AUTH_ENABLED && access.guest && (
              <GuestAccountPanel
                freeArea={access.freeArea?.area ?? null}
                onCreate={() => setShowAuthScreen('sign-up')}
                onSignIn={() => setShowAuthScreen('sign-in')}
              />
            )}
            {AUTH_ENABLED && user && !access.guest && (
              <>
                <h3 style={headingStyle}>Subscription</h3>
                <SubscriptionSummary access={access} />
                <h3 className="mt-10" style={headingStyle}>
                  Classes
                </h3>
                <CohortMembership uid={user.uid} sitting={{ areas: access.areas, missing: content.facts.missing }} compact={compact} />
                <MyClasses uid={user.uid} compact={compact} />
                <AdminSection compact={compact} />
              </>
            )}
            {/* Per-device: a download belongs to this browser. Not for a guest, who holds no area to download. */}
            {!access.guest && <OfflineDownloads access={access} compact={compact} headingStyle={headingStyle} className="mt-10" />}
            {AUTH_ENABLED && user && !access.guest && (
              <>
                <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                  <button type="button" onClick={() => signOut()} style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--ink3)' }}>
                    Sign out
                  </button>
                </div>
                <AccountDataControls uid={user.uid} onDeleted={() => signOut()} compact={compact} />
              </>
            )}
            {!AUTH_ENABLED && !signedIn && (
              <p className="mt-6" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink3)' }}>
                This copy of the app keeps everything on this device.
              </p>
            )}
          </>
        )}
        {current === 'about' && <LegalLinks compact={compact} />}
      </div>
    );
  }

  return (
    <>
      {body}
      {showAuthScreen && <AuthScreen initialMode={showAuthScreen} onClose={() => setShowAuthScreen(false)} />}
    </>
  );
}

/** "‹ Account" above a page's title, back to the menu. */
export function AccountBackLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/account"
      className="mb-3 inline-flex items-center gap-1.5 no-underline"
      style={{ minHeight: 44, fontSize: compact ? 14.5 : 14, color: 'var(--accd)' }}
    >
      <span aria-hidden="true">‹</span> Account
    </Link>
  );
}
