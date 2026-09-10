import { useEffect, useState } from 'react';
import {
  deleteInvite,
  inviteToCohort,
  listInvitesForCohort,
  parseEmailList,
  type CohortInvite,
  type InviteResult,
} from '../../data/invitesRepository';
import { getCohort } from '../../data/cohortsRepository';
import { useAuth } from '../../../anatomy-revision/context/AuthProvider';

/**
 * Bulk invitations, for a course leader with a year group rather than three
 * students.
 *
 * INVITE, NOT ADD, and the wording says so plainly. The temptation is to
 * present this as "add students" because that is what it feels like from the
 * educator's side, but it would set the wrong expectation: the list appears
 * under "invited", not "students", until each person accepts. An educator who
 * thinks they have added forty people and sees an empty dashboard will
 * conclude the product is broken.
 */

interface InviteStudentsPanelProps {
  cohortId: string;
  /** Already-joined students, so re-pasting a full register does not re-invite them. */
  memberEmails: string[];
  onInvited?: () => void;
}

export function InviteStudentsPanel({ cohortId, memberEmails, onInvited }: InviteStudentsPanelProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<CohortInvite[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listInvitesForCohort(cohortId)
      .then((invites) => {
        if (!cancelled) setPending(invites);
      })
      .catch(() => {
        if (!cancelled) setPending([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cohortId]);

  // Live count as they paste, so the size of what they are about to do is
  // visible before they commit to it.
  const preview = parseEmailList(raw);

  async function handleInvite() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const cohort = await getCohort(cohortId);
      if (!cohort) throw new Error('That class no longer exists.');
      const outcome = await inviteToCohort(
        cohort,
        raw,
        { uid: user.uid, name: user.displayName ?? null },
        memberEmails,
      );
      setResult(outcome);
      setRaw('');
      setPending(await listInvitesForCohort(cohortId));
      onInvited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send those invitations.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(invite: CohortInvite) {
    await deleteInvite(invite.id).catch(() => {});
    setPending((current) => (current ?? []).filter((i) => i.id !== invite.id));
  }

  /*
   * Telling students they have been invited.
   *
   * Sending mail ourselves would mean Cloud Functions, a billing account and
   * SPF/DKIM on the domain before anything reliably reaches an inbox — and it
   * would arrive from an address the student has never seen. Opening the
   * educator's own mail client instead needs none of that, and the invitation
   * comes from the university address the student already trusts, which is
   * the thing that actually gets it opened.
   *
   * Addresses go in BCC so a year group does not see each other's emails.
   */
  const mailtoFor = (invites: CohortInvite[]) => {
    const subject = `Anatomy revision for ${invites[0]?.cohortName ?? 'your class'}`;
    const body = [
      `I've set up ${invites[0]?.cohortName ?? 'our class'} on LocusMSK, a musculoskeletal anatomy revision tool.`,
      '',
      'To join:',
      '1. Go to https://locusmsk.co.uk',
      '2. Create an account with this email address',
      '3. Open Account — the invitation will be waiting, and you can accept it there',
      '',
      "You'll see your own progress. I can see your accuracy, streak and which structures the group finds hardest —",
      'never your individual answers. You can leave the class at any time.',
    ].join('\n');

    return `mailto:?bcc=${encodeURIComponent(invites.map((i) => i.email).join(','))}` +
      `&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  async function copyAddresses(invites: CohortInvite[]) {
    await navigator.clipboard?.writeText(invites.map((i) => i.email).join(', ')).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const label = { font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'var(--ink3)' };

  return (
    <section className="mt-8" style={{ maxWidth: 640 }}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 style={{ ...label, margin: 0 }}>
          Invitations{pending && pending.length > 0 ? ` · ${pending.length} awaiting reply` : ''}
        </h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--accd)' }}
        >
          {open ? 'Close' : 'Invite students'}
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <p style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink2)', margin: 0 }}>
            Paste email addresses — from a spreadsheet column, a register, or a To: field. Each student is sent an
            invitation and joins when they accept it, so they see what you will be able to see first.
          </p>

          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={5}
            placeholder={'a.okafor@uni.ac.uk\nb.shah@uni.ac.uk'}
            aria-label="Email addresses to invite"
            className="mt-3 w-full p-3"
            style={{
              font: '400 13px/1.6 var(--font-mono)',
              border: '1.2px solid var(--line-strong)',
              background: 'var(--pg)',
              color: 'var(--ink)',
              resize: 'vertical',
            }}
          />

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleInvite}
              disabled={busy || preview.emails.length === 0}
              style={{
                font: '500 13px/1 var(--font-ui)',
                padding: '9px 14px',
                background: preview.emails.length > 0 ? 'var(--acc-fill)' : 'var(--fig-off)',
                color: preview.emails.length > 0 ? 'var(--onacc)' : 'var(--ink3)',
                cursor: preview.emails.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {busy
                ? 'Inviting…'
                : preview.emails.length === 0
                  ? 'Invite'
                  : `Invite ${preview.emails.length} student${preview.emails.length === 1 ? '' : 's'}`}
            </button>

            {preview.invalid.length > 0 && (
              <span style={{ font: '400 12.5px/1.4 var(--font-ui)', color: 'var(--acc2d)' }}>
                {preview.invalid.length} could not be read: {preview.invalid.slice(0, 3).join(', ')}
                {preview.invalid.length > 3 ? '…' : ''}
              </span>
            )}
          </div>

          {result && (
            <div
              className="mt-3 p-3"
              role="status"
              style={{ font: '400 13px/1.5 var(--font-ui)', background: 'var(--accs)', color: 'var(--ink2)' }}
            >
              Invited {result.created}.
              {result.alreadyInvited > 0 && ` ${result.alreadyInvited} had already been invited.`}
              {result.alreadyMembers.length > 0 && ` ${result.alreadyMembers.length} are already in the class.`}
              {result.invalid.length > 0 && ` ${result.invalid.length} could not be read.`}
            </div>
          )}

          {error && (
            <div className="mt-3" role="alert" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
              {error}
            </div>
          )}
        </div>
      )}

      {pending && pending.length > 0 && (
        <div className="mt-4">
          {/* mailto has a practical URL length limit and a large year group can
              exceed it, so copying the addresses is offered alongside rather
              than as a fallback nobody finds. */}
          <div
            className="mb-3 flex flex-wrap items-center gap-3 p-3"
            style={{ background: 'var(--accs)' }}
          >
            <span style={{ font: '400 13px/1.4 var(--font-ui)', color: 'var(--ink2)', flex: '1 1 200px' }}>
              {pending.length} {pending.length === 1 ? 'person has' : 'people have'} not accepted yet. They will see the
              invitation when they next open the app — emailing them is what makes that happen sooner.
            </span>
            <a
              href={mailtoFor(pending)}
              style={{
                font: '500 13px/1 var(--font-ui)',
                padding: '9px 13px',
                background: 'var(--acc-fill)',
                color: 'var(--onacc)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Email them
            </a>
            <button
              type="button"
              onClick={() => copyAddresses(pending)}
              style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--accd)', whiteSpace: 'nowrap' }}
            >
              {copied ? 'Copied' : 'Copy addresses'}
            </button>
          </div>
          {/* Shown whether or not the composer is open: an educator wondering
              why the dashboard is empty needs to see that forty invitations
              are outstanding, without having to go looking. */}
          {pending.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between gap-4 py-2"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <span style={{ font: '400 13px/1.3 var(--font-mono)', color: 'var(--ink2)' }}>{invite.email}</span>
              <button
                type="button"
                onClick={() => handleRevoke(invite)}
                style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)' }}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
