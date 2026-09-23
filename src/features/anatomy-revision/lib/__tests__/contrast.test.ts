import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCOPES, SCOPE_LABELS, run } from '../../../../scripts/contrastReport';

/**
 * The contrast check, as a test.
 *
 * src/scripts/checkContrast.ts is a CLI, and a check nobody remembers to run
 * is not evidence. features/legal/AccessibilityPage.tsx makes a public WCAG
 * 2.2 AA claim to students and to the universities that procure this, so the
 * assertion behind it runs on every `npm test`.
 */

const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

describe('design token contrast', () => {
  const { results, missing, failures } = run(css);

  it('declares every token in every theme scope', () => {
    // A token missing from a scope inherits the light value through :root,
    // which is a contrast bug that renders as a plausible-looking colour.
    const gaps = SCOPES.flatMap((s) => missing[s].map((t) => `${SCOPE_LABELS[s]}: ${t}`));
    expect(gaps).toEqual([]);
  });

  it('meets AA in light and dark, and AAA for text in high contrast', () => {
    const named = failures.map(
      (f) => `${SCOPE_LABELS[f.scope]}: ${f.check.fg} on ${f.check.bg} = ${f.ratio?.toFixed(2)}:1 (needs ${f.min}:1)`,
    );
    expect(named).toEqual([]);
  });

  it('actually checked all four scopes', () => {
    // Guards the failure mode the previous single-regex parser had: reporting
    // four passing palettes while only ever reading the first one.
    for (const scope of SCOPES) {
      const scored = results.filter((r) => r.scope === scope && r.ratio !== null);
      expect(scored.length, `${SCOPE_LABELS[scope]} produced no ratios`).toBeGreaterThan(10);
    }
    const lightInk = results.find((r) => r.scope === 'light' && r.check.fg === 'ink' && r.check.bg === 'pg');
    const darkInk = results.find((r) => r.scope === 'dark' && r.check.fg === 'ink' && r.check.bg === 'pg');
    expect(lightInk!.ratio).not.toBeCloseTo(darkInk!.ratio!, 2);
  });
});
