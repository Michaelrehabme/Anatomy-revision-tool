import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import type { Cohort } from '../types/cohort';
import { getCohort } from './cohortsRepository';

/**
 * Bulk invitations to a class.
 *
 * WHY INVITE RATHER THAN ADD. A course leader with forty students should not
 * have to chase forty people to type a code, and asked for exactly that.
 * But the consent model is the thing that makes an educator seeing a named
 * student's accuracy lawful and honest: firestore.rules says an educator sees
 * a student only once that student has joined, the join notice says the same,
 * and the privacy policy promises it. Adding students directly would make all
 * three false at once, and would move the lawful basis from the student's own
 * choice to something requiring an institutional contract that does not yet
 * exist.
 *
 * So an invitation is a pending offer, not membership. The educator does the
 * bulk work; the student accepts in one tap and sees what the class owner will
 * be able to see before they do. Nothing about their data is visible until
 * they accept — an unaccepted invitation is a row containing an email address
 * the educator already had.
 *
 * ADDRESSED BY EMAIL, KEYED BY EMAIL. The document id is derived from the
 * address so inviting the same person twice updates one row rather than
 * creating two, and so a student can find their own invitations with a query
 * on a field the rules can check against their verified token.
 */

export interface CohortInvite {
  id: string;
  cohortId: string;
  cohortName: string;
  /** Normalised — always lowercase and trimmed. */
  email: string;
  invitedByUid: string;
  invitedByName: string | null;
  createdAt: string;
}

/** Lowercased and trimmed. Addresses are case-insensitive in practice, and a student who types theirs with a capital should still match. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Document id for an (email, cohort) pair.
 *
 * An address cannot be a Firestore document id as-is: ids may not contain "/",
 * may not be "." or "..", and are capped at 1500 bytes. Encoding rather than
 * hashing keeps the id readable in the console, which matters when an educator
 * asks why someone did not receive an invitation.
 */
export function inviteId(email: string, cohortId: string): string {
  return `${normalizeEmail(email).replace(/[/.]/g, '_')}__${cohortId}`;
}

/**
 * Splits a pasted block into addresses.
 *
 * Educators paste from a spreadsheet column, a mail client's To: field, or a
 * register — so commas, semicolons, tabs, newlines and "Name <addr>" all turn
 * up. Anything that does not look like an address is returned separately
 * rather than silently dropped, because a typo in a student's email is a
 * student who never hears about the class and never appears in the dashboard.
 */
export function parseEmailList(raw: string): { emails: string[]; invalid: string[] } {
  const parts = raw
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    // "Amara Okafor <a.okafor@example.ac.uk>" pastes as two tokens; the
    // address is the one in the angle brackets.
    .map((p) => p.replace(/^.*<|>.*$/g, ''))
    .filter(Boolean);

  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const email = normalizeEmail(part);
    // Deliberately loose. Address syntax is famously baroque and a stricter
    // pattern rejects real institutional addresses; this catches the paste
    // that went wrong, not the address that is unusual.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      invalid.push(part);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return { emails, invalid };
}

/** Firestore caps a batch at 500; a year group fits comfortably, but chunking costs nothing. */
const BATCH_LIMIT = 400;

export interface InviteResult {
  created: number;
  alreadyInvited: number;
  alreadyMembers: string[];
  invalid: string[];
}

/**
 * Invites everyone in the list who is not already in the class.
 *
 * Idempotent: re-pasting the same list produces no duplicates, which matters
 * because the natural way to add three late enrolments is to paste the whole
 * register again.
 */
export async function inviteToCohort(
  cohort: Cohort,
  rawEmails: string,
  invitedBy: { uid: string; name: string | null },
  existingMemberEmails: string[] = [],
): Promise<InviteResult> {
  const db = getDb();
  const { emails, invalid } = parseEmailList(rawEmails);
  const members = new Set(existingMemberEmails.map(normalizeEmail));

  const existing = await listInvitesForCohort(cohort.id);
  const invited = new Set(existing.map((i) => i.email));

  const alreadyMembers: string[] = [];
  const toCreate: string[] = [];
  for (const email of emails) {
    if (members.has(email)) alreadyMembers.push(email);
    else if (!invited.has(email)) toCreate.push(email);
  }

  for (let i = 0; i < toCreate.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const email of toCreate.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, 'invites', inviteId(email, cohort.id)), {
        cohortId: cohort.id,
        cohortName: cohort.name,
        email,
        invitedByUid: invitedBy.uid,
        invitedByName: invitedBy.name,
        createdAt: new Date().toISOString(),
        createdAtServer: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return {
    created: toCreate.length,
    alreadyInvited: emails.length - toCreate.length - alreadyMembers.length,
    alreadyMembers,
    invalid,
  };
}

function toInvite(id: string, data: Record<string, unknown>): CohortInvite {
  return {
    id,
    cohortId: String(data.cohortId ?? ''),
    cohortName: String(data.cohortName ?? ''),
    email: String(data.email ?? ''),
    invitedByUid: String(data.invitedByUid ?? ''),
    invitedByName: typeof data.invitedByName === 'string' ? data.invitedByName : null,
    createdAt: String(data.createdAt ?? ''),
  };
}

/** Outstanding invitations for a class — the educator's view of who has not accepted yet. */
export async function listInvitesForCohort(cohortId: string): Promise<CohortInvite[]> {
  const snapshot = await getDocs(query(collection(getDb(), 'invites'), where('cohortId', '==', cohortId)));
  return snapshot.docs.map((d) => toInvite(d.id, d.data()));
}

/**
 * Invitations addressed to one person.
 *
 * The query filters on the same field the rules check against the caller's
 * token, so it can only ever return their own — a query for somebody else's
 * address fails the rule and the whole read is refused rather than filtered.
 */
export async function listInvitesForEmail(email: string): Promise<CohortInvite[]> {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  const snapshot = await getDocs(query(collection(getDb(), 'invites'), where('email', '==', normalized)));
  return snapshot.docs.map((d) => toInvite(d.id, d.data()));
}

/** Educator revoking, or a student declining. Both are a delete; the difference is who is allowed to do it. */
export async function deleteInvite(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'invites', id));
}

/**
 * Accepting: joins the class, then clears the invitation.
 *
 * Same write as joining by code — users/{uid}.cohort — because an invitation
 * is a different route to the same consent, not a different kind of
 * membership. Leaving afterwards works exactly as it always did.
 *
 * The invite is deleted after the join rather than before, so a failure
 * part-way leaves the invitation still standing and retryable instead of
 * silently lost.
 */
export async function acceptInvite(invite: CohortInvite, uid: string): Promise<Cohort | null> {
  const db = getDb();
  // cohortInviteId is the evidence firestore.rules checks: it must name an
  // invitation for this cohort addressed to this account's verified email.
  // The invite is deleted immediately after, so the field is a spent ticket
  // rather than a standing permission.
  await setDoc(
    doc(db, 'users', uid),
    {
      cohort: invite.cohortId,
      cohortJoinedAt: new Date().toISOString(),
      cohortInviteId: invite.id,
    },
    { merge: true },
  );
  await deleteInvite(invite.id);
  return getCohort(invite.cohortId);
}

/** True when the invitation still exists — used to avoid showing a stale offer the educator has since revoked. */
export async function inviteStillOpen(id: string): Promise<boolean> {
  const snapshot = await getDoc(doc(getDb(), 'invites', id));
  return snapshot.exists();
}
