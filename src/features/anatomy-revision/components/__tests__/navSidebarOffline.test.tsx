import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

/**
 * The sidebar's level bar when its one read cannot be answered.
 *
 * Offline with nothing cached, Firestore rejects a single-document read
 * ("Failed to get document because the client is offline"). The sidebar read
 * the level with no handler for that, and every desktop screen mounts the
 * sidebar — so opening the app offline threw an uncaught error on each of
 * them. Nothing visibly broke, which is how it stayed.
 */

const state = vi.hoisted(() => ({ getGamificationProfile: vi.fn() }));

vi.mock('../../context/AuthProvider', () => ({
  AUTH_ENABLED: true,
  useAuth: () => ({ user: { uid: 'u1', isAnonymous: false, email: 'sam@example.com', displayName: null }, signOut: async () => {} }),
}));

vi.mock('../../hooks/useRepository', () => ({
  useRepository: () => ({
    repository: { getGamificationProfile: state.getGamificationProfile },
    loading: false,
    error: null,
    retry: () => {},
  }),
}));

import { NavSidebar } from '../shell/NavSidebar';

/** Long enough for Node to have reported a rejection nobody handled. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

afterEach(cleanup);

describe('the sidebar level bar', () => {
  it('shows the level when it can be read', async () => {
    state.getGamificationProfile.mockResolvedValue({ xpTotal: 120 });
    render(<NavSidebar active="today" onNavigate={() => {}} />);
    expect(await screen.findByText('120 XP')).toBeTruthy();
  });

  it('throws nothing when the read is refused for being offline, and draws the rest', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      state.getGamificationProfile.mockRejectedValue(
        Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' }),
      );
      render(<NavSidebar active="today" onNavigate={() => {}} />);
      await settle();

      expect(state.getGamificationProfile).toHaveBeenCalledWith('u1');
      expect(unhandled).not.toHaveBeenCalled();
      // No level is drawn, and the navigation is all there.
      expect(screen.queryByText(/XP$/)).toBeNull();
      for (const label of ['Today', 'Study', 'Atlas', 'Progress', 'Account']) {
        expect(screen.getByRole('button', { name: label })).toBeTruthy();
      }
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
