import { useState } from 'react';
import { deleteAccountData, exportAccountData } from '../../data/accountLifecycle';

/**
 * The two rights the privacy policy promises and the stores require: a
 * portable copy of your data, and deletion of your account (CR-025 items 3
 * and 4).
 *
 * Both stores want deletion reachable in at most two taps from the account
 * screen, so it lives here rather than behind a settings menu. It is also the
 * screen a data protection officer will be shown, which is the same argument.
 *
 * TYPE-TO-CONFIRM, not an "are you sure" dialog. This is irreversible and
 * takes effect immediately; a confirm button placed where a student's thumb
 * already is would be a trap. Typing the word is a deliberate half-second of
 * friction, and it is the pattern people already recognise from GitHub and
 * Stripe for exactly this action.
 */

const CONFIRM_WORD = 'DELETE';

interface AccountDataControlsProps {
  uid: string;
  /** Called once the account is gone, so the app can return to a signed-out state. */
  onDeleted: () => void;
  compact?: boolean;
}

export function AccountDataControls({ uid, onDeleted, compact }: AccountDataControlsProps) {
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const font = compact ? 13.5 : 13;

  async function handleExport() {
    setBusy('export');
    setError(null);
    try {
      const data = await exportAccountData(uid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `locusmsk-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      // Revoking immediately can cancel the download in Safari; a tick is enough.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare your data.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy('delete');
    setError(null);
    try {
      await deleteAccountData(uid, ({ step: s }) => setStep(s));
      onDeleted();
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : '';
      setError(
        // Firebase refuses to delete an account whose sign-in is not recent,
        // and says so in a code no student should ever be shown raw.
        code === 'auth/requires-recent-login'
          ? 'For your security, please sign out and sign in again, then delete your account.'
          : err instanceof Error
            ? err.message
            : 'Could not delete your account.',
      );
      setBusy(null);
      setStep(null);
    }
  }

  return (
    <div className="mt-8" style={{ maxWidth: 620 }}>
      <h2
        style={{
          font: '500 10px/1 var(--font-mono)',
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--ink3)',
          margin: 0,
        }}
      >
        Your data
      </h2>

      <p className="mt-3" style={{ font: `400 ${font}px/1.5 var(--font-ui)`, color: 'var(--ink2)' }}>
        You can take a copy of everything held about you, or delete your account and all of it.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={busy !== null}
          className={compact ? 'min-h-[44px]' : undefined}
          style={{ font: `400 ${font}px/1 var(--font-ui)`, color: 'var(--accd)' }}
        >
          {busy === 'export' ? 'Preparing…' : 'Download my data (JSON)'}
        </button>

        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy !== null}
            className={compact ? 'min-h-[44px]' : undefined}
            style={{ font: `400 ${font}px/1 var(--font-ui)`, color: 'var(--acc2d)' }}
          >
            Delete my account
          </button>
        )}
      </div>

      {confirming && (
        <div
          className="mt-4 p-4"
          style={{ border: '1.2px solid var(--acc2)', background: 'var(--acc2s)' }}
        >
          <p style={{ font: `500 ${font}px/1.5 var(--font-ui)`, color: 'var(--ink)', margin: 0 }}>
            This deletes your account, every answer you have given, your progress and streaks, and removes you from
            your class. It cannot be undone.
          </p>
          <p className="mt-2" style={{ font: `400 ${font}px/1.5 var(--font-ui)`, color: 'var(--ink2)', margin: '8px 0 0' }}>
            Download your data first if you want to keep it. Type <strong>{CONFIRM_WORD}</strong> to confirm.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              aria-label={`Type ${CONFIRM_WORD} to confirm`}
              disabled={busy === 'delete'}
              className={compact ? 'min-h-[44px]' : undefined}
              style={{
                font: `400 ${font}px/1 var(--font-mono)`,
                padding: '8px 10px',
                border: '1.2px solid var(--line-strong)',
                background: 'var(--pg)',
                color: 'var(--ink)',
                width: 140,
              }}
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={typed !== CONFIRM_WORD || busy === 'delete'}
              className={compact ? 'min-h-[44px]' : undefined}
              style={{
                font: `500 ${font}px/1 var(--font-ui)`,
                padding: '9px 14px',
                background: typed === CONFIRM_WORD ? 'var(--acc2)' : 'var(--fig-off)',
                color: typed === CONFIRM_WORD ? 'var(--onacc)' : 'var(--ink3)',
                cursor: typed === CONFIRM_WORD ? 'pointer' : 'not-allowed',
              }}
            >
              {busy === 'delete' ? (step ?? 'Deleting…') : 'Delete everything'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setTyped('');
                setError(null);
              }}
              disabled={busy === 'delete'}
              className={compact ? 'min-h-[44px]' : undefined}
              style={{ font: `400 ${font}px/1 var(--font-ui)`, color: 'var(--ink3)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3" role="alert" style={{ font: `400 ${font}px/1.5 var(--font-ui)`, color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
