import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import { MobileShell } from '../mobile/MobileShell';
import type { MobileTab } from '../mobile/MobileTabBar';
import { AREA_LABELS, type Area } from '../../types/region';
import { focusHeadingIfLost } from '../shared/useRouteFocus';
import EmailConfirmPanel from './EmailConfirmPanel';
import { CONFIRM_BODY, CONFIRM_TITLE } from './emailConfirmCopy';

interface EmailConfirmGateProps {
  isDesktop: boolean;
  /** The section whose screen this stands in for, so the navigation still shows where they are. */
  active: NavSection;
  onNavigate: (section: NavSection) => void;
  onNavigateTab: (tab: MobileTab) => void;
  /** The free area waiting on this device for the account (a guest's from before, who has just made one). */
  freeArea: Area | null;
}

/**
 * What an account that has NOT CONFIRMED ITS EMAIL ADDRESS sees in place of
 * every screen that revises (owner's decision, 7 Oct 2026;
 * lib/emailVerification.ts).
 *
 * WHO MEETS IT. Somebody who has been through onboarding on this device and
 * then made their account: a guest from before guests were closed, sent here
 * by "Create a free account to keep going". (A brand-new visitor meets the
 * same panel as part of step one of onboarding.) Never an account with full
 * access, and never an account that was here before the rule.
 *
 * LIKE THE SCREEN BEFORE IT (AccountGate), IT IS NOT A LOCK AND SAYS SO: the
 * sentence under the heading is what they keep. The navigation stays, so the
 * account screen, the prices and the legal pages are all still there.
 */
export default function EmailConfirmGate({ isDesktop, active, onNavigate, onNavigateTab, freeArea }: EmailConfirmGateProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // They pressed "Create account" to get here, and that button is gone.
    focusHeadingIfLost(heading.current);
  }, []);

  const body = (
    <div className={isDesktop ? 'px-16 pt-[72px] pb-12' : 'px-6 pt-8 pb-10'} style={{ color: 'var(--ink)' }}>
      <div style={{ maxWidth: 520 }}>
        <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}>
          One thing first
        </div>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mt-4 outline-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: isDesktop ? 44 : 32,
            lineHeight: 1.06,
            letterSpacing: '-.022em',
          }}
        >
          {CONFIRM_TITLE}
        </h1>
        <p className="mt-4" style={{ font: `400 ${isDesktop ? 18 : 16}px/1.55 var(--font-ui)`, color: 'var(--ink2)' }}>
          {CONFIRM_BODY}
          {freeArea && <> Your free area is {AREA_LABELS[freeArea]}, and your progress is waiting for you.</>}
        </p>

        <div className="mt-7 rounded-[3px] p-6" style={{ background: 'var(--sf)', border: '1px solid var(--line)', maxWidth: 400 }}>
          <EmailConfirmPanel purpose="free-area" />
        </div>

        <p className="mt-6" style={{ font: '400 13.5px/1.6 var(--font-ui)', color: 'var(--ink3)' }}>
          One area is free for good. A subscription opens the rest:{' '}
          <Link to="/pricing" style={{ color: 'var(--accd)' }}>see the plans</Link>.
        </p>
      </div>
    </div>
  );

  if (isDesktop) {
    return <AppShell sidebar={<NavSidebar active={active} onNavigate={onNavigate} />}>{body}</AppShell>;
  }
  const tab: MobileTab = active === 'study' ? 'today' : active;
  return <MobileShell tabs={{ active: tab, onNavigate: onNavigateTab }}>{body}</MobileShell>;
}
