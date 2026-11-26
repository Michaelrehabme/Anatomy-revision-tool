import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorrectionsPage, formatCorrectionDate } from '../CorrectionsPage';
import { CORRECTIONS } from '../data/corrections';

/**
 * /corrections is the evidence behind the terms' promise that reported errors
 * get fixed. It breaks quietly: an entry with a malformed date sorts wrongly
 * or prints "undefined", or an entry is listed twice. These pin that.
 */

describe('CorrectionsPage', () => {
  it('lists every correction', () => {
    render(<MemoryRouter><CorrectionsPage /></MemoryRouter>);
    for (const c of CORRECTIONS) {
      expect(screen.getByText(c.change)).toBeInTheDocument();
    }
  });

  it('shows the newest date first', () => {
    render(<MemoryRouter><CorrectionsPage /></MemoryRouter>);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    const newest = [...CORRECTIONS].map((c) => c.date).sort().at(-1)!;
    expect(headings[0]).toBe(formatCorrectionDate(newest));
  });

  it('gives every entry a real ISO date and a unique structure per day', () => {
    const seen = new Set<string>();
    for (const c of CORRECTIONS) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(c.date))).toBe(false);
      const key = `${c.date}|${c.structure}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('formats dates without a time-zone shift', () => {
    expect(formatCorrectionDate('2026-11-01')).toBe('1 November 2026');
  });
});
