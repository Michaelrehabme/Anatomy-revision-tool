import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccuracyTrendChart } from '../shared/AccuracyTrendChart';
import type { AccuracyTrendPoint } from '../../lib/accuracyTrend';

function series(pcts: (number | null)[]): AccuracyTrendPoint[] {
  return pcts.map((studentPct, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    studentPct,
    cohortPct: null,
    studentAttempts: studentPct === null ? 0 : 8,
    cohortAttempts: 0,
  }));
}

describe('AccuracyTrendChart with a secondary line', () => {
  it('shows a legend entry and a distinct dashed path for the second series', () => {
    const { container } = render(
      <AccuracyTrendChart
        points={series([null, null, 70, 75, 80])}
        studentName="Seen before"
        secondary={{ label: 'First sight', points: series([50, 55, 52, null, null]) }}
      />,
    );
    expect(screen.getByText('Seen before')).toBeInTheDocument();
    expect(screen.getByText('First sight')).toBeInTheDocument();
    const dashed = container.querySelectorAll('path[stroke-dasharray="2 3"]');
    const solid = container.querySelectorAll('path:not([stroke-dasharray])');
    expect(dashed.length).toBeGreaterThan(0);
    expect(solid.length).toBeGreaterThan(0);
  });

  it('still draws when only the first-sight line has enough points', () => {
    render(
      <AccuracyTrendChart
        points={series([null, null, null])}
        studentName="Seen before"
        secondary={{ label: 'First sight', points: series([50, 55, 60]) }}
      />,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByText(/Not enough attempts yet/)).toBeNull();
  });
});
