import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Achievements } from '../Achievements/Achievements';
import { MobileAchievements } from '../mobile/MobileAchievements';
import { ACHIEVEMENT_DEFINITIONS } from '../../lib/achievements';

/**
 * Unearned achievements are not dimmed by opacity
 * (docs/ACCESSIBILITY-AUDIT-2026-10-04.md: 27 contrast failures, 1.4.3).
 *
 * The contrast suite (lib/__tests__/contrast.test.ts) measures token pairs.
 * It cannot see `opacity: 0.45` on a row, which multiplied every pair in it
 * down below the minimum. So the rule held here is the one that keeps the
 * suite's measurement true of this screen: no opacity on the row or anything
 * in it, and an unearned title in the muted ink, which is a measured pair.
 */

afterEach(cleanup);

const LAYOUTS = [
  {
    name: 'desktop',
    renderPage: () =>
      render(
        <MemoryRouter>
          <Achievements repository={null} userId={null} onNavigate={vi.fn()} />
        </MemoryRouter>,
      ),
  },
  { name: 'mobile', renderPage: () => render(<MobileAchievements repository={null} userId={null} onBack={vi.fn()} />) },
] as const;

describe.each(LAYOUTS)('unearned achievements on $name', ({ renderPage }) => {
  it('are not dimmed by opacity, anywhere on the screen', () => {
    // No repository: nothing is earned, so every row is an unearned one.
    const { container } = renderPage();
    const dimmed = [...container.querySelectorAll<HTMLElement>('*')].filter((el) => el.style.opacity !== '' && el.style.opacity !== '1');
    expect(dimmed.map((el) => el.textContent)).toEqual([]);
  });

  it('are told apart in words and by the muted ink, not by colour alone', () => {
    renderPage();
    const first = ACHIEVEMENT_DEFINITIONS[0];
    expect(screen.getByText(first.title).style.color).toBe('var(--ink3)');
    expect(screen.getAllByText(/^Not yet/).length).toBe(ACHIEVEMENT_DEFINITIONS.length);
  });
});
