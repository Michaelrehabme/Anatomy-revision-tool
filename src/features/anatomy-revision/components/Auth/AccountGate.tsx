import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';
import { MobileShell } from '../mobile/MobileShell';
import type { MobileTab } from '../mobile/MobileTabBar';
import { AREA_LABELS, type Area } from '../../types/region';
import { AccountForm } from './AccountForm';
import { focusHeadingIfLost } from '../shared/useRouteFocus';

interface AccountGateProps {
  isDesktop: boolean;
  /** The section whose screen this stands in for, so the navigation still shows where they are. */
  active: NavSection;
  onNavigate: (section: NavSection) => void;
  onNavigateTab: (tab: MobileTab) => void;
  /** The free area this guest chose before guests were closed, if they chose one. */
  freeArea: Area | null;
  /**
   * They were signed in to an account that already existed, so what they did
   * here as a guest was not moved across. This screen is gone by the time
   * that could be said on it; the app says it instead.
   */
  onRecovered?: (message: string) => void;
}

/**
 * What a GUEST sees in place of every screen that revises.
 *
 * WHO THIS IS FOR. Until October 2026 "Start free" made an anonymous sign-in
 * and that was enough: a guest picked a free area and studied, with no
 * account. The free area now needs a real one (owner's decision, 6 Oct 2026 —
 * nine wiped browsers were nine free areas). A new visitor meets that as the
 * first step of onboarding. This screen is for the people who were already
 * here: guests with a free area and weeks of progress, who open the app one
 * morning and find it asking for something it never asked for before.
 *
 * SO IT IS NOT A LOCK, AND IT SAYS SO FIRST. Nothing of theirs is gone.
 * Creating an account LINKS the sign-in to the guest they already are — the
 * uid is kept — so the progress stored under it and the free area chosen on
 * this device are the account's from that moment (data/firebase.ts,
 * hooks/useEntitlement.ts). The heading says what to do; the sentence under
 * it says what they keep.
 *
 * WHAT IS CLOSED UNTIL THEN: Today, Study, a session, the Atlas, a
 * structure's card, Progress, the diagnostic, achievements — everything that
 * shows a fact or asks a question. WHAT IS NOT: the account screen (to sign
 * in, or to see that their numbers are still there), the prices, and the
 * legal and sources pages. The navigation stays, so none of that is hidden.
 *
 * In a bundled build the facts are in the downloaded files whatever this
 * screen does: it is the app declining to show them, not a wall. Where facts
 * are fetched per area the content function refuses a guest, and this is the
 * same answer said kindly.
 *
 * OFFLINE, an account cannot be created (it needs the sign-in service), and
 * the form's own message says so. The line at the top of the form says it
 * before they type.
 */
export default function AccountGate({ isDesktop, active, onNavigate, onNavigateTab, freeArea, onRecovered }: AccountGateProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // When they pressed something to get here and it is gone; not on a first
    // load, where nothing was pressed (shared/useRouteFocus.ts).
    focusHeadingIfLost(heading.current);
  }, []);

  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
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
          Create a free account to keep going
        </h1>
        <p className="mt-4" style={{ font: `400 ${isDesktop ? 18 : 16}px/1.55 var(--font-ui)`, color: 'var(--ink2)' }}>
          Your progress and your free area come with you.
          {freeArea && <> Your free area is {AREA_LABELS[freeArea]}.</>}
        </p>
        <p className="mt-3" style={{ font: '400 14.5px/1.6 var(--font-ui)', color: 'var(--ink3)' }}>
          Revising now needs an account. It is free, it takes a minute, and it keeps what you have done safe if this
          browser is cleared or you change device.
        </p>

        <div className="mt-7 rounded-[3px] p-6" style={{ background: 'var(--sf)', border: '1px solid var(--line)', maxWidth: 400 }}>
          {!online && (
            <p role="status" className="mb-4" style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
              You are offline. Creating an account needs a connection. Everything you have done is still on this
              device, and will be here when you are back online.
            </p>
          )}
          <AccountForm guestHasProgress onRecovered={onRecovered} onDone={() => { /* The app sees the account and shows the screen asked for. */ }} />
        </div>

        <p className="mt-6" style={{ font: '400 13.5px/1.6 var(--font-ui)', color: 'var(--ink3)' }}>
          One area is free for good. A subscription opens the rest:{' '}
          <Link to="/pricing" style={{ color: 'var(--accd)' }}>see the plans</Link>.
        </p>
      </div>
    </div>
  );

  if (isDesktop) {
    return <AppShell sidebar={<NavSidebar active={active} onNavigate={onNavigate} hideAccount />}>{body}</AppShell>;
  }
  const tab: MobileTab = active === 'study' ? 'today' : active;
  return <MobileShell tabs={{ active: tab, onNavigate: onNavigateTab }}>{body}</MobileShell>;
}
