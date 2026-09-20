import { useCallback, useEffect, useState } from 'react';
import { AREAS, type Area } from '../types/region';
import { getFreeAreaChoice, setFreeAreaChoice } from '../lib/preferences';
import {
  FREE_ENTITLEMENT,
  canAccessArea,
  canSwitchFreeArea,
  daysUntilFreeAreaSwitch,
  effectiveTier,
  entitledAreas,
  freeAreasFor,
  lockedAreas,
  type Entitlement,
  type EntitlementTier,
  type FreeAreaChoice,
} from '../lib/entitlement';

/**
 * The one hook every gate uses. CR-027 item 1.
 *
 * WHY THE READ IS A DYNAMIC IMPORT. The entitlement lives on users/{uid},
 * which means the Firebase SDK, and a static import here would pull the whole
 * client into the public demo bundle — the trap that cost an afternoon earlier
 * in this project's history. Same pattern as CohortMembership.
 *
 * WHILE IT LOADS, AND IF IT FAILS, THE ANSWER IS `free`. Both are the same
 * decision and it is deliberate: an app that flashes paid content before
 * settling has already given it away, and one that unlocks everything when
 * Firestore is unreachable has a paywall that a flaky connection removes. The
 * cost is that a subscriber may briefly see a locked area on a bad connection,
 * which a reload fixes and which nobody loses money over.
 */

export interface UseEntitlement {
  entitlement: Entitlement;
  tier: EntitlementTier;
  /** True until the first read settles. Gates should not flicker on it — see the note above. */
  loading: boolean;
  canAccess: (area: Area) => boolean;
  locked: (allAreas: readonly Area[]) => Area[];
  /**
   * Every area this person may reach. The allow-list to clamp a session,
   * picker or drill to — see entitledAreas in lib/entitlement.ts.
   */
  areas: Area[];
  /** Which single area the free tier opens, and when it was picked. Null until they pick. */
  freeArea: FreeAreaChoice | null;
  /** Records the free area. Ignored if the 30 days are not up — the caller should check first. */
  chooseFreeArea: (area: Area) => void;
  /** Whether the free area may be changed now, and how long until it can be. */
  canSwitchFree: boolean;
  daysUntilSwitch: number;
  /**
   * Read again. For the pricing page after checkout: the webhook writes the
   * entitlement a few seconds after Paddle takes the payment, so the first read
   * usually finds nothing yet.
   */
  refresh: () => void;
}

export function useEntitlement(uid: string | null): UseEntitlement {
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);
  const [freeArea, setFreeArea] = useState<FreeAreaChoice | null>(() => getFreeAreaChoice());
  const [loading, setLoading] = useState(true);
  const [readCount, setReadCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setEntitlement(FREE_ENTITLEMENT);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    import('../data/entitlementRepository')
      .then(({ readEntitlement }) => readEntitlement(uid))
      .then((result) => {
        if (!cancelled) setEntitlement(result ?? FREE_ENTITLEMENT);
      })
      .catch(() => {
        // Unreachable is not the same as unentitled, but it has to resolve the
        // same way: a paywall that a dropped connection lifts is not a paywall.
        if (!cancelled) setEntitlement(FREE_ENTITLEMENT);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [uid, readCount]);

  const refresh = useCallback(() => setReadCount((n) => n + 1), []);

  const chooseFreeArea = useCallback((area: Area) => {
    setFreeArea((current) => {
      if (!canSwitchFreeArea(current)) return current;
      setFreeAreaChoice(area);
      return getFreeAreaChoice();
    });
  }, []);

  const free = freeAreasFor(freeArea);

  return {
    entitlement,
    tier: effectiveTier(entitlement),
    loading,
    canAccess: (area) => canAccessArea(area, entitlement, new Date(), free),
    locked: (allAreas) => lockedAreas(allAreas, entitlement, new Date(), free),
    areas: entitledAreas(AREAS, entitlement, new Date(), free),
    freeArea,
    chooseFreeArea,
    canSwitchFree: canSwitchFreeArea(freeArea),
    daysUntilSwitch: daysUntilFreeAreaSwitch(freeArea),
    refresh,
  };
}
