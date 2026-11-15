import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteUserAccount } from '../../data/deleteAccount';
import { confirmationWord, DELETE_REFUSAL_TEXT, type DeleteRefusal } from '../../lib/deleteAccountPolicy';
import { Panel } from '../shared/AdminUi';

const FAILURE_TEXT = {
  forbidden: 'Only an admin can delete accounts. Try signing out and in again.',
  failed: 'Something went wrong and the account may be partly deleted. Try again; deleting twice is safe.',
};

/**
 * The foot of a user's page: delete the account, for clearing out test and
 * internal accounts. Typing the email to confirm, because there is no undo.
 */
export function DeleteAccountPanel({
  uid,
  email,
  name,
  refusal,
}: {
  uid: string;
  email: string | null;
  name: string;
  /** Known before the click (own account, admin, paying), so the button is not offered. */
  refusal: DeleteRefusal | null;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const word = confirmationWord(email);
  const matches = typed.trim().toLowerCase() === word.toLowerCase();

  const run = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteUserAccount(uid);
    setBusy(false);
    if (result.ok) {
      navigate('/admin/users', { replace: true, state: { deleted: name } });
      return;
    }
    setError(result.reason in DELETE_REFUSAL_TEXT ? DELETE_REFUSAL_TEXT[result.reason as DeleteRefusal] : FAILURE_TEXT[result.reason as keyof typeof FAILURE_TEXT]);
  };

  const danger = { background: 'var(--acc2)', color: 'var(--onacc)', border: 0 } as const;

  return (
    <Panel className="mt-12" title="Delete account">
      {refusal ? (
        <p style={{ margin: 0, font: '400 13.5px/1.45 var(--font-ui)', color: 'var(--ink3)' }}>{DELETE_REFUSAL_TEXT[refusal]}</p>
      ) : !open ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p style={{ margin: 0, font: '400 13.5px/1.45 var(--font-ui)', color: 'var(--ink2)' }}>
            Removes their sign-in, progress, answers and profile. For test and internal accounts. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-[38px] flex-none rounded-full px-4"
            style={{ font: '500 13px/1 var(--font-ui)', background: 'transparent', color: 'var(--acc2d)', border: '1.2px solid var(--acc2)', cursor: 'pointer' }}
          >
            Delete account…
          </button>
        </div>
      ) : (
        <div>
          <label htmlFor="confirm-delete" style={{ display: 'block', font: '400 13.5px/1.45 var(--font-ui)', color: 'var(--ink)' }}>
            To delete <strong>{name}</strong> for good, type <strong style={{ overflowWrap: 'anywhere' }}>{word}</strong> below.
          </label>
          <input
            id="confirm-delete"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
            className="mt-2.5 min-h-[40px] w-full rounded-[4px] px-3 sm:max-w-[360px]"
            style={{ font: '400 14px/1 var(--font-ui)', color: 'var(--ink)', background: 'var(--pg)', border: '1.2px solid var(--line)' }}
          />
          {error && (
            <p className="mt-2.5" style={{ margin: '10px 0 0', font: '400 13px/1.4 var(--font-ui)', color: 'var(--acc2d)' }}>
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!matches || busy}
              onClick={() => void run()}
              className="min-h-[38px] rounded-full px-4"
              style={{ font: '500 13px/1 var(--font-ui)', ...danger, opacity: !matches || busy ? 0.45 : 1, cursor: !matches || busy ? 'default' : 'pointer' }}
            >
              {busy ? 'Deleting…' : 'Delete for good'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped('');
                setError(null);
              }}
              className="min-h-[38px] rounded-full px-4"
              style={{ font: '500 13px/1 var(--font-ui)', background: 'transparent', color: 'var(--ink2)', border: '1.2px solid var(--line)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
