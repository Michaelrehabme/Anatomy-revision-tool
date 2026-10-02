import type { AreaRecord } from './offlineCache';

/**
 * What an area's row says, and which buttons it offers — decided here, from
 * facts, so the screen never has to work it out and cannot offer a button the
 * state does not support.
 *
 *   not-downloaded     nothing held                          Download
 *   downloading        a download is running now             Cancel
 *   paused             some held, never finished             Resume · Remove
 *   downloaded         complete, and current as far as known Remove
 *   update-available   complete once, manifest since changed Update · Remove
 *
 * "As far as known" is deliberate. With no network the index cannot be
 * fetched, so there is nothing to compare against and a complete area reads
 * as Downloaded. That is the right answer offline: the pictures it holds are
 * the pictures it will show, and telling a student on a train that an update
 * exists which they cannot fetch helps nobody.
 */
export type AreaStatus = 'not-downloaded' | 'downloading' | 'paused' | 'downloaded' | 'update-available';

export interface StatusFacts {
  /** What the device holds, or null for nothing. */
  record: AreaRecord | null;
  /** The area's hash in the latest index this session fetched, or null if it has not been fetched. */
  latestHash: string | null;
  /** Whether a download for this area is running now. */
  downloading: boolean;
}

export function areaStatus({ record, latestHash, downloading }: StatusFacts): AreaStatus {
  if (downloading) return 'downloading';
  if (!record || Object.keys(record.files).length === 0) return 'not-downloaded';
  if (record.manifestHash === null) return 'paused';
  if (latestHash !== null && record.manifestHash !== latestHash) return 'update-available';
  return 'downloaded';
}

export type AreaAction = 'download' | 'cancel' | 'resume' | 'update' | 'remove';

/**
 * The buttons for a status.
 *
 * A LOCKED AREA CAN STILL BE REMOVED, AND NOTHING ELSE. Somebody whose
 * subscription lapsed, or who moved their free area, may be holding downloads
 * for areas they can no longer study. Refusing to fetch more is the paywall;
 * refusing to let them have their storage back would just be spite. A locked
 * download in flight can be cancelled for the same reason.
 */
export function actionsFor(status: AreaStatus, locked: boolean): AreaAction[] {
  switch (status) {
    case 'not-downloaded':
      return locked ? [] : ['download'];
    case 'downloading':
      return ['cancel'];
    case 'paused':
      return locked ? ['remove'] : ['resume', 'remove'];
    case 'downloaded':
      return ['remove'];
    case 'update-available':
      return locked ? ['remove'] : ['update', 'remove'];
  }
}

/** 0–100, whole numbers, and never 100 until it is: a bar that says 100% while files are missing is a lie. */
export function percentDone(doneBytes: number, totalBytes: number | null): number {
  if (!totalBytes || totalBytes <= 0) return 0;
  if (doneBytes >= totalBytes) return 100;
  return Math.max(0, Math.min(99, Math.floor((doneBytes / totalBytes) * 100)));
}
