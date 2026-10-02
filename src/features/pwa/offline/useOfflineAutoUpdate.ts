import { useEffect } from 'react';
import type { UseEntitlement } from '../../anatomy-revision/hooks/useEntitlement';

/**
 * Applies small updates to downloaded areas once it is known what this
 * account may reach. Mounted once, in App, beside the entitlement it reads.
 *
 * IT WAITS FOR THE ENTITLEMENT RATHER THAN GUESSING. An update fetches
 * pictures, and fetching pictures for an area is the thing the paywall
 * forbids a lapsed account — so nothing runs while the first read is still
 * out. If that read fails the hook reports `free` (useEntitlement explains
 * why), which here means the paid areas are simply left marked "Update
 * available": the safe direction to be wrong in.
 *
 * IT RUNS AGAIN WHEN THE ANSWER CHANGES. Before sign-in has settled there is
 * no account to read, and the hook already answers `free`; a subscriber's real
 * entitlement arrives a moment later. Keyed on the list of areas, the second
 * pass picks up what the first was not allowed to touch. An area already
 * current is skipped, so the repeat costs nothing.
 *
 * The controller is imported dynamically — it is not in the entry chunk — and
 * never in the public demo, which has no service worker to download for.
 */
export function useOfflineAutoUpdate(access: UseEntitlement): void {
  const { loading, canAccess } = access;
  const areasKey = access.areas.join(',');

  useEffect(() => {
    if (import.meta.env.VITE_PUBLIC_DEMO === '1' || loading) return;
    let cancelled = false;
    void Promise.all([import('./offlineController'), import('./autoUpdate')])
      .then(([{ offlineController }, { saveDataRequested }]) => {
        if (cancelled) return;
        return offlineController().autoApplyUpdates({
          canAccess,
          saveData: saveDataRequested(),
          online: typeof navigator === 'undefined' || navigator.onLine !== false,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // canAccess is a new function every render; areasKey is what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, areasKey]);
}
