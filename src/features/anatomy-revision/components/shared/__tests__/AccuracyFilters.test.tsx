import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AccuracyFilters, accuracyFilterSummary } from '../AccuracyFilters';
import { useAccuracyFilter } from '../../../hooks/useAccuracyFilter';
import { getAccuracyFiltersOpen } from '../../../lib/preferences';
import type { AnatomyContent } from '../../../hooks/useAnatomyContent';

/** No answers and no structures: the "Last N" chips carry no count, so they stay pressable. */
const EMPTY_CONTENT = { structures: [] } as unknown as AnatomyContent;

function Harness() {
  const accuracy = useAccuracyFilter([], EMPTY_CONTENT);
  return <AccuracyFilters accuracy={accuracy} compact />;
}

beforeEach(() => localStorage.clear());

describe('accuracyFilterSummary', () => {
  it('reads "All answers" when nothing narrows the chart', () => {
    expect(accuracyFilterSummary({ formats: new Set(), areas: new Set(), last: null })).toBe('All answers');
  });

  it('lists formats, then areas, then the answer window, in the rows\' own order', () => {
    expect(accuracyFilterSummary({ formats: new Set(['locate']), areas: new Set(['knee']), last: 50 })).toBe('Locate · Knee · Last 50');
  });
});

describe('AccuracyFilters', () => {
  it('starts folded, with the summary in view and the chip rows hidden', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Filters' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const rows = document.getElementById(button.getAttribute('aria-controls')!);
    expect(rows).not.toBeVisible();
    expect(screen.getByTestId('accuracy-filter-summary')).toHaveTextContent('All answers');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('opens and closes the rows, and remembers the choice', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(button.getAttribute('aria-controls')!)).toBeVisible();
    expect(screen.queryByTestId('accuracy-filter-summary')).toBeNull();
    expect(getAccuracyFiltersOpen()).toBe(true);

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(getAccuracyFiltersOpen()).toBe(false);
  });

  it('opens on a later visit if it was left open', () => {
    const first = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    first.unmount();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('summarises an active filter while folded, with Clear filters still in reach', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'Last 50' }));
    fireEvent.click(button);

    expect(screen.getByTestId('accuracy-filter-summary')).toHaveTextContent('Last 50');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('accuracy-filter-summary')).toHaveTextContent('All answers');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });
});
