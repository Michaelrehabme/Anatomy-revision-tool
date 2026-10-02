import type { Area } from '../../anatomy-revision/types/region';
import {
  INDEX_URL,
  manifestUrl,
  parseAreaManifest,
  parseOfflineIndex,
  type AreaManifest,
  type ManifestFile,
  type OfflineIndex,
} from './manifest';
import { OFFLINE_FETCH_PARAM } from './offlineCache';

/**
 * Where a download gets its manifests and its files. Everything the feature
 * asks the network for goes through these three calls and nowhere else.
 *
 * THIS IS THE SEAM FOR SERVER-SIDE ENTITLEMENT. Today the files are public
 * static assets and the gate is in the client (useEntitlement), which is the
 * same honest position the rest of the paywall is in: the content ships to
 * every browser, so a determined person can lift it. When paid content moves
 * behind the server, this is the one place that changes — `staticOfflineSource`
 * is swapped for one that sends the account's ID token and gets back a signed
 * manifest or signed file URLs — and the downloader, the cache, the update
 * check and the screen are untouched. They already treat "the source said no"
 * as an ordinary failure.
 */
export interface OfflineSource {
  /** Each area's size and current hash. Small; fetched on every start. */
  fetchIndex(signal?: AbortSignal): Promise<OfflineIndex>;
  /** Every file an area needs. Rejects if the caller may not have it. */
  fetchManifest(area: Area, signal?: AbortSignal): Promise<AreaManifest>;
  /** One file's bytes, fresh from the network — never from a cache the worker keeps. */
  fetchFile(file: ManifestFile, signal?: AbortSignal): Promise<ArrayBuffer>;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  // no-store: a manifest is the statement of what is current, and a copy the
  // HTTP cache kept is a statement of what was.
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

export const staticOfflineSource: OfflineSource = {
  async fetchIndex(signal) {
    const index = parseOfflineIndex(await fetchJson(INDEX_URL, signal).catch(() => null));
    if (!index) throw new Error('The offline index could not be read.');
    return index;
  },

  async fetchManifest(area, signal) {
    const manifest = parseAreaManifest(await fetchJson(manifestUrl(area), signal).catch(() => null), area);
    if (!manifest) throw new Error(`The offline manifest for ${area} could not be read.`);
    return manifest;
  },

  async fetchFile(file, signal) {
    // The parameter does two jobs. It tells the service worker's image route
    // to leave this request alone (isAnatomyImageRequest), and — carrying the
    // hash — it gives each render of a reused filename its own URL, so the
    // browser's HTTP cache cannot answer with the picture from before.
    const response = await fetch(`${file.url}?${OFFLINE_FETCH_PARAM}=${file.hash}`, { signal });
    if (!response.ok) throw new Error(`${file.url} returned ${response.status}`);
    return response.arrayBuffer();
  },
};
