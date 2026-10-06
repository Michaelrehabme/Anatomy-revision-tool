import { useEffect, useId, useRef, useState } from 'react';
import { AccountForm, type AccountFormMode } from './AccountForm';

interface AuthScreenProps {
  initialMode?: AccountFormMode;
  onClose: () => void;
}

/**
 * The sign-in / sign-up form as an overlay, for the places that offer it as
 * a button: the sidebar, the account screen, the pricing page.
 *
 * It can be dismissed, because where it is offered it is a choice. Where an
 * account is REQUIRED — the first step of onboarding, and the screen a guest
 * meets in place of revision — the same form is in the page itself with no
 * way round it (Onboarding, AccountGate). The form is components/Auth/AccountForm.
 *
 * A dialog: named by its heading, focus moved into it when it opens and back
 * to whatever opened it when it closes, Escape closes it.
 */
export function AuthScreen({ initialMode = 'sign-up', onClose }: AuthScreenProps) {
  const [mode, setMode] = useState<AccountFormMode>(initialMode);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Callers hand over a new function on every render. Held in a ref so the
  // effect below runs once: run again, it would pull focus out of the field
  // being typed in each time the screen behind re-rendered.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-6"
      style={{ background: 'color-mix(in srgb, var(--ink) 55%, transparent)' }}
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-sm rounded-[3px] p-8 outline-none"
        style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div
            style={{
              font: '500 10px/1 var(--font-mono)',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'var(--accd)',
            }}
          >
            {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="border-0 bg-transparent p-0 leading-none"
            style={{ color: 'var(--ink3)', fontSize: 20 }}
          >
            &times;
          </button>
        </div>

        <h2
          id={titleId}
          className="mt-2 mb-6"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '-.02em', color: 'var(--ink)' }}
        >
          {mode === 'sign-up' ? 'Create a free account' : 'Sign in'}
        </h2>

        <AccountForm initialMode={initialMode} onModeChange={setMode} onDone={onClose} />
      </div>
    </div>
  );
}
