import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AUTH_ENABLED, useAuth } from '../context/AuthProvider';
import { asStudyProfile, emptyStudyProfile, newerProfile, type StudyProfile } from '../lib/studyProfile';

/**
 * The study profile (lib/studyProfile.ts): on the account, cached on the
 * device.
 *
 * The device's copy is what every screen reads, synchronously, so a session
 * never waits on the network. The account's copy is what follows the student
 * to another device: it is read once per sign-in and the newer of the two
 * kept (by `updatedAt`), and every change is written to both.
 *
 * The cache remembers whose it is. On a shared computer a second account must
 * not start from the first one's answers, so a copy belonging to someone else
 * reads as no profile at all until that account's own copy arrives.
 */

const KEY = 'anatomy-revision:v1:studyProfile';

interface Cached {
  owner: string | null;
  profile: StudyProfile;
}

let memo: { raw: string | null; value: Cached | null } | null = null;
const listeners = new Set<() => void>();

function readCache(): Cached | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage disabled — no cache, the account's copy still applies.
  }
  // useSyncExternalStore needs the same object back while nothing changed.
  if (memo && memo.raw === raw) return memo.value;
  let value: Cached | null = null;
  try {
    const parsed = raw ? (JSON.parse(raw) as { owner?: unknown; profile?: unknown }) : null;
    const profile = asStudyProfile(parsed?.profile);
    value = profile ? { owner: typeof parsed?.owner === 'string' ? parsed.owner : null, profile } : null;
  } catch {
    value = null;
  }
  memo = { raw, value };
  return value;
}

function writeCache(owner: string | null, profile: StudyProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ owner, profile }));
  } catch {
    // Full or unavailable: this visit keeps it in memory through `memo`.
    memo = { raw: null, value: { owner, profile } };
  }
  for (const listener of listeners) listener();
}

/** This user's profile on this device, or null. A copy with no owner yet is taken as theirs. */
export function getStudyProfile(uid: string | null): StudyProfile | null {
  const cached = readCache();
  if (!cached) return null;
  return cached.owner === null || uid === null || cached.owner === uid ? cached.profile : null;
}

async function pushToAccount(uid: string, profile: StudyProfile): Promise<void> {
  const { writeStudyProfile } = await import('../data/firebase');
  await writeStudyProfile(uid, profile);
}

/**
 * Saves a new version: stamped now, on the device at once, on the account
 * behind it. A failed account write is logged and left — the device's copy is
 * newer, so the next sync carries it up.
 */
export function saveStudyProfile(uid: string | null, next: Omit<StudyProfile, 'updatedAt'>): StudyProfile {
  // Through JSON and back: an answer taken back is `undefined`, which
  // Firestore refuses outright, and a cleared field should be gone, not kept.
  const profile: StudyProfile = JSON.parse(JSON.stringify({ ...next, updatedAt: Date.now() }));
  writeCache(uid, profile);
  if (AUTH_ENABLED && uid) {
    pushToAccount(uid, profile).catch((error) => console.error('Failed to save study profile:', error));
  }
  return profile;
}

const syncing = new Set<string>();

/** Once per sign-in: the newer of the device's and the account's copy, on both. */
export async function syncStudyProfile(uid: string): Promise<void> {
  if (syncing.has(uid)) return;
  syncing.add(uid);
  try {
    const { readStudyProfile } = await import('../data/firebase');
    const remote = asStudyProfile(await readStudyProfile(uid));
    const local = getStudyProfile(uid);
    const winner = newerProfile(local, remote);
    if (!winner) return;
    if (winner !== local || readCache()?.owner !== uid) writeCache(uid, winner);
    if (winner !== remote) await pushToAccount(uid, winner);
  } catch (error) {
    // Offline, or the read was refused: the device's copy stands for now.
    console.error('Failed to sync study profile:', error);
    syncing.delete(uid);
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface UseStudyProfile {
  /** Null until the questionnaire has been answered or skipped. */
  profile: StudyProfile | null;
  /** Applies a change to the current profile (or to an empty one) and saves it. */
  update: (change: (current: StudyProfile) => Omit<StudyProfile, 'updatedAt'>) => void;
}

export function useStudyProfile(): UseStudyProfile {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const cached = useSyncExternalStore(subscribe, readCache, () => null);
  const profile = cached && (cached.owner === null || uid === null || cached.owner === uid) ? cached.profile : null;

  useEffect(() => {
    // A guest's answers are saved on the device and carried up when the
    // account is made: linking keeps the same uid.
    if (AUTH_ENABLED && uid && !user?.isAnonymous) void syncStudyProfile(uid);
  }, [uid, user?.isAnonymous]);

  const update = useCallback<UseStudyProfile['update']>(
    (change) => {
      saveStudyProfile(uid, change(getStudyProfile(uid) ?? emptyStudyProfile()));
    },
    [uid],
  );

  return { profile, update };
}
