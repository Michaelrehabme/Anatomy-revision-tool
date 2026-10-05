import { useCallback, useEffect, useRef, useState } from 'react';
import { AREAS, type Area } from '../types/region';
import { getFreeAreaChoice, setFreeAreaChoice, storeFreeAreaChoice } from '../lib/preferences';
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
import { switchesToMigrate } from '../lib/freeAreaRecord';

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
 *
 * THE FREE AREA LIVES ON THE ACCOUNT (docs/DESIGN-CONTENT-BEHIND-SERVER.md,
 * step 1). It used to live on the device alone, so a second device or a
 * cleared browser gave a fresh choice with unlimited changes, and a server
 * asked for "this account's free area" had nothing to look at. Now
 * users/{uid}.freeArea is the answer, firestore.rules keeps it to one choice
 * and one change, and the device holds only a COPY — there so the first paint
 * and an offline start show the right area without waiting on a read.
 *
 *   - The account has a choice: it wins, and the device copy is overwritten.
 *   - The account has none and the device does: the device's is MOVED UP,
 *     once. It arrives with today's date, not the date it was first picked —
 *     the rules accept no client date, or a "migration" would be a way to
 *     backdate a choice and change it the same minute. So a student who chose
 *     on the device three weeks ago waits thirty days from the move, not nine.
 *   - The account could not be read: the device copy stands, as before.
 *
 * A LOCAL-PERSISTENCE BUILD (the demo, the tests, `npm run dev` with no
 * Firebase project) has no account to keep it on, and keeps the device store
 * exactly as it was.
 */

/** Whether this build keeps the free area on the account. Read per call, so a test can set the mode. */
export function freeAreaIsOnTheAccount(): boolean {
  return (import.meta.env.VITE_PERSISTENCE ?? 'local') === 'firestore';
}

export interface UseEntitlement {
  entitlement: Entitlement;
  tier: EntitlementTier;
  /** True until the first read settles. Gates should not flicker on it — see the note above. */
  loading: boolean;
  /**
   * Whether the answer above was actually read. False while loading and after
   * a read that failed, when `free` is a precaution rather than a finding.
   * Anything that DESTROYS on the strength of "not entitled" — the cached
   * facts of an area (data/content/useAreaFacts.ts) — must check this first:
   * a train tunnel is not a cancelled subscription.
   */
  known?: boolean;
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
  const [freeArea, setFreeAreaState] = useState<FreeAreaChoice | null>(() => getFreeAreaChoice());
  const [loading, setLoading] = useState(true);
  const [known, setKnown] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const settledFor = useRef<string | null>(null);

  // The current choice, for chooseFreeArea to read without being rebuilt on
  // every change (it is handed to buttons as a prop).
  const freeAreaRef = useRef(freeArea);
  const setFreeArea = useCallback((next: FreeAreaChoice | null) => {
    freeAreaRef.current = next;
    setFreeAreaState(next);
  }, []);

  useEffect(() => {
    const onRefresh = () => {
      setReadCount((n) => n + 1);
      // On the device the store IS the answer, and another screen may have
      // just written it. On the account the re-read above brings it back.
      if (!freeAreaIsOnTheAccount()) setFreeArea(getFreeAreaChoice());
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
  }, [setFreeArea]);

  useEffect(() => {
    if (!uid) {
      setEntitlement(FREE_ENTITLEMENT);
      setKnown(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Only the first read for an account shows as loading. A re-read keeps
    // the current answer on screen until the new one arrives, so a refresh
    // never flickers a gate.
    const firstRead = settledFor.current !== uid;
    if (firstRead) {
      setLoading(true);
      setKnown(false);
    }

    import('../data/entitlementRepository')
      .then(async ({ readAccess, saveFreeArea }) => {
        const stored = await readAccess(uid);
        if (cancelled) return;
        setEntitlement(stored.entitlement ?? FREE_ENTITLEMENT);
        setKnown(true);

        if (!freeAreaIsOnTheAccount()) return;
        if (stored.freeArea) {
          setFreeArea(stored.freeArea);
          storeFreeAreaChoice(stored.freeArea);
          return;
        }
        // Nothing on the account. If this device holds a choice it is moved
        // up — see the header. Not awaited: offline, Firestore holds the write
        // until it can ask, and the gates must not wait on that. Until it
        // lands the device copy stands, which is what this account has had
        // all along.
        const onDevice = getFreeAreaChoice();
        setFreeArea(onDevice);
        if (!onDevice) return;
        saveFreeArea(uid, onDevice.area, switchesToMigrate(onDevice))
          .then((moved) => {
            storeFreeAreaChoice(moved);
            if (!cancelled) setFreeArea(moved);
          })
          .catch(() => {
            // Refused (another device moved a choice up first) or unreachable.
            // The next read says which, and brings the account's answer back.
          });
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
  }, [uid, readCount, setFreeArea]);

  const refresh = useCallback(() => refreshEntitlementEverywhere(), []);

  const chooseFreeArea = useCallback((area: Area) => {
    const current = freeAreaRef.current;
    if (!canSwitchFreeArea(current)) return;
    // The first pick is not a switch; every later one is, and there is only
    // one of those — see FREE_AREA_SWITCHES_ALLOWED.
    const switches = current ? current.switches + 1 : 0;

    // Shown at once either way. On the account the device copy is only a
    // copy, and the rules have the last word: if they refuse the write, the
    // re-read below puts the account's own answer back on screen.
    setFreeAreaChoice(area, switches);
    setFreeArea(getFreeAreaChoice());

    if (freeAreaIsOnTheAccount() && uid) {
      import('../data/entitlementRepository')
        .then(({ saveFreeArea }) => saveFreeArea(uid, area, switches >= 1 ? 1 : 0))
        .then((saved) => {
          storeFreeAreaChoice(saved);
          setFreeArea(saved);
        })
        .catch((error) => console.error('The free area was not saved to the account:', error))
        // Every other screen's copy picks it up once the account has it. Not
        // before: a re-read racing the write would find the old choice and
        // flick the screen back to it.
        .finally(refreshEntitlementEverywhere);
      return;
    }
    // Every other screen's copy picks up the new free area too.
    queueMicrotask(refreshEntitlementEverywhere);
  }, [uid, setFreeArea]);

  const free = freeAreasFor(freeArea);

  // An account whose first read has not finished is still loading, FROM THE
  // RENDER IT ARRIVES IN. The effect above sets `loading` a moment later, and
  // for that one render in between the hook used to report a settled answer
  // of "free" for an account nobody had asked about yet. Harmless while gates
  // only drew from it; not harmless once something FETCHES on a settled
  // answer — the content loader asked the server for the free area of an
  // account before its entitlement had been read, then asked again.
  const unread = uid !== null && settledFor.current !== uid;

  return {
    entitlement,
    tier: effectiveTier(entitlement),
    loading: loading || unread,
    known: known && !unread,
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
