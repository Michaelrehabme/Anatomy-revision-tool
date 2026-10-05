import {
  CONTENT_FETCH_WINDOW_MS,
  countFetch,
  type FetchWindow,
} from '../../../src/features/anatomy-revision/data/content/fetchLimit';

/**
 * Recent requests per account, kept in this function instance's memory.
 *
 * The count that matters is on the user document, where every instance sees
 * it, and it counts GRANTS. This one counts every verified request, granted
 * or refused, and exists to say no WITHOUT a database read: the count on the
 * document costs a read to consult, and the project has 50,000 of those a day
 * for everything. A warm instance that has already seen thirty requests from
 * an account in the hour refuses the thirty-first from memory.
 *
 * It is a convenience and never the authority: a cold instance has no
 * memory, and two instances do not share one.
 *
 * Its own module rather than a `const` in content-area.ts so the tests can
 * empty it without the function file exporting anything but its handler.
 */
const recent = new Map<string, FetchWindow>();

/** Above this many accounts the finished hours are dropped, so a long-lived instance cannot grow without end. */
const RECENT_MAX = 2000;

/** Counts one request from an account. `limited` means: refuse, and do not read the database. */
export function countRequest(uid: string, now: Date): { limited: boolean; window: FetchWindow } {
  if (recent.size >= RECENT_MAX) {
    for (const [key, window] of recent) {
      if (now.getTime() - window.windowStart >= CONTENT_FETCH_WINDOW_MS) recent.delete(key);
    }
  }
  const counted = countFetch(recent.get(uid), now);
  if (!counted.limited) recent.set(uid, counted.window);
  return counted;
}

/** Remembers a window read from the account, so the next request is refused without the read. */
export function rememberWindow(uid: string, window: FetchWindow): void {
  recent.set(uid, window);
}

/** An instance with no memory of anyone. For the tests. */
export function forgetRecentRequests(): void {
  recent.clear();
}
