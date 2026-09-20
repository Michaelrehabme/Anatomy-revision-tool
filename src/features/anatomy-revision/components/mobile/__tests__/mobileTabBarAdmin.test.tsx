import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileTabBar } from '../MobileTabBar';

/**
 * The bar once grew a fifth tab for an admin. Five tabs on a narrow phone
 * was tight, and the admin entrance now lives on the Account screen
 * (Account/AdminSection). What these pin is that the bar is the same four
 * tabs for everyone, admin or not.
 */

const adminEntry = vi.fn<() => boolean>();
vi.mock('../../../hooks/useAdminEntry', () => ({ useAdminEntry: () => adminEntry() }));

function renderBar() {
  return render(
    <MemoryRouter>
      <MobileTabBar active="today" onNavigate={() => {}} />
    </MemoryRouter>,
  );
}

beforeEach(() => adminEntry.mockReset());

describe('MobileTabBar', () => {
  it('shows four tabs and no admin entry for a student', () => {
    adminEntry.mockReturnValue(false);
    renderBar();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });

  it('shows the same four tabs for an admin — the entrance is on Account', () => {
    adminEntry.mockReturnValue(true);
    renderBar();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });
});
