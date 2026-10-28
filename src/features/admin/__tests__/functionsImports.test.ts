import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * firebase-admin/auth cannot load in a Netlify function (ERR_REQUIRE_ESM), and
 * a function that imports it fails before it does anything: the sign-up
 * emails on 25 Oct 2026 and the report emails after their redesign both went
 * quiet that way. Accounts are read through netlify/functions/lib/accounts.ts.
 */

const FUNCTIONS = join(__dirname, '../../../../netlify/functions');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [],
  );
}

describe('Netlify functions', () => {
  it('never import firebase-admin/auth', () => {
    const offenders = sources(FUNCTIONS).filter((file) => /from\s+['"]firebase-admin\/auth['"]/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
