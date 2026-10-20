import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProgressTabs } from '../ProgressTabs';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const renderTabs = () => render(<ProgressTabs mastery={<p>mastery panel</p>} accuracy={<p>accuracy panel</p>} />);

describe('ProgressTabs', () => {
  it('opens on Mastery, with only its panel mounted', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: 'Mastery' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('mastery panel')).toBeTruthy();
    expect(screen.queryByText('accuracy panel')).toBeNull();
  });

  it('switches on click and remembers the choice', () => {
    renderTabs();
    fireEvent.click(screen.getByRole('tab', { name: 'Accuracy' }));
    expect(screen.getByText('accuracy panel')).toBeTruthy();
    expect(screen.queryByText('mastery panel')).toBeNull();
    cleanup();
    renderTabs();
    expect(screen.getByRole('tab', { name: 'Accuracy' }).getAttribute('aria-selected')).toBe('true');
  });

  it('moves with the arrow keys, keeping only the open tab in the tab order', () => {
    renderTabs();
    const mastery = screen.getByRole('tab', { name: 'Mastery' });
    fireEvent.keyDown(mastery, { key: 'ArrowRight' });
    const accuracy = screen.getByRole('tab', { name: 'Accuracy' });
    expect(accuracy.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(accuracy);
    expect(mastery.getAttribute('tabindex')).toBe('-1');
    fireEvent.keyDown(accuracy, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Mastery' }).getAttribute('aria-selected')).toBe('true');
  });
});
