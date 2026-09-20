import { describe, expect, it } from 'vitest';
import {
  FREE_ENTITLEMENT,
  FREE_AREAS,
  hasExpired,
  hasStarted,
  effectiveTier,
  resolveEntitlement,
  canAccessArea,
  lockedAreas,
  daysUntilExpiry,
  isFreeArea,
  freeAreasFor,
  entitledAreas,
  canSwitchFreeArea,
  daysUntilFreeAreaSwitch,
  FREE_AREA_SWITCH_DAYS,
  type Entitlement,
} from '../entitlement';
import { AREAS } from '../../types/region';
import { AREAS } from '../../types/region';

/**
 * CR-027 names three cases worth covering: expiry, precedence when somebody
 * holds two entitlements, and the free area staying open to a lapsed
 * subscriber. The fourth worth covering is the one that costs real money if it
 * is wrong — a malformed record must not lock out somebody who paid.
 */

const NOW = new Date('2026-10-15T12:00:00.000Z');

function ent(over: Partial<Entitlement> = {}): Entitlement {
  return { tier: 'individual', source: 'paddle', expiresAt: '2027-10-15T12:00:00.000Z', ...over };
}

describe('hasExpired', () => {
  it('is false for an entitlement with no end date', () => {
    expect(hasExpired(ent({ expiresAt: null }), NOW)).toBe(false);
  });

  it('is true the moment the expiry passes', () => {
    expect(hasExpired(ent({ expiresAt: '2026-10-15T11:59:59.000Z' }), NOW)).toBe(true);
  });

  it('is false a second before', () => {
    expect(hasExpired(ent({ expiresAt: '2026-10-15T12:00:01.000Z' }), NOW)).toBe(false);
  });

  it('does not lock out somebody whose date is unreadable', () => {
    // Being briefly generous to a malformed record is a smaller mistake than
    // locking out a paying subscriber because of one.
    expect(hasExpired(ent({ expiresAt: 'sometime next year' }), NOW)).toBe(false);
  });
});

describe('effectiveTier', () => {
  it('is free with no entitlement at all', () => {
    expect(effectiveTier(null, NOW)).toBe('free');
    expect(effectiveTier(undefined, NOW)).toBe('free');
  });

  it('drops a lapsed subscription back to free', () => {
    expect(effectiveTier(ent({ expiresAt: '2026-01-01T00:00:00.000Z' }), NOW)).toBe('free');
  });

  it('keeps the stored tier on the record even once it has lapsed', () => {
    // The tier itself is not rewritten: what somebody bought is worth knowing,
    // and is what makes a renewal prompt possible.
    const lapsed = ent({ expiresAt: '2026-01-01T00:00:00.000Z' });
    expect(lapsed.tier).toBe('individual');
    expect(effectiveTier(lapsed, NOW)).toBe('free');
  });
});

describe('a delayed start', () => {
  // The student who kept their 14-day cancellation right. /refunds promises
  // their access begins after the 14 days, so until then they are free tier.
  it('is free before the start date', () => {
    expect(effectiveTier(ent({ startsAt: '2026-10-20T12:00:00.000Z' }), NOW)).toBe('free');
  });

  it('is the paid tier once the start date has passed', () => {
    expect(effectiveTier(ent({ startsAt: '2026-10-10T12:00:00.000Z' }), NOW)).toBe('individual');
  });

  it('treats no start date, or an unreadable one, as already started', () => {
    expect(hasStarted(ent(), NOW)).toBe(true);
    expect(hasStarted(ent({ startsAt: 'soon' }), NOW)).toBe(true);
  });

  it('is never chosen over an entitlement that is live now', () => {
    const pending = ent({ tier: 'institutional', source: 'licence', startsAt: '2026-11-01T00:00:00.000Z' });
    const live = ent();
    expect(resolveEntitlement([pending, live], NOW)).toEqual(live);
  });
});

describe('resolveEntitlement', () => {
  it('returns free when nothing is active', () => {
    expect(resolveEntitlement([], NOW)).toEqual(FREE_ENTITLEMENT);
    expect(resolveEntitlement([ent({ expiresAt: '2020-01-01T00:00:00.000Z' })], NOW)).toEqual(FREE_ENTITLEMENT);
  });

  it('prefers an institutional seat over a personal subscription', () => {
    // A student subscribes, then their university buys a licence. Both live.
    const chosen = resolveEntitlement([
      ent({ tier: 'individual', source: 'paddle' }),
      ent({ tier: 'institutional', source: 'licence', seatId: 'seat-12' }),
    ], NOW);
    expect(chosen.tier).toBe('institutional');
    expect(chosen.seatId).toBe('seat-12');
  });

  it('prefers the longer of two of the same tier', () => {
    const chosen = resolveEntitlement([
      ent({ expiresAt: '2026-12-01T00:00:00.000Z' }),
      ent({ expiresAt: '2027-06-01T00:00:00.000Z', externalId: 'longer' }),
    ], NOW);
    expect(chosen.externalId).toBe('longer');
  });

  it('treats no expiry as outlasting any date', () => {
    const chosen = resolveEntitlement([
      ent({ expiresAt: '2099-01-01T00:00:00.000Z' }),
      ent({ expiresAt: null, source: 'complimentary', externalId: 'forever' }),
    ], NOW);
    expect(chosen.externalId).toBe('forever');
  });

  it('never merges two entitlements into a third that never existed', () => {
    const chosen = resolveEntitlement([
      ent({ tier: 'institutional', source: 'licence', seatId: 'seat-1', expiresAt: '2027-01-01T00:00:00.000Z' }),
      ent({ tier: 'individual', source: 'paddle', externalId: 'sub-9', expiresAt: '2099-01-01T00:00:00.000Z' }),
    ], NOW);
    // The institutional one wins whole: it must not acquire the other's expiry.
    expect(chosen.seatId).toBe('seat-1');
    expect(chosen.expiresAt).toBe('2027-01-01T00:00:00.000Z');
    expect(chosen.externalId).toBeUndefined();
  });

  it('ignores a free entitlement among the candidates', () => {
    expect(resolveEntitlement([FREE_ENTITLEMENT, ent()], NOW).tier).toBe('individual');
  });
});

describe('the free area', () => {
  it('is a real area of the dataset', () => {
    for (const a of FREE_AREAS) expect(AREAS).toContain(a);
  });

  it('opens to somebody with no entitlement whatsoever', () => {
    for (const a of FREE_AREAS) expect(canAccessArea(a, null, NOW)).toBe(true);
  });

  it('stays open to a lapsed subscriber', () => {
    // CR-027: a lapsed subscriber keeps their history and their free area.
    const lapsed = ent({ expiresAt: '2026-01-01T00:00:00.000Z' });
    for (const a of FREE_AREAS) expect(canAccessArea(a, lapsed, NOW)).toBe(true);
  });

  it('is configurable rather than fixed', () => {
    expect(isFreeArea('knee', ['knee'])).toBe(true);
    expect(canAccessArea('knee', null, NOW, ['knee'])).toBe(true);
  });
});

describe('canAccessArea', () => {
  it('locks a paid area for somebody on free', () => {
    const paid = AREAS.find((a) => !FREE_AREAS.includes(a))!;
    expect(canAccessArea(paid, null, NOW)).toBe(false);
  });

  it('opens every area to an active subscriber', () => {
    for (const a of AREAS) expect(canAccessArea(a, ent(), NOW)).toBe(true);
  });

  it('opens every area to an institutional seat', () => {
    const seat = ent({ tier: 'institutional', source: 'licence', seatId: 's1' });
    for (const a of AREAS) expect(canAccessArea(a, seat, NOW)).toBe(true);
  });

  it('closes paid areas again when the subscription lapses', () => {
    const paid = AREAS.find((a) => !FREE_AREAS.includes(a))!;
    expect(canAccessArea(paid, ent({ expiresAt: '2026-01-01T00:00:00.000Z' }), NOW)).toBe(false);
  });
});

describe('lockedAreas', () => {
  it('is everything but the free area for a free user', () => {
    const locked = lockedAreas(AREAS, null, NOW);
    expect(locked).toHaveLength(AREAS.length - FREE_AREAS.length);
    for (const a of FREE_AREAS) expect(locked).not.toContain(a);
  });

  it('is empty for a subscriber', () => {
    expect(lockedAreas(AREAS, ent(), NOW)).toEqual([]);
  });
});

describe('daysUntilExpiry', () => {
  it('rounds up, so the last few hours still read as a day', () => {
    expect(daysUntilExpiry(ent({ expiresAt: '2026-10-16T06:00:00.000Z' }), NOW)).toBe(1);
  });

  it('is null when there is nothing to count down to', () => {
    expect(daysUntilExpiry(ent({ expiresAt: null }), NOW)).toBeNull();
    expect(daysUntilExpiry(null, NOW)).toBeNull();
    expect(daysUntilExpiry(ent({ expiresAt: '2020-01-01T00:00:00.000Z' }), NOW)).toBeNull();
  });
});

describe('the free area is chosen, and swappable monthly', () => {
  const NOW = new Date('2026-09-20T12:00:00.000Z');

  it('opens the area that was chosen, not the default', () => {
    const choice = { area: 'knee' as const, chosenAt: NOW.toISOString() };
    expect(canAccessArea('knee', FREE_ENTITLEMENT, NOW, freeAreasFor(choice))).toBe(true);
    expect(canAccessArea('shoulder', FREE_ENTITLEMENT, NOW, freeAreasFor(choice))).toBe(false);
  });

  it('falls back to the default area for an account that has never chosen', () => {
    expect(freeAreasFor(null)).toEqual(FREE_AREAS);
  });

  it('opens exactly one area, whatever was chosen', () => {
    const choice = { area: 'hip' as const, chosenAt: NOW.toISOString() };
    expect(entitledAreas(AREAS, FREE_ENTITLEMENT, NOW, freeAreasFor(choice))).toEqual(['hip']);
  });

  it('holds the choice for 30 days, then lets it change', () => {
    const justChosen = { area: 'hip' as const, chosenAt: NOW.toISOString() };
    expect(canSwitchFreeArea(justChosen, NOW)).toBe(false);
    expect(daysUntilFreeAreaSwitch(justChosen, NOW)).toBe(FREE_AREA_SWITCH_DAYS);

    const dayBefore = new Date(NOW.getTime() + (FREE_AREA_SWITCH_DAYS - 1) * 86400000);
    expect(canSwitchFreeArea(justChosen, dayBefore)).toBe(false);
    expect(daysUntilFreeAreaSwitch(justChosen, dayBefore)).toBe(1);

    const dayAfter = new Date(NOW.getTime() + FREE_AREA_SWITCH_DAYS * 86400000);
    expect(canSwitchFreeArea(justChosen, dayAfter)).toBe(true);
  });

  it('never traps somebody behind a malformed or future date', () => {
    expect(canSwitchFreeArea({ area: 'hip', chosenAt: 'not a date' }, NOW)).toBe(true);
    expect(canSwitchFreeArea({ area: 'hip', chosenAt: '2099-01-01T00:00:00.000Z' }, NOW)).toBe(true);
  });

  it('gives a subscriber every area regardless of the choice', () => {
    const paid = { tier: 'individual' as const, source: 'paddle' as const, expiresAt: null };
    const choice = { area: 'hip' as const, chosenAt: NOW.toISOString() };
    expect(entitledAreas(AREAS, paid, NOW, freeAreasFor(choice))).toEqual(AREAS);
  });
});
