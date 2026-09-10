import type { Cohort } from '../types/cohort';

/**
 * Demo-mode stand-in for data/invitesRepository.ts (README "Educator demo
 * mode").
 *
 * It exists for the same reason every other module in this folder does: the
 * real one imports getDb, and the demo build must not contain the Firebase
 * SDK at all. vite.config.demo.ts pins persistence to 'local' as a hard
 * guarantee the public demo cannot reach a real project — but that guarantee
 * only holds if nothing drags the client in through a side door, and a shared
 * component importing this repository is exactly such a door.
 *
 * State lives in a module-level array, so invitations sent during a demo
 * persist while the page is open and vanish on reload. That is the right
 * lifetime for a demo: a course leader can paste a list, watch the pending
 * count appear, and cancel one, without anything being written anywhere.
 */

export interface CohortInvite {
  id: string;
  cohortId: string;
  cohortName: string;
  email: string;
  invitedByUid: string;
  invitedByName: string | null;
  createdAt: string;
}

export interface InviteResult {
  created: number;
  alreadyInvited: number;
  alreadyMembers: string[];
  invalid: string[];
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function inviteId(email: string, cohortId: string): string {
  return `${normalizeEmail(email).replace(/[/.]/g, '_')}__${cohortId}`;
}

/** Identical to the real parser — duplicated rather than imported so this module pulls in nothing. */
export function parseEmailList(raw: string): { emails: string[]; invalid: string[] } {
  const parts = raw
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/^.*<|>.*$/g, ''))
    .filter(Boolean);

  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const email = normalizeEmail(part);
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

let invites: CohortInvite[] = [];

export async function inviteToCohort(
  cohort: Cohort,
  rawEmails: string,
  invitedBy: { uid: string; name: string | null },
  existingMemberEmails: string[] = [],
): Promise<InviteResult> {
  const { emails, invalid } = parseEmailList(rawEmails);
  const members = new Set(existingMemberEmails.map(normalizeEmail));
  const already = new Set(invites.filter((i) => i.cohortId === cohort.id).map((i) => i.email));

  const alreadyMembers: string[] = [];
  const toCreate: string[] = [];
  for (const email of emails) {
    if (members.has(email)) alreadyMembers.push(email);
    else if (!already.has(email)) toCreate.push(email);
  }

  invites = [
    ...invites,
    ...toCreate.map((email) => ({
      id: inviteId(email, cohort.id),
      cohortId: cohort.id,
      cohortName: cohort.name,
      email,
      invitedByUid: invitedBy.uid,
      invitedByName: invitedBy.name,
      createdAt: new Date().toISOString(),
    })),
  ];

  return {
    created: toCreate.length,
    alreadyInvited: emails.length - toCreate.length - alreadyMembers.length,
    alreadyMembers,
    invalid,
  };
}

export async function listInvitesForCohort(cohortId: string): Promise<CohortInvite[]> {
  return invites.filter((i) => i.cohortId === cohortId);
}

/**
 * Always empty. The demo signs in as the educator, so showing them an
 * invitation addressed to themselves would be nonsense — and a demo that
 * invents a pending invite teaches a course leader to expect one.
 */
export async function listInvitesForEmail(): Promise<CohortInvite[]> {
  return [];
}

export async function deleteInvite(id: string): Promise<void> {
  invites = invites.filter((i) => i.id !== id);
}

export async function acceptInvite(): Promise<Cohort | null> {
  return null;
}

export async function inviteStillOpen(id: string): Promise<boolean> {
  return invites.some((i) => i.id === id);
}
