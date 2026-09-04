import { useState } from 'react';
import type { Cohort } from '../../types/cohort';

/**
 * The cohort's join code, shown to its educator (CR-012). Educators could
 * always read this — firestore.rules lets any signed-in user read a cohort
 * doc, precisely so a student can resolve a code — but nothing in /educator
 * ever displayed it, so the person who has to read the code out to a class
 * was the one person who couldn't see it.
 *
 * Read-only on purpose: only an admin can write a cohort doc, so there is no
 * regenerate button here that would fail against the rules.
 */
export function JoinCodePanel({ cohort }: { cohort: Cohort | null }) {
  const [copied, setCopied] = useState(false);

  if (!cohort) return null;

  const copy = () => {
    navigator.clipboard
      ?.writeText(cohort.joinCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      // Clipboard access can be denied (insecure origin, permissions) — the code is on screen regardless, so a failed copy is not worth an error state.
      .catch(() => undefined);
  };

  return (
    <div
      className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[4px] px-4 py-3.5"
      style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}
    >
      <div>
        <div
          style={{
            font: '500 10px/1 var(--font-mono)',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--ink3)',
          }}
        >
          Join code
        </div>
        <div className="mt-1.5" style={{ font: '500 26px/1 var(--font-mono)', letterSpacing: '.14em', color: 'var(--ink)' }}>
          {cohort.joinCode}
        </div>
      </div>

      <button
        type="button"
        onClick={copy}
        className="rounded-[3px] px-3 py-2"
        style={{
          font: '500 12.5px/1 var(--font-ui)',
          background: copied ? 'var(--accs)' : 'var(--pg)',
          color: copied ? 'var(--accd)' : 'var(--ink2)',
          border: '1.2px solid var(--line)',
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>

      <p className="min-w-0 flex-1 text-sm leading-relaxed" style={{ color: 'var(--ink3)', minWidth: 260 }}>
        Students enter this in their own account panel to join {cohort.name}. Joining is theirs to do and theirs to
        undo — they can leave at any time, which removes their data from these screens.
      </p>
    </div>
  );
}
