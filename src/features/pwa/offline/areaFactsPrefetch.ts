import type { Area } from '../../anatomy-revision/types/region';
import { BUNDLED_CONTENT } from '../../anatomy-revision/data/content/bundledContent';
import { CONTENT_LEASE_DAYS } from '../../anatomy-revision/data/content/lease';

/**
 * The FACTS half of an offline download
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, "Offline").
 *
 * A downloaded area used to be its pictures, because the facts were in the
 * bundle and so already on the device. In a build that fetches facts per
 * area they are not, and a student who downloaded the knee for a train
 * journey would open it underground to pictures with nothing to ask about
 * them. So a download asks for the area's facts first.
 *
 * It is also the server-side check offlineSource.ts was left a seam for. The
 * pictures are public files and stay so; what the server can refuse is the
 * facts, and a refusal here stops the download before a megabyte is fetched.
 *
 *   'none'         this build bundles its facts; there is nothing to fetch.
 *   'saved'        fetched and kept, under a lease.
 *   'refused'      the server says this account may not have this area.
 *   'unavailable'  no answer, or nobody signed in. The pictures may still be
 *                  downloaded; the facts arrive the next time the app is
 *                  opened online, and the screen says so.
 */
export type FactsPrefetch = 'none' | 'saved' | 'refused' | 'unavailable';

export async function prefetchFactsForDownload(area: Area): Promise<FactsPrefetch> {
  const loader = BUNDLED_CONTENT.loader;
  if (!loader) return 'none';
  try {
    const { getFirebaseAuth } = await import('../../anatomy-revision/data/firebase');
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid) return 'unavailable';
    const result = await loader.prefetch(uid, area);
    return result.status === 'loaded' ? 'saved' : result.status === 'denied' ? 'refused' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Whether a download in this build includes facts at all — which decides what the Offline section may claim. */
export const DOWNLOADS_INCLUDE_FACTS = BUNDLED_CONTENT.kind === 'server';

/**
 * What the Offline section says a download is. Only ever what is true of this
 * build: where facts are bundled a download is pictures, and where they are
 * fetched it is pictures and facts — and the facts come with a time limit
 * the student is entitled to know about before they rely on it.
 */
export function downloadPromise(includesFacts: boolean = DOWNLOADS_INCLUDE_FACTS): string {
  return includesFacts
    ? `Download an area to keep every picture in it, and its facts, on this device for revising with no signal. ` +
        `The pictures stay until you remove them. The facts are checked against your account: they work for ` +
        `${CONTENT_LEASE_DAYS} days without a connection, and opening the app online renews them.`
    : 'Download an area to keep every picture in it on this device, for revising with no signal.';
}
