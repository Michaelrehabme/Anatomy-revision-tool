import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CurrentRole } from '../../../roles/types';

/**
 * The condition that matters here is the second one.
 *
 * In the public demo `useCurrentRole` is aliased to a stand-in that reports
 * every visitor as an admin, while App.tsx drops the /admin route entirely.
 * Gating the entrance on `isAdmin` alone therefore shows an Admin tab to every
 * course leader trying the demo and lands them on nothing — the exact audience
 * the demo exists to impress.
 */

const role = vi.fn<() => CurrentRole>();
vi.mock('../../../roles/useCurrentRole', () => ({ useCurrentRole: () => role() }));

const { useAdminEntry } = await import('../useAdminEntry');

const ADMIN: CurrentRole = { uid: 'u1', isAdmin: true, loading: false };

beforeEach(() => {
  role.mockReset();
  vi.stubEnv('VITE_PUBLIC_DEMO', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('useAdminEntry', () => {
  it('offers the entrance to an admin', () => {
    role.mockReturnValue(ADMIN);
    expect(renderHook(() => useAdminEntry()).result.current).toBe(true);
  });

  it('does not offer it to a student', () => {
    role.mockReturnValue({ uid: 'u2', isAdmin: false, loading: false });
    expect(renderHook(() => useAdminEntry()).result.current).toBe(false);
  });

  it('never offers it in the public demo, where every visitor reads as an admin', () => {
    vi.stubEnv('VITE_PUBLIC_DEMO', '1');
    role.mockReturnValue(ADMIN);
    expect(renderHook(() => useAdminEntry()).result.current).toBe(false);
  });

  it('waits for the role to resolve rather than appearing a beat late', () => {
    role.mockReturnValue({ uid: null, isAdmin: true, loading: true });
    expect(renderHook(() => useAdminEntry()).result.current).toBe(false);
  });
});
