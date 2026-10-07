import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useEntitlement } from '../useEntitlement';
import type { Entitlement, FreeAreaChoice } from '../../lib/entitlement';
import type { StoredAccess } from '../../lib/entitlementRecord';
import { AREAS } from '../../types/region';
import { getFreeAreaChoice, setFreeAreaChoice } from '../../lib/preferences';
import { markConfirmationRequired, recordConfirmationSent, rememberPredates } from '../../lib/emailVerification';

/**
 * A confirmed email address before the free area, as the app's one gate
 * reports it (owner's decision, 7 Oct 2026; lib/emailVerification.ts).
 *
 * The repository is a stand-in that keeps what the rules keep: an
 * unconfirmed account's first choice is refused unless its profile is from
 * before the rule, and its change is always refused. The rules themselves
 * are tested against the emulator in rules-tests/.
 */

let account: { entitlement: Entitlement | null; freeArea: FreeAreaChoice | null; predates: boolean } = {
  entitlement: null,
  freeArea: null,
  predates: false,
};
let confirmedOnServer = false;
let reachable = true;
const saves: { area: string; switches: number }[] = [];
const SERVER_NOW = '2026-10-20T12:00:00.000Z';

vi.mock('../../data/entitlementRepository', () => ({
  readAccess: async (): Promise<StoredAccess> => {
    if (!reachable) throw new Error('offline');
    return { entitlement: account.entitlement, freeArea: account.freeArea, predatesVerification: account.predates };
  },
  saveFreeArea: async (_uid: string, area: FreeAreaChoice['area'], switches: 0 | 1): Promise<FreeAreaChoice> => {
    saves.push({ area, switches });
    if (!reachable) throw new Error('offline');
    // firestore.rules: a first choice needs a confirmed address or an old
    // profile; a change needs a confirmed address, whatever the profile.
    if (!account.freeArea && !(confirmedOnServer || account.predates)) throw new Error('permission-denied');
    if (account.freeArea && !confirmedOnServer) throw new Error('permission-denied');
    account.freeArea = { area, chosenAt: SERVER_NOW, switches };
    return account.freeArea;
  },
}));

const PAID: Entitlement = { tier: 'individual', source: 'paddle', expiresAt: '2099-01-01T00:00:00.000Z' };
const LONG_AGO = new Date('2026-08-01T00:00:00.000Z');

beforeEach(() => {
  vi.stubEnv('VITE_PERSISTENCE', 'firestore');
  localStorage.clear();
  account = { entitlement: null, freeArea: null, predates: false };
  confirmedOnServer = false;
  reachable = true;
  saves.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

const settle = async (result: { current: { loading: boolean } }) => waitFor(() => expect(result.current.loading).toBe(false));

describe('a new account that has not confirmed its address', () => {
  it('holds no area, is asked to confirm, and is not asked to choose an area yet', async () => {
    const { result } = renderHook(() => useEntitlement('u1', { emailVerified: false }));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(true);
    expect(result.current.needsFreeArea).toBe(false);
    expect(result.current.areas).toEqual([]);
    expect(result.current.canAccess('knee')).toBe(false);
  });

  it('cannot choose: nothing is shown as chosen and nothing is written', async () => {
    const { result } = renderHook(() => useEntitlement('u1', { emailVerified: false }));
    await settle(result);
    act(() => result.current.chooseFreeArea('knee'));
    expect(result.current.freeArea).toBeNull();
    expect(getFreeAreaChoice()).toBeNull();
    expect(saves).toEqual([]);
  });

  it('is asked to choose the moment its address is confirmed, and can', async () => {
    const { result, rerender } = renderHook(({ verified }) => useEntitlement('u1', { emailVerified: verified }), {
      initialProps: { verified: false },
    });
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(true);

    confirmedOnServer = true;
    rerender({ verified: true });
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.needsFreeArea).toBe(true);
    act(() => result.current.chooseFreeArea('knee'));
    await waitFor(() => expect(account.freeArea?.area).toBe('knee'));
    await waitFor(() => expect(result.current.areas).toEqual(['knee']));
  });

  // Asked of the server in a build that fetches facts, an unconfirmed
  // account's area would be refused; so it must not be reported as held
  // even when its document somehow names one.
  it('holds nothing even if its document names an area', async () => {
    account.freeArea = { area: 'hip', chosenAt: '2026-10-19T00:00:00.000Z', switches: 0 };
    const { result } = renderHook(() => useEntitlement('u1', { emailVerified: false }));
    await settle(result);
    expect(result.current.areas).toEqual([]);
    expect(result.current.needsEmailConfirmation).toBe(true);
    expect(result.current.freeArea?.area).toBe('hip');
  });
});

describe('a Google account, or any account whose address is confirmed', () => {
  it('goes straight through: asked to choose, never to confirm', async () => {
    const { result } = renderHook(() => useEntitlement('g1', { emailVerified: true }));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.switchNeedsConfirmation).toBe(false);
    expect(result.current.needsFreeArea).toBe(true);
  });

  it('is unaffected when the caller says nothing about the address at all', async () => {
    account.freeArea = { area: 'knee', chosenAt: '2026-10-19T00:00:00.000Z', switches: 0 };
    const { result } = renderHook(() => useEntitlement('u1'));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.areas).toEqual(['knee']);
  });
});

describe('an account that was here before the rule, never sent a confirmation email', () => {
  beforeEach(() => { account.predates = true; });

  it("keeps studying: its device's free area is moved up to the account, unconfirmed", async () => {
    setFreeAreaChoice('knee', 0, LONG_AGO);
    const { result } = renderHook(() => useEntitlement('old1', { emailVerified: false }));
    await waitFor(() => expect(account.freeArea?.area).toBe('knee'));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.needsFreeArea).toBe(false);
    expect(result.current.areas).toEqual(['knee']);
    expect(saves).toEqual([{ area: 'knee', switches: 0 }]);
  });

  it('keeps the area already on its account', async () => {
    account.freeArea = { area: 'hip', chosenAt: '2026-08-01T00:00:00.000Z', switches: 0 };
    const { result } = renderHook(() => useEntitlement('old1', { emailVerified: false }));
    await settle(result);
    expect(result.current.areas).toEqual(['hip']);
    expect(result.current.needsEmailConfirmation).toBe(false);
  });

  it('is asked to confirm before it can CHANGE its area, even when the thirty days are up', async () => {
    account.freeArea = { area: 'hip', chosenAt: '2026-08-01T00:00:00.000Z', switches: 0 };
    const { result } = renderHook(() => useEntitlement('old1', { emailVerified: false }));
    await settle(result);
    expect(result.current.daysUntilSwitch).toBe(0);
    expect(result.current.canSwitchFree).toBe(false);
    expect(result.current.switchNeedsConfirmation).toBe(true);
    act(() => result.current.chooseFreeArea('knee'));
    expect(result.current.freeArea?.area).toBe('hip');
    expect(saves).toEqual([]);
  });

  it('may change it once confirmed', async () => {
    account.freeArea = { area: 'hip', chosenAt: '2026-08-01T00:00:00.000Z', switches: 0 };
    confirmedOnServer = true;
    const { result } = renderHook(() => useEntitlement('old1', { emailVerified: true }));
    await settle(result);
    expect(result.current.canSwitchFree).toBe(true);
    expect(result.current.switchNeedsConfirmation).toBe(false);
    act(() => result.current.chooseFreeArea('knee'));
    await waitFor(() => expect(account.freeArea).toMatchObject({ area: 'knee', switches: 1 }));
  });

  // Asking for the link, to change area, sends an email. That must not turn
  // an account that may keep its area into one that is locked out of it.
  it('is not locked out by asking for the confirmation email', async () => {
    account.freeArea = { area: 'hip', chosenAt: '2026-08-01T00:00:00.000Z', switches: 0 };
    recordConfirmationSent('old1', 'old1@uni.ac.uk');
    const { result } = renderHook(() => useEntitlement('old1', { emailVerified: false }));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.areas).toEqual(['hip']);
  });

  it('with no area anywhere, may make its first choice unconfirmed', async () => {
    const { result } = renderHook(() => useEntitlement('old1', { emailVerified: false }));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.needsFreeArea).toBe(true);
    act(() => result.current.chooseFreeArea('elbow'));
    await waitFor(() => expect(account.freeArea?.area).toBe('elbow'));
  });

  it('offline, with what this device remembers: keeps its area and is not asked anything', async () => {
    rememberPredates('old1', true);
    setFreeAreaChoice('knee', 0, LONG_AGO, 'old1');
    reachable = false;
    const { result } = renderHook(() => useEntitlement('old1', { emailVerified: false }));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.areas).toEqual(['knee']);
  });

  // The first load after the update, with no connection: nothing has been
  // learned and nothing is remembered. A student in a tunnel is not locked
  // out of what is in the downloaded files on a guess.
  it('offline, with nothing remembered: given the benefit of the doubt', async () => {
    setFreeAreaChoice('knee', 0, LONG_AGO);
    reachable = false;
    const { result } = renderHook(() => useEntitlement('old1', { emailVerified: false }));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.areas).toEqual(['knee']);
    expect(result.current.known).toBe(false);
  });
});

describe('a guest from before the rule who creates an account now', () => {
  // Their profile is old, so the database would let the choice through. The
  // app made the account and knows it is a new sign-up: it confirms first.
  it('is asked to confirm, keeps its choice on the device, and nothing is written for it', async () => {
    account.predates = true;
    setFreeAreaChoice('knee', 0, LONG_AGO);
    markConfirmationRequired('g1', 'g1@uni.ac.uk');
    const { result } = renderHook(() => useEntitlement('g1', { emailVerified: false }));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(true);
    expect(result.current.areas).toEqual([]);
    // What they chose is still reported, for the screen to say it is waiting for them.
    expect(result.current.freeArea?.area).toBe('knee');
    expect(saves).toEqual([]);
  });

  it('has its area and is straight in the moment the address is confirmed', async () => {
    account.predates = true;
    setFreeAreaChoice('knee', 0, LONG_AGO);
    markConfirmationRequired('g1', 'g1@uni.ac.uk');
    const { result, rerender } = renderHook(({ verified }) => useEntitlement('g1', { emailVerified: verified }), {
      initialProps: { verified: false },
    });
    await settle(result);
    expect(saves).toEqual([]);

    confirmedOnServer = true;
    rerender({ verified: true });
    await waitFor(() => expect(account.freeArea?.area).toBe('knee'));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.needsFreeArea).toBe(false);
    expect(result.current.areas).toEqual(['knee']);
    expect(saves).toEqual([{ area: 'knee', switches: 0 }]);
  });

  it('is still asked while offline: this device knows it made the account', async () => {
    markConfirmationRequired('g1', 'g1@uni.ac.uk');
    setFreeAreaChoice('knee', 0, LONG_AGO);
    reachable = false;
    const { result } = renderHook(() => useEntitlement('g1', { emailVerified: false }));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(true);
    expect(result.current.areas).toEqual([]);
  });
});

describe('full access is never held back by an unconfirmed address', () => {
  it('a paying account, new or old, holds every area and is asked nothing', async () => {
    for (const predates of [false, true]) {
      account = { entitlement: PAID, freeArea: null, predates };
      const { result, unmount } = renderHook(() => useEntitlement(`p-${predates}`, { emailVerified: false }));
      await settle(result);
      expect(result.current.tier).toBe('individual');
      expect(result.current.areas).toEqual(AREAS);
      expect(result.current.needsEmailConfirmation).toBe(false);
      expect(result.current.needsFreeArea).toBe(false);
      expect(result.current.switchNeedsConfirmation).toBe(false);
      unmount();
    }
  });

  it('even when this app made the account a minute ago and the email is unopened', async () => {
    account = { entitlement: PAID, freeArea: null, predates: false };
    markConfirmationRequired('p1', 'p1@uni.ac.uk');
    const { result } = renderHook(() => useEntitlement('p1', { emailVerified: false }));
    await settle(result);
    expect(result.current.areas).toEqual(AREAS);
    expect(result.current.needsEmailConfirmation).toBe(false);
  });

  it('a subscription that has ended leaves a free account, which is then asked like any other', async () => {
    account = { entitlement: { ...PAID, expiresAt: '2026-01-01T00:00:00.000Z' }, freeArea: null, predates: false };
    const { result } = renderHook(() => useEntitlement('p2', { emailVerified: false }));
    await settle(result);
    expect(result.current.tier).toBe('free');
    expect(result.current.needsEmailConfirmation).toBe(true);
  });
});

describe('a guest, and a build with no accounts', () => {
  it('a guest is asked for an account, not for a confirmation', async () => {
    const { result } = renderHook(() => useEntitlement('g1', { guest: true, emailVerified: false }));
    await settle(result);
    expect(result.current.guest).toBe(true);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.switchNeedsConfirmation).toBe(false);
  });

  it('a local build has nobody to confirm: the free area works as it always did', async () => {
    vi.stubEnv('VITE_PERSISTENCE', 'local');
    const { result } = renderHook(() => useEntitlement('local-1', { emailVerified: false }));
    await settle(result);
    expect(result.current.needsEmailConfirmation).toBe(false);
    expect(result.current.switchNeedsConfirmation).toBe(false);
    expect(result.current.areas).toEqual(['shoulder']);
    act(() => result.current.chooseFreeArea('knee'));
    await waitFor(() => expect(result.current.areas).toEqual(['knee']));
  });
});
