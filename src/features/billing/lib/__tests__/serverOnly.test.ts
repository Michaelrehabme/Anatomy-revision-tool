import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * paddleWebhook.ts imports node:crypto and holds the logic that grants paid
 * access. It must never reach the browser bundle, for two reasons: node:crypto
 * would break the Vite build, and shipping the verification code to clients
 * shows everybody exactly what a forged request has to look like.
 *
 * It lives under src/ only so its tests run with everything else's. This makes
 * sure that is the ONLY reason it is there.
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('server-only billing code', () => {
  it('is imported by nothing in the browser app', () => {
    const offenders = walk(SRC)
      .filter((f) => !f.includes(`${sep}billing${sep}lib${sep}`))
      .filter((f) => /from '[^']*paddleWebhook'/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
