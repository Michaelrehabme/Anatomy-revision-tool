import { useCallback, useEffect, useRef, useState } from 'react';
import { AREAS, type Area } from '../types/region';
import { getFreeAreaChoice, setFreeAreaChoice } from '../lib/preferences';
import {
  FREE_ENTITLEMENT,
  canAccessArea,
  canSwitchFreeArea,
  daysUntilFreeAreaSwitch,
  hasUsedFreeAreaSwitch,
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
  /** True once the single permitted change has been used: only a subscription opens more. */
  switchUsed: boolean;
  /**
   * Read again. For the pricing page after checkout: the webhook writes the
   * entitlement a few seconds after Paddle takes the payment, so the first read
   * usually finds nothing yet.
   */
  refresh: () => void;
}

/**
 * One signal every mounted copy of the hook listens to.
 *
 * Each screen holds its own copy of the entitlement: App reads it once per
 * account for every gate, and the pricing page runs another to poll after
 * checkout. Refreshing only the pricing page's copy meant it said "You have
 * full access" while the Atlas, Study and every card stayed locked until a
 * reload — the paywall trace's finding 4 (docs/PAYWALL-TRACE-2026-09-29.md).
 * A refresh anywhere now re-reads everywhere.
 */
const refreshSignal = new EventTarget();

/**
 * Re-read the entitlement in every screen that holds one: after checkout, and
 * after joining or leaving a class, whose licence can open every area.
 */
export function refreshEntitlementEverywhere(): void {
  refreshSignal.dispatchEvent(new Event('refresh'));
}

/** Coming back to the app re-reads, but not more than once a minute. */
const VISIBLE_REREAD_MS = 60_000;

export function useEntitlement(uid: string | null): UseEntitlement {
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);
  const [freeArea, setFreeArea] = useState<FreeAreaChoice | null>(() => getFreeAreaChoice());
  const [loading, setLoading] = useState(true);
  const [readCount, setReadCount] = useState(0);
  const settledFor = useRef<string | null>(null);

  useEffect(() => {
    const onRefresh = () => {
      setReadCount((n) => n + 1);
      setFreeArea(getFreeAreaChoice());
    };
    let lastVisibleRead = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastVisibleRead < VISIBLE_REREAD_MS) return;
      lastVisibleRead = Date.now();
      onRefresh();
    };
    refreshSignal.addEventListener('refresh', onRefresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      refreshSignal.removeEventListener('refresh', onRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      setEntitlement(FREE_ENTITLEMENT);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Only the first read for an account shows as loading. A re-read keeps
    // the current answer on screen until the new one arrives, so a refresh
    // never flickers a gate.
    const firstRead = settledFor.current !== uid;
    if (firstRead) setLoading(true);

    import('../data/entitlementRepository')
      .then(({ readEntitlement }) => readEntitlement(uid))
      .then((result) => {
        if (!cancelled) setEntitlement(result ?? FREE_ENTITLEMENT);
      })
      .catch(() => {
        // Unreachable is not the same as unentitled, but on a first read it has
        // to resolve the same way: a paywall that a dropped connection lifts is
        // not a paywall. A failed RE-read keeps what was already read, so a
        // flaky connection never drops a paying student back to free.
        if (!cancelled && firstRead) setEntitlement(FREE_ENTITLEMENT);
      })
      .finally(() => {
        if (cancelled) return;
        settledFor.current = uid;
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [uid, readCount]);

  const refresh = useCallback(() => refreshEntitlementEverywhere(), []);

  const chooseFreeArea = useCallback((area: Area) => {
    setFreeArea((current) => {
      if (!canSwitchFreeArea(current)) return current;
      // The first pick is not a switch; every later one is, and there is only
      // one of those — see FREE_AREA_SWITCHES_ALLOWED.
      setFreeAreaChoice(area, current ? current.switches + 1 : 0);
      return getFreeAreaChoice();
    });
    // Every other screen's copy picks up the new free area too.
    queueMicrotask(refreshEntitlementEverywhere);
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
    switchUsed: hasUsedFreeAreaSwitch(freeArea),
    refresh,
  };
}
