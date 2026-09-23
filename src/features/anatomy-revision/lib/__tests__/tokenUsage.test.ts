import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// process.cwd() is the project root under vitest. import.meta.url is not
// usable here: the jsdom environment hands it back as a non-file URL.
const SRC = join(process.cwd(), 'src');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...tsxFiles(path));
    else if (entry.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/**
 * Guards a colour pairing that cannot be expressed as a contrast check.
 *
 * --acc (#3f8f8a) is the selection/correctness/progress FILL. White on it is
 * 3.81:1, an AA failure for a button label — which is exactly why --acc-fill
 * (5.36:1) exists in the palette. The two tokens look interchangeable at a
 * glance and are not, and the wrong one was used for the primary button in 22
 * places across both render trees before anything noticed.
 *
 * src/scripts/checkContrast.ts cannot catch this: it asserts that named pairs
 * pass, and the fix here is that this pair must never be written at all. So
 * the assertion is over the source.
 */
describe('accent token usage', () => {
  it('never puts --onacc text on the --acc fill', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, i) => {
        if (line.includes("background: 'var(--acc)'") && line.includes("'var(--onacc)'")) {
          offenders.push(`${file.slice(SRC.length).replace(/\\/g, '/')}:${i + 1}`);
        }
      });
    }
    // Use var(--acc-fill) for a button that carries a label.
    expect(offenders).toEqual([]);
  });
});
