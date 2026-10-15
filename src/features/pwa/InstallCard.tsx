import { useState } from 'react';
import { promptInstall, useInstallWay } from './install';

/**
 * "Add LocusMSK to your home screen", on Today, for a student who has
 * already finished a session (install.ts says when it can appear at all).
 *
 * After the first session, not before: asking a visitor to install something
 * they have not tried is asking too early, and the first visit has a session
 * to start. "Not now" puts it away on this device for good; a student who
 * wants it later can still use the browser's own menu.
 */

const DISMISSED_KEY = 'anatomy-revision:v1:installCardDismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export const INSTALL_TITLE = 'Add LocusMSK to your home screen';

export function InstallCard({ className = '' }: { className?: string }) {
  const way = useInstallWay();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (!way || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Storage refused: it goes for this visit only.
    }
    setDismissed(true);
  };

  return (
    <section
      aria-label={INSTALL_TITLE}
      className={`rounded-[3px] p-4 ${className}`}
      style={{ background: 'var(--sf)', border: '1.2px solid var(--line)' }}
    >
      <p style={{ font: '500 15px/1.35 var(--font-ui)', color: 'var(--ink)', margin: 0 }}>{INSTALL_TITLE}</p>
      <p className="mt-1" style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--ink2)', margin: '4px 0 0' }}>
        It opens like an app, your review is one tap away, and downloaded areas work with no signal.
        {way === 'ios' && ' Tap the Share button, then Add to Home Screen.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {way === 'prompt' && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="rounded-[3px] px-4"
            style={{ minHeight: 44, font: '500 14px/1 var(--font-ui)', background: 'var(--acc-fill)', color: 'var(--onacc)' }}
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-[3px] px-4"
          style={{ minHeight: 44, font: '500 14px/1 var(--font-ui)', background: 'transparent', color: 'var(--ink2)', border: '1.2px solid var(--line)' }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}
