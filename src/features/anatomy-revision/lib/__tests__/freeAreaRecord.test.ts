import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS } from '../../types/region';
import { FREE_AREA_SWITCH_DAYS, FREE_AREA_SWITCHES_ALLOWED, canSwitchFreeArea } from '../entitlement';
import { parseStoredFreeArea, switchesToMigrate } from '../freeAreaRecord';

const NOW = new Date('2026-10-05T12:00:00.000Z');

describe('parseStoredFreeArea', () => {
  it('reads a server timestamp from either SDK, and one that has been through JSON', () => {
    const at = Date.parse('2026-09-01T09:30:00.000Z');
    const expected = { area: 'knee', chosenAt: '2026-09-01T09:30:00.000Z', switches: 0 };
    expect(parseStoredFreeArea({ area: 'knee', chosenAt: { toMillis: () => at }, switches: 0 }, NOW)).toEqual(expected);
    expect(parseStoredFreeArea({ area: 'knee', chosenAt: { seconds: at / 1000, nanoseconds: 0 }, switches: 0 }, NOW)).toEqual(expected);
    expect(parseStoredFreeArea({ area: 'knee', chosenAt: { _seconds: at / 1000, _nanoseconds: 0 }, switches: 0 }, NOW)).toEqual(expected);
    expect(parseStoredFreeArea({ area: 'knee', chosenAt: '2026-09-01T09:30:00.000Z', switches: 0 }, NOW)).toEqual(expected);
  });

  it('reads nothing where there is nothing, or no real area', () => {
    expect(parseStoredFreeArea(undefined, NOW)).toBeNull();
    expect(parseStoredFreeArea(null, NOW)).toBeNull();
    expect(parseStoredFreeArea('knee', NOW)).toBeNull();
    expect(parseStoredFreeArea({ area: 'everything', chosenAt: 0, switches: 0 }, NOW)).toBeNull();
    // A value from before the spine was split is three areas, not one.
    expect(parseStoredFreeArea({ area: 'back-core', chosenAt: 0, switches: 0 }, NOW)).toBeNull();
  });

  it('reads a write the server has not confirmed yet as chosen just now', () => {
    const pending = parseStoredFreeArea({ area: 'hip', chosenAt: null, switches: 0 }, NOW);
    expect(pending).toEqual({ area: 'hip', chosenAt: NOW.toISOString(), switches: 0 });
    expect(canSwitchFreeArea(pending, NOW)).toBe(false);
  });

  it('never reads an unvouched-for record as changeable: junk dates are now, junk counts are used', () => {
    const junkDate = parseStoredFreeArea({ area: 'hip', chosenAt: 'last Tuesday', switches: 0 }, NOW);
    expect(canSwitchFreeArea(junkDate, NOW)).toBe(false);
    for (const switches of [undefined, null, '0', -1, 0.5, Number.NaN]) {
      const parsed = parseStoredFreeArea({ area: 'hip', chosenAt: 0, switches }, NOW);
      expect(parsed?.switches).toBe(FREE_AREA_SWITCHES_ALLOWED);
      expect(canSwitchFreeArea(parsed, NOW)).toBe(false);
    }
  });
});

describe('switchesToMigrate', () => {
  it('moves an unused change up as unused and anything else as used', () => {
    expect(switchesToMigrate({ area: 'hip', chosenAt: '', switches: 0 })).toBe(0);
    expect(switchesToMigrate({ area: 'hip', chosenAt: '', switches: 1 })).toBe(1);
    expect(switchesToMigrate({ area: 'hip', chosenAt: '', switches: 9 })).toBe(1);
  });
});

/**
 * firestore.rules can import nothing, so it repeats two things the app
 * defines: the list of areas and the thirty days. If they drift the failure
 * is silent and one-sided — a tenth area could never be chosen as the free
 * one, or the app would promise a change on a day the rules refuse it. The
 * rules themselves are run in rules-tests/, which needs the emulator; this
 * needs only the file.
 */
describe('firestore.rules agrees with the app about the free area', () => {
  const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');

  it('lists exactly the areas in types/region.ts', () => {
    const body = /function isArea\(area\)\s*\{\s*return area in \[([^\]]+)\]/.exec(rules)?.[1];
    expect(body, 'isArea() not found in firestore.rules').toBeTruthy();
    const listed = [...body!.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(listed).toEqual(AREAS);
  });

  it('waits the same number of days', () => {
    expect(rules).toContain(`duration.value(${FREE_AREA_SWITCH_DAYS}, 'd')`);
  });

  it('allows one change and no more', () => {
    expect(FREE_AREA_SWITCHES_ALLOWED).toBe(1);
    expect(rules).toMatch(/before\.get\('switches', -1\) == 0\s*&& after\.switches == 1/);
  });
});
