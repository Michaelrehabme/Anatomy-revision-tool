import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminSection } from '../AdminSection';
import { ADMIN_PAGES } from '../../../../admin/adminPages';

const adminEntry = vi.fn<() => boolean>();
vi.mock('../../../hooks/useAdminEntry', () => ({ useAdminEntry: () => adminEntry() }));

beforeEach(() => adminEntry.mockReset());

describe('AdminSection', () => {
  it('renders nothing for a student', () => {
    adminEntry.mockReturnValue(false);
    render(<MemoryRouter><AdminSection /></MemoryRouter>);
    expect(screen.queryByTestId('admin-section')).toBeNull();
  });

  it('links an admin to every admin page', () => {
    adminEntry.mockReturnValue(true);
    render(<MemoryRouter><AdminSection /></MemoryRouter>);
    for (const page of ADMIN_PAGES) {
      expect(screen.getByRole('link', { name: page.label }).getAttribute('href')).toBe(page.path);
    }
  });
});
