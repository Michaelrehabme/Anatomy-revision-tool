import type { Entitlement, FreeAreaChoice } from '../../anatomy-revision/lib/entitlement';
import type { Area } from '../../anatomy-revision/types/region';
import type { StoredAccess } from '../../anatomy-revision/lib/entitlementRecord';

/**
 * Demo stand-in for anatomy-revision/data/entitlementRepository.
 *
 * TWO REASONS THIS EXISTS, and the second is the one that matters.
 *
 * The real module imports firebase/firestore, and the public demo must not
 * contain the SDK. Today nothing reaches it, so the demo bundle is clean by
 * accident; the moment useEntitlement is wired into a gate the dynamic chunk
 * gets built and the SDK goes with it. Aliasing it now means that wiring
 * cannot quietly reintroduce the leak.
 *
 * And a demo with a paywall in it argues against the product it exists to
 * sell. A course leader clicking through should see everything, so this hands
 * back a full institutional entitlement that never expires — which is also an
 * honest description of what a licensed cohort actually gets.
 */

const DEMO_ENTITLEMENT: Entitlement = {
  tier: 'institutional',
  source: 'licence',
  expiresAt: null,
  seatId: 'demo-seat',
};

export async function readEntitlement(): Promise<Entitlement> {
  return DEMO_ENTITLEMENT;
}

/**
 * The demo's educator holds a licence, so the teaching tools are open: a demo
 * that showed "teaching tools need full access" would be a demo of nothing.
 */
export async function readOwnFullAccess(): Promise<boolean> {
  return true;
}

/** No stored free area: the demo is local-persistence, where the choice stays on the device. */
export async function readAccess(): Promise<StoredAccess> {
  return { entitlement: DEMO_ENTITLEMENT, freeArea: null };
}

/** Never reached — useEntitlement keeps the choice on the device in a local-persistence build. */
export async function saveFreeArea(_uid: string, area: Area, switches: 0 | 1): Promise<FreeAreaChoice> {
  return { area, chosenAt: new Date().toISOString(), switches };
}
