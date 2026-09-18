import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccessibilityPage } from '../AccessibilityPage';

/**
 * A statement is assessed by someone who will test one of its claims. What is
 * pinned here is that it admits the gaps rather than claiming full compliance
 * — an overstatement is worse than no statement, because the first thing a
 * reviewer does is try to disprove something.
 */

function renderPage() {
  render(<MemoryRouter><AccessibilityPage /></MemoryRouter>);
}

describe('AccessibilityPage', () => {
  it('claims partial compliance, not full', () => {
    renderPage();
    expect(screen.getByText(/Partially compliant/)).toBeTruthy();
    expect(screen.queryByText(/fully compliant/i)).toBeNull();
  });

  it('names the locate list as not equivalent rather than as a solution', () => {
    renderPage();
    expect(screen.getByText(/not equivalent/i)).toBeTruthy();
    expect(screen.getByText(/easier question than finding a structure/)).toBeTruthy();
  });

  it('admits there has been no independent audit', () => {
    renderPage();
    expect(screen.getByText(/No full audit has been carried out/)).toBeTruthy();
  });

  it('gives a route to report a problem and an escalation', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /michael@rehabme.uk/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /equalityadvisoryservice/ })).toBeTruthy();
  });

  it('tells an institution plainly what does not exist', () => {
    renderPage();
    expect(screen.getByText(/no formal conformance report, ISO certification or third-party/)).toBeTruthy();
  });

  it('commits the outstanding work to a deadline', () => {
    renderPage();
    expect(screen.getByText(/Before the first pilot cohort completes a term/)).toBeTruthy();
  });
});
