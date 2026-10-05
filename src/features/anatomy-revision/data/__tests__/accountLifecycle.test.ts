import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The failure this guards against is silent and legal, not technical.
 *
 * accountLifecycle.ts erases a person by walking a hardcoded list of
 * subcollections under users/{uid}. Add a seventh subcollection somewhere in
 * the app, forget to add it here, and deletion still "succeeds" — it just
 * leaves that data behind, while the privacy policy goes on saying the
 * account was deleted. Nothing crashes and no test fails, which is exactly
 * why this one reads the source rather than the behaviour.
 *
 * It scans for every users/{uid}/<name> path the codebase actually writes and
 * asserts the erasure list covers all of them.
 */

/**
 * src/ — the whole app, since a users/{uid} path can be written from anywhere
 * in it. Resolved from the working directory rather than import.meta.url,
 * which Vitest does not hand back as a file:// URL.
 */
const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Subcollection names from any `collection(db, 'users', X, 'name')` or `doc(db, 'users', X, 'name', ...)`. */
function referencedSubcollections(): Set<string> {
  const found = new Set<string>();
  // Same line only. A character class that excludes commas still crosses
  // newlines, which matched a 'users' in one call against a collection name
  // several lines below it in another.
  const pattern = /'users',[^,\n]+,\s*'([A-Za-z]+)'/g;
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(pattern)) found.add(match[1]);
  }
  return found;
}

/** The list erasure walks, read from the module's source so the test cannot drift from it. */
function erasureList(): Set<string> {
  const text = readFileSync(join(SRC, 'features/anatomy-revision/data/accountLifecycle.ts'), 'utf8');
  const block = /const USER_SUBCOLLECTIONS = \[([\s\S]*?)\] as const;/.exec(text);
  if (!block) throw new Error('USER_SUBCOLLECTIONS not found — has the module been restructured?');
  return new Set([...block[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]));
}

describe('account erasure covers every per-user subcollection', () => {
  it('deletes everything the app writes under users/{uid}', () => {
    const referenced = referencedSubcollections();
    const deleted = erasureList();

    expect(referenced.size).toBeGreaterThan(0);

    const missed = [...referenced].filter((name) => !deleted.has(name)).sort();
    expect(
      missed,
      `These are written under users/{uid} but never deleted, so an account "deletion" would leave them behind: ` +
        `${missed.join(', ')}. Add them to USER_SUBCOLLECTIONS in accountLifecycle.ts.`,
    ).toEqual([]);
  });

  it('does not claim to delete a subcollection that no longer exists', () => {
    // A stale name is harmless at runtime but means the list has stopped
    // describing the app, which is how the first kind of drift starts.
    const referenced = referencedSubcollections();
    const stale = [...erasureList()].filter((name) => !referenced.has(name)).sort();
    expect(stale, `Listed for deletion but nothing writes them: ${stale.join(', ')}`).toEqual([]);
  });
});

describe('deleting an account with a subscription still charging', () => {
  const now = new Date('2026-09-29T12:00:00.000Z');
  const running = { tier: 'individual', source: 'paddle', expiresAt: '2026-10-29T12:00:00.000Z' };

  // The privacy policy says deletion is the student's at any time. It was not:
  // somebody who had cancelled was made to wait out the paid period.
  it('is allowed as soon as the subscription is cancelled, with paid time still to run', async () => {
    const { hasLiveSubscription } = await import('../accountLifecycle');
    expect(hasLiveSubscription({ ...running, cancelAt: '2026-10-29T12:00:00.000Z' }, now)).toBe(false);
    // And when Paddle has already cancelled it.
    expect(hasLiveSubscription({ ...running, expiresAt: '2026-09-20T12:00:00.000Z', cancelAt: '2026-09-20T12:00:00.000Z' }, now)).toBe(false);
  });

  it('is refused while it would still renew — including when access has stopped but the subscription has not', async () => {
    const { hasLiveSubscription } = await import('../accountLifecycle');
    expect(hasLiveSubscription(running, now)).toBe(true);
    // A failed renewal: no access, but Paddle is still trying the card.
    expect(hasLiveSubscription({ ...running, expiresAt: '2026-09-28T12:00:00.000Z', paymentIssueSince: '2026-09-28T12:00:30.000Z' }, now)).toBe(true);
    // A refund: access ended, the subscription runs on to its next renewal unless cancelled.
    expect(hasLiveSubscription({ ...running, expiresAt: '2026-09-28T12:00:00.000Z', refundedAt: '2026-09-28T12:00:00.000Z' }, now)).toBe(true);
    // Either, once cancelled, is not.
    expect(hasLiveSubscription({ ...running, expiresAt: '2026-09-28T12:00:00.000Z', refundedAt: '2026-09-28T12:00:00.000Z', cancelAt: '2026-09-28T13:00:00.000Z' }, now)).toBe(false);
  });

  it('says what to do in the words on the account screen, and that there is no wait afterwards', async () => {
    const { SUBSCRIPTION_STILL_RENEWS } = await import('../accountLifecycle');
    expect(SUBSCRIPTION_STILL_RENEWS).toBe(
      'Your subscription is still set to renew, and would keep charging after your account is gone. ' +
      'Cancel it first, under "Manage or cancel your subscription". You can then delete your account ' +
      'straight away, without waiting for the time you have paid for to run out.',
    );
    // The control it names is the one that exists.
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/features/billing/ManageSubscription.tsx', 'utf8')).toContain('Manage or cancel your subscription');
  });

  it('is preceded by a warning that unused paid time goes with the account, and the policy says the same', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/features/anatomy-revision/components/shared/AccountDataControls.tsx', 'utf8')).toContain(
      'If you have paid for time you have not used yet, you give that up too.',
    );
    const privacy = readFileSync('src/features/legal/PrivacyPage.tsx', 'utf8').replace(/\s+/g, ' ');
    expect(privacy).toContain('if you have a subscription that is still set to renew: cancel it');
    expect(privacy).toContain('Once it is cancelled you can delete straight away');
  });

  it('is refused while a Paddle subscription is live or has not started', async () => {
    const { hasLiveSubscription } = await import('../accountLifecycle');
    const now = new Date('2026-09-29T12:00:00.000Z');
    expect(hasLiveSubscription({ tier: 'individual', source: 'paddle', expiresAt: '2026-10-29T12:00:00.000Z' }, now)).toBe(true);
    expect(hasLiveSubscription({ tier: 'individual', source: 'paddle', expiresAt: null }, now)).toBe(true);
    expect(
      hasLiveSubscription([{ tier: 'individual', source: 'paddle', startsAt: '2026-10-10T00:00:00.000Z', expiresAt: '2026-11-10T00:00:00.000Z' }], now),
    ).toBe(true);
  });

  it('is allowed once it has ended, for a class licence or a complimentary grant, and with nothing bought', async () => {
    const { hasLiveSubscription } = await import('../accountLifecycle');
    const now = new Date('2026-09-29T12:00:00.000Z');
    expect(hasLiveSubscription({ tier: 'individual', source: 'paddle', expiresAt: '2026-09-01T00:00:00.000Z' }, now)).toBe(false);
    expect(hasLiveSubscription({ tier: 'institutional', source: 'licence', expiresAt: null }, now)).toBe(false);
    expect(hasLiveSubscription({ tier: 'individual', source: 'complimentary', expiresAt: null }, now)).toBe(false);
    expect(hasLiveSubscription(undefined, now)).toBe(false);
  });
});
