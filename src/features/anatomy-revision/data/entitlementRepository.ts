import { doc, getDoc } from 'firebase/firestore';
import { getDb } from './firebase';
import { resolveEntitlement, type Entitlement, type EntitlementTier, type EntitlementSource } from '../lib/entitlement';

/**
 * Reading the entitlement off users/{uid}. READ ONLY, and permanently so.
 *
 * There is no write here and there must never be one. firestore.rules requires
 * `entitlement` to be byte-identical across any client update, so a write from
 * this file would be refused — but the more important reason is that somebody
 * looking for "where do we grant access" should find nothing in the client at
 * all. Granting happens in a payment webhook through the Admin SDK, which
 * bypasses rules, and that is the only place it happens.
 *
 * Arrays are supported because a person can hold two: their own subscription
 * and a seat on their university's licence. lib/entitlement decides which wins.
 */

const TIERS: EntitlementTier[] = ['free', 'individual', 'institutional'];
const SOURCES: EntitlementSource[] = ['paddle', 'apple', 'google', 'licence', 'complimentary'];

/**
 * A stored value is only an entitlement if it says so in terms this build
 * recognises. An unknown tier reads as nothing rather than as access: the
 * failure mode of a typo, a half-finished migration or a future tier this
 * version has never heard of should be a locked door, not an open one.
 */
function parse(raw: unknown): Entitlement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const tier = r.tier as EntitlementTier;
  if (!TIERS.includes(tier)) return null;

  const source = SOURCES.includes(r.source as EntitlementSource) ? (r.source as EntitlementSource) : null;
  const expiresAt = typeof r.expiresAt === 'string' ? r.expiresAt : null;

  return {
    tier,
    source,
    expiresAt,
    ...(typeof r.startsAt === 'string' ? { startsAt: r.startsAt } : {}),
    ...(typeof r.seatId === 'string' ? { seatId: r.seatId } : {}),
    ...(typeof r.externalId === 'string' ? { externalId: r.externalId } : {}),
  };
}

/**
 * The entitlement a licensed cohort gives its members (CR-027's institutional
 * tier), or null when the student is in no cohort or an unlicensed one.
 *
 * DERIVED, NOT STORED, and deliberately so. A pilot cohort's students arrive
 * over weeks — some on the first day, some in week six — and a stored grant
 * would mean a server write per student per join, which is a queue of things
 * to go wrong before a course lead's first lecture. Membership already proves
 * itself: firestore.rules refuses a change to `cohort` that arrives without a
 * join code or an invitation, and pins `licensedUntil` against the educator
 * who owns the cohort. So this reads two documents the student is already
 * allowed to read and believes what they say.
 *
 * The seat id is the cohort id: there are no numbered seats yet, and a pilot
 * does not need them. When licences are sold by seat count this is where that
 * accounting goes.
 */
async function readCohortLicence(uid: string): Promise<Entitlement | null> {
  const userSnap = await getDoc(doc(getDb(), 'users', uid));
  const cohortId = userSnap.exists() ? (userSnap.data().cohort as string | null) : null;
  if (!cohortId) return null;

  const cohortSnap = await getDoc(doc(getDb(), 'cohorts', cohortId));
  if (!cohortSnap.exists()) return null;

  const licensedUntil = cohortSnap.data().licensedUntil;
  if (typeof licensedUntil !== 'string') return null;

  return {
    tier: 'institutional',
    source: 'licence',
    expiresAt: licensedUntil,
    seatId: cohortId,
  };
}

/**
 * The entitlement in force for this user, or null when they have none.
 *
 * Throws on a failed read rather than returning null, so the caller can tell
 * "no entitlement" from "could not find out". useEntitlement treats both as
 * free, but it does so knowingly — a repository that swallowed the difference
 * would take that choice away from every future caller.
 */
export async function readEntitlement(uid: string): Promise<Entitlement | null> {
  const snapshot = await getDoc(doc(getDb(), 'users', uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Record<string, unknown>;
  const raw = data.entitlement;

  const stored = Array.isArray(raw)
    ? raw.map(parse).filter((e): e is Entitlement => e !== null)
    : [parse(raw)].filter((e): e is Entitlement => e !== null);

  // A student can hold both: their own subscription and a seat on their
  // university's licence. resolveEntitlement picks the one that wins rather
  // than merging them — see lib/entitlement.ts.
  const licence = await readCohortLicence(uid);
  const all = licence ? [...stored, licence] : stored;

  return all.length > 0 ? resolveEntitlement(all) : null;
}
