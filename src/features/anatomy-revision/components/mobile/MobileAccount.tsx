import { MobileShell } from './MobileShell';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';
import { AccountBackLink, AccountPages, ACCOUNT_PAGE_TITLES, isAccountPageId } from '../Account/AccountPages';
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
  const { user } = useAuth();
  const { page: pageParam } = useParams();
  const page = isAccountPageId(pageParam) ? pageParam : null;

  return (
    <MobileShell tabs={{ active: 'account', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4.5 pb-7.5">
        {page && <AccountBackLink compact />}
        <h1 data-in style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: page ? 29 : 35, lineHeight: 1.04, letterSpacing: '-.022em', margin: 0 }}>
          {page ? ACCOUNT_PAGE_TITLES[page] : 'Account'}
        </h1>
        {!page && (
          <p data-in className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
            {user?.displayName ?? user?.email ?? 'Signed in'}
            {user?.isAnonymous && ' — this device only, until you create an account.'}
          </p>
        )}

        {/* A menu of pages — see Account/AccountPages.tsx. */}
        <AccountPages
          page={page}
          access={access}
          content={content}
          compact
          headingStyle={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}
        />
      </div>
    </MobileShell>
  );
}
