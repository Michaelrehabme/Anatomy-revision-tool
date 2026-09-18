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

  if (Array.isArray(raw)) {
    const parsed = raw.map(parse).filter((e): e is Entitlement => e !== null);
    return parsed.length > 0 ? resolveEntitlement(parsed) : null;
  }
  return parse(raw);
}
