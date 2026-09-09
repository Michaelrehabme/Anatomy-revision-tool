import { useState } from 'react';

/**
 * The "this is sample data" notice for the public demo build
 * (npm run build:demo — see vite.config.demo.ts).
 *
 * Only mounted when VITE_PUBLIC_DEMO is set, so it costs the real app
 * nothing. It exists because the demo is sent to course leaders cold: the
 * cohort on screen is generated, the students are invented, and someone
 * arriving from a link has no other way to know that. Saying so plainly is
 * also what stops the realistic seed data from reading as a claim about real
 * students.
 *
 * Dismissal is per-tab (sessionStorage), not remembered across visits: a
 * returning viewer is usually a NEW person opening the same forwarded link,
 * and they need telling too.
 */

const DISMISSED_KEY = 'locusmsk:demo-banner-dismissed';

function readDismissed(): boolean {
  // Private windows and blocked site data throw on access rather than
  // returning null, and a demo that white-screens on a privacy setting is
  // worse than one that shows its banner twice.
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Non-fatal: the banner simply reappears on the next navigation.
    }
    setDismissed(true);
  };

  /**
   * Clears everything this origin has stored and reloads, so a visitor who
   * has clicked through a session, answered questions and dismissed things
   * can hand the link to a colleague in the state they first saw. The demo
   * origin holds nothing but demo state, so a blanket clear is the honest
   * implementation — the generated cohort lives in the bundle and comes back
   * identically on reload.
   */
  const reset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignored on purpose — reloading still returns most of the way.
    }
    window.location.assign('/');
  };

  return (
    <div
      role="status"
      className="fixed left-1/2 top-3 z-[100] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-[3px] px-3 py-2 shadow-lg"
      style={{ background: 'var(--acc2d)', color: 'var(--onacc)', font: '500 12px/1.35 var(--font-ui)' }}
    >
      <span>
        <strong style={{ fontWeight: 600 }}>Sample data.</strong> An example cohort, not real students.
      </span>
      <button
        type="button"
        onClick={reset}
        className="shrink-0 rounded-[3px] px-2 py-1 underline underline-offset-2"
        style={{ font: 'inherit', color: 'inherit' }}
      >
        Reset demo
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-[3px] px-2 py-1"
        style={{ font: 'inherit', color: 'inherit', opacity: 0.75 }}
      >
        ✕
      </button>
    </div>
  );
}

export default DemoBanner;
