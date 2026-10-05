import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useEntitlement } from '../useEntitlement';
import type { FreeAreaChoice } from '../../lib/entitlement';
import type { StoredAccess } from '../../lib/entitlementRecord';
import { getFreeAreaChoice, setFreeAreaChoice } from '../../lib/preferences';

/**
 * The free area on the account (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 1).
 * The repository is replaced by a small stand-in that keeps what the rules
 * keep: the first write wins and a second is refused. The rules themselves
 * are tested against the emulator in rules-tests/.
 */

let onAccount: FreeAreaChoice | null = null;
let reachable = true;
const saves: { area: string; switches: number }[] = [];
const SERVER_NOW = '2026-10-05T12:00:00.000Z';

vi.mock('../../data/entitlementRepository', () => ({
  readAccess: async (): Promise<StoredAccess> => {
    if (!reachable) throw new Error('offline');
    return { entitlement: null, freeArea: onAccount };
  },
  saveFreeArea: async (_uid: string, area: FreeAreaChoice['area'], switches: 0 | 1): Promise<FreeAreaChoice> => {
    saves.push({ area, switches });
    if (!reachable) throw new Error('offline');
    if (onAccount && !(onAccount.switches === 0 && switches === 1)) throw new Error('permission-denied');
    onAccount = { area, chosenAt: SERVER_NOW, switches };
    return onAccount;
  },
}));

const LONG_AGO = new Date('2026-01-01T00:00:00.000Z');

describe('the free area, kept on the account', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PERSISTENCE', 'firestore');
    localStorage.clear();
    onAccount = null;
    reachable = true;
    saves.length = 0;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the account's choice over the device's, and copies it to the device", async () => {
    setFreeAreaChoice('hip', 0, LONG_AGO);
    onAccount = { area: 'knee', chosenAt: '2026-09-20T08:00:00.000Z', switches: 1 };

    const { result } = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(result.current.freeArea?.area).toBe('knee'));

    expect(result.current.areas).toEqual(['knee']);
    expect(result.current.switchUsed).toBe(true);
    expect(getFreeAreaChoice()).toEqual(onAccount);
    expect(saves).toEqual([]);
  });

  it("moves a device's choice up once, dated by the server and not by the device", async () => {
    setFreeAreaChoice('hip', 0, LONG_AGO);

    const { result } = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(onAccount?.area).toBe('hip'));
    await waitFor(() => expect(result.current.freeArea?.chosenAt).toBe(SERVER_NOW));

    expect(saves).toEqual([{ area: 'hip', switches: 0 }]);
    // Nine months on the device bought nothing: the wait starts at the move.
    expect(result.current.canSwitchFree).toBe(false);
    expect(getFreeAreaChoice()?.chosenAt).toBe(SERVER_NOW);
  });

  it('moves a used change up as used, and a record older than the limit as used', async () => {
    localStorage.setItem('anatomy-revision:v1:freeArea', JSON.stringify({ area: 'elbow', chosenAt: LONG_AGO.toISOString() }));
    renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(saves).toEqual([{ area: 'elbow', switches: 1 }]));
  });

  it('writes nothing when neither the account nor the device has a choice', async () => {
    const { result } = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(result.current.known).toBe(true));
    expect(result.current.freeArea).toBeNull();
    expect(result.current.areas).toEqual(['shoulder']);
    expect(saves).toEqual([]);
  });

  it('keeps the device copy when the account cannot be read, and says the answer is not known', async () => {
    setFreeAreaChoice('hip', 0, LONG_AGO);
    reachable = false;

    const { result } = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.freeArea?.area).toBe('hip');
    expect(result.current.known).toBe(false);
    expect(saves).toEqual([]);
  });

  it('saves a first pick to the account', async () => {
    const { result } = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(result.current.known).toBe(true));

    act(() => result.current.chooseFreeArea('wrist-hand'));
    expect(result.current.freeArea?.area).toBe('wrist-hand');
    await waitFor(() => expect(onAccount).toEqual({ area: 'wrist-hand', chosenAt: SERVER_NOW, switches: 0 }));
    await waitFor(() => expect(result.current.freeArea?.chosenAt).toBe(SERVER_NOW));
  });

  it('saves the one change as a change', async () => {
    onAccount = { area: 'knee', chosenAt: '2026-08-01T08:00:00.000Z', switches: 0 };
    const { result } = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(result.current.canSwitchFree).toBe(true));

    act(() => result.current.chooseFreeArea('hip'));
    await waitFor(() => expect(onAccount).toEqual({ area: 'hip', chosenAt: SERVER_NOW, switches: 1 }));
    await waitFor(() => expect(result.current.switchUsed).toBe(true));
    expect(result.current.areas).toEqual(['hip']);
  });

  it("puts the account's answer back when the rules refuse a change", async () => {
    // The device copy has been edited to look changeable; the account's has not.
    onAccount = { area: 'knee', chosenAt: '2026-08-01T08:00:00.000Z', switches: 1 };
    const { result } = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(result.current.known).toBe(true));
    localStorage.setItem(
      'anatomy-revision:v1:freeArea',
      JSON.stringify({ area: 'knee', chosenAt: LONG_AGO.toISOString(), switches: 0 }),
    );
    // The hook holds the account's answer, so the app itself will not even ask.
    act(() => result.current.chooseFreeArea('hip'));
    expect(saves).toEqual([]);
    expect(result.current.freeArea?.area).toBe('knee');
  });

  it('does not let a second device move a different choice up over the first', async () => {
    setFreeAreaChoice('hip', 0, LONG_AGO);
    const first = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(onAccount?.area).toBe('hip'));
    first.unmount();

    // Another device, another old choice.
    setFreeAreaChoice('ankle-foot', 0, LONG_AGO);
    const second = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(second.result.current.freeArea?.area).toBe('hip'));
    expect(getFreeAreaChoice()?.area).toBe('hip');
    expect(saves).toHaveLength(1);
  });
});

describe('the free area in a local-persistence build', () => {
  beforeEach(() => {
    localStorage.clear();
    onAccount = { area: 'knee', chosenAt: SERVER_NOW, switches: 1 };
    reachable = true;
    saves.length = 0;
  });

  it('stays on the device and never writes to an account', async () => {
    setFreeAreaChoice('hip', 0, LONG_AGO);
    const { result } = renderHook(() => useEntitlement('local-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.freeArea?.area).toBe('hip');
    act(() => result.current.chooseFreeArea('elbow'));
    await waitFor(() => expect(result.current.freeArea?.area).toBe('elbow'));
    expect(getFreeAreaChoice()).toMatchObject({ area: 'elbow', switches: 1 });
    expect(saves).toEqual([]);
  });
});
