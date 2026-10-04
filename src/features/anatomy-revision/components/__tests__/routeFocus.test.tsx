import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { PageTitle } from '../shared/PageTitle';

/**
 * Following a link that replaces the thing you pressed used to leave focus on
 * the page body (WCAG 2.4.3) — found by the keyboard pass of 4 October 2026.
 */
function List() {
  const navigate = useNavigate();
  return (
    <main>
      <h1>Atlas</h1>
      <button type="button" onClick={() => navigate('/structure/deltoid')}>Deltoid</button>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <>
      <nav>
        <button type="button" onClick={() => navigate('/structure/deltoid')}>Card</button>
      </nav>
      {children}
    </>
  );
}

const card = (
  <main>
    <h1>Deltoid</h1>
  </main>
);

describe('focus after a navigation', () => {
  it('goes to the new page heading when the control that was pressed is gone', async () => {
    render(
      <MemoryRouter initialEntries={['/atlas']}>
        <PageTitle />
        <Routes>
          <Route path="/atlas" element={<List />} />
          <Route path="/structure/:id" element={card} />
        </Routes>
      </MemoryRouter>,
    );
    // Not on first load: nobody pressed anything.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(document.body);

    const row = screen.getByRole('button', { name: 'Deltoid' });
    row.focus();
    fireEvent.click(row);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Deltoid' })));
  });

  it('leaves focus alone when the control that was pressed is still there', async () => {
    render(
      <MemoryRouter initialEntries={['/atlas']}>
        <PageTitle />
        <Shell>
          <Routes>
            <Route path="/atlas" element={<h1>Atlas</h1>} />
            <Route path="/structure/:id" element={card} />
          </Routes>
        </Shell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('button', { name: 'Card' });
    nav.focus();
    fireEvent.click(nav);
    await screen.findByRole('heading', { name: 'Deltoid' });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(nav);
  });
});
