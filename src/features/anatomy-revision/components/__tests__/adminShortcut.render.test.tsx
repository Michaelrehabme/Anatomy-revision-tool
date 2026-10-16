import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** The admin shortcut (16 October 2026): there for an admin, absent for everyone else. */

const role = vi.hoisted(() => ({ isAdmin: false }));
vi.mock('../../hooks/useAdminEntry', () => ({ useAdminEntry: () => role.isAdmin }));

const { AdminShortcut, ADMIN_SHORTCUT_PATH } = await import('../shared/AdminShortcut');

afterEach(cleanup);

describe('the admin shortcut', () => {
  it('takes an admin straight to the Feedback page, on both layouts', () => {
    role.isAdmin = true;
    render(<MemoryRouter><AdminShortcut variant="sidebar" /><AdminShortcut variant="bar" /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: 'Admin' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.getAttribute('href')).toBe(ADMIN_SHORTCUT_PATH);
    expect(ADMIN_SHORTCUT_PATH).toBe('/admin/feedback');
  });

  it('is not there for a student', () => {
    role.isAdmin = false;
    const { container } = render(<MemoryRouter><AdminShortcut variant="sidebar" /></MemoryRouter>);
    expect(container.textContent).toBe('');
  });
});
