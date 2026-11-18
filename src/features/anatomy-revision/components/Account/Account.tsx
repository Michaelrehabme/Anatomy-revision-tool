import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';
import { AccountBackLink, AccountPages, ACCOUNT_PAGE_TITLES, isAccountPageId } from './AccountPages';
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
  const { user } = useAuth();
  const { streak } = useProgressData(repository, userId, content);
  const { page: pageParam } = useParams();
  const page = isAccountPageId(pageParam) ? pageParam : null;

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
        {page && <AccountBackLink />}
        <h1 data-in style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: page ? 40 : 52, lineHeight: 1.02, letterSpacing: '-.026em', margin: '0 0 12px' }}>
          {page ? ACCOUNT_PAGE_TITLES[page] : 'Account'}
        </h1>
        {!page && (
          <p data-in className="text-sm leading-relaxed" style={{ color: 'var(--ink2)', maxWidth: 620 }}>
            {user?.displayName ?? user?.email ?? 'Signed in'}
            {user?.isAnonymous && ' — this device only, until you create an account.'}
          </p>
        )}

        {/* A menu of pages, one per kind of setting (AccountPages.tsx). */}
        <AccountPages page={page} access={access} content={content} headingStyle={heading} />
      </div>
    </AppShell>
  );
}
