import { useState } from 'react';
import { promptInstall, useInstallCardShowing, useInstallWay } from './install';

/**
 * "Add to home screen", as a quiet line at the foot of every app page and as
 * a fuller row on the landing page (12 November 2026, Rory's request).
 *
 * It appears only where install.ts says this browser can install the app and
 * has not already: never inside the installed app, never in Instagram's or
 * TikTok's own browser, never in a desktop browser with no install route.
 *
 *  - Android Chrome and desktop Chrome/Edge: a button that opens the
 *    browser's own install dialog.
 *  - iPhone: there is no dialog to open, so the button shows the two steps
 *    (Share, then Add to Home Screen) in words, with the Share icon drawn.
 *
 * The footer strip can be hidden for 30 days on this device; the landing row
 * cannot, because a first-time visitor has not been asked anything yet. While
 * the Today card (InstallCard) is on screen the footer strip stands down, so
 * the same page never asks twice.
 */

const HIDDEN_UNTIL_KEY = 'anatomy-revision:v1:installStripHiddenUntil';
const HIDE_FOR_MS = 30 * 24 * 60 * 60 * 1000;

function hiddenNow(): boolean {
  try {
    const until = Number(localStorage.getItem(HIDDEN_UNTIL_KEY) ?? 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

function onPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

export function ShareIcon({ size = 16 }: { size?: number }) {
  // The iOS Share glyph: a box with an arrow leaving the top.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-3px' }}>
      <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none', color: 'var(--accd)' }}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.5v6M9 11.5h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IosSteps() {
  return (
    <span>
      Tap <strong style={{ fontWeight: 600 }}>Share</strong> <ShareIcon /> in your browser, then{' '}
      <strong style={{ fontWeight: 600 }}>Add to Home Screen</strong>. You may need to scroll the menu to find it.
    </span>
  );
}

export const STRIP_TITLE_PHONE = 'Add LocusMSK to your home screen';
export const STRIP_TITLE_DESKTOP = 'Install LocusMSK as an app';

interface InstallStripProps {
  /** 'footer': the line at the foot of app pages. 'landing': the row on the marketing page. */
  variant?: 'footer' | 'landing';
  className?: string;
}

export function InstallStrip({ variant = 'footer', className = '' }: InstallStripProps) {
  const way = useInstallWay();
  const cardShowing = useInstallCardShowing();
  const [hidden, setHidden] = useState(() => variant === 'footer' && hiddenNow());
  const [stepsOpen, setStepsOpen] = useState(false);

  if (!way || hidden || (variant === 'footer' && cardShowing)) return null;

  const title = way === 'ios' || onPhone() ? STRIP_TITLE_PHONE : STRIP_TITLE_DESKTOP;
  const landing = variant === 'landing';

  const hide = () => {
    try {
      localStorage.setItem(HIDDEN_UNTIL_KEY, String(Date.now() + HIDE_FOR_MS));
    } catch {
      // Storage refused: it goes for this visit only.
    }
    setHidden(true);
  };

  const button = way === 'prompt' ? (
    <button
      type="button"
      onClick={() => void promptInstall()}
      className="rounded-[3px] px-4"
      style={{ minHeight: 40, font: '500 14px/1 var(--font-ui)', background: 'var(--acc-fill)', color: 'var(--onacc)', flex: 'none' }}
    >
      Install
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setStepsOpen((open) => !open)}
      aria-expanded={stepsOpen}
      className="rounded-[3px] px-4"
      style={{
        minHeight: 40,
        font: '500 14px/1 var(--font-ui)',
        background: landing ? 'var(--acc-fill)' : 'transparent',
        color: landing ? 'var(--onacc)' : 'var(--accd)',
        border: landing ? 'none' : '1.2px solid var(--line)',
        flex: 'none',
      }}
    >
      {stepsOpen ? 'Got it' : 'Show me how'}
    </button>
  );

  return (
    <aside
      aria-label={title}
      className={`${landing ? 'rounded-[3px] p-4' : 'px-4 py-3'} ${className}`}
      style={
        landing
          ? { background: 'var(--sf)', border: '1.2px solid var(--line)', maxWidth: 560 }
          : { borderTop: '1px solid var(--line)', background: 'var(--sf)' }
      }
    >
      <div className="mx-auto flex flex-wrap items-center gap-x-3 gap-y-2" style={{ maxWidth: landing ? undefined : 760 }}>
        <HomeIcon />
        <div className="min-w-0 flex-1" style={{ minWidth: 180 }}>
          <p style={{ font: `500 ${landing ? 15 : 14}px/1.35 var(--font-ui)`, color: 'var(--ink)', margin: 0 }}>{title}</p>
          <p style={{ font: '400 12.5px/1.45 var(--font-ui)', color: 'var(--ink2)', margin: '2px 0 0' }}>
            Opens full screen like an app, one tap from your next review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {button}
          {!landing && (
            <button
              type="button"
              onClick={hide}
              aria-label="Hide for 30 days"
              title="Hide for 30 days"
              className="rounded-[3px]"
              style={{ minHeight: 40, minWidth: 40, font: '400 18px/1 var(--font-ui)', color: 'var(--ink3)', background: 'transparent' }}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {stepsOpen && way === 'ios' && (
        <p
          className="mx-auto"
          role="status"
          style={{ font: '400 13.5px/1.55 var(--font-ui)', color: 'var(--ink)', margin: '10px auto 0', maxWidth: landing ? undefined : 760 }}
        >
          <IosSteps />
        </p>
      )}
    </aside>
  );
}
