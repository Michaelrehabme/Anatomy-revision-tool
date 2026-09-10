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
