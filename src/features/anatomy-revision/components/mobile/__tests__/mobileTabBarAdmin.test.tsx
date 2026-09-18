import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileTabBar } from '../MobileTabBar';

/**
 * The bar had four tabs and no way to reach /admin from a phone at all. What
 * these pin is that the fifth one is a real link to the admin route, that a
 * student never sees it, and that it does not join the section tabs — /admin
 * is a separate route tree, so it can never be the "active" tab.
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

  it('adds an Admin link for an admin, pointing at the admin route', () => {
    adminEntry.mockReturnValue(true);
    renderBar();
    // Still four section BUTTONS — admin is a link, not a fifth section.
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin');
  });

  it('does not route the admin entry through the section navigator', () => {
    adminEntry.mockReturnValue(true);
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <MobileTabBar active="today" onNavigate={onNavigate} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Admin' }));
    // The router owns this one; the section navigator must never hear about it.
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
