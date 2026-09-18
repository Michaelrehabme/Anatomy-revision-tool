import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RefundsPage } from '../RefundsPage';
import { CoolingOffWaiver } from '../CoolingOffWaiver';

/**
 * The waiver is the only reason "no refunds once you start" is lawful rather
 * than decorative, and the Regulations are specific about how consent must be
 * taken. These pin the parts that would quietly invalidate it: a pre-ticked
 * box, a missing acknowledgement of what is lost, or no alternative to taking
 * the deal.
 */

function page() {
  render(<MemoryRouter><RefundsPage /></MemoryRouter>);
}

function waiver(props: Partial<React.ComponentProps<typeof CoolingOffWaiver>> = {}) {
  const onChange = vi.fn();
  render(
    <MemoryRouter>
      <CoolingOffWaiver checked={false} onChange={onChange} {...props} />
    </MemoryRouter>,
  );
  return onChange;
}

describe('RefundsPage', () => {
  it('states the cancellation terms the owner asked for', () => {
    page();
    expect(screen.getByText(/keep access until the end of the period/i)).toBeTruthy();
    expect(screen.getByText(/no fee, no notice period/i)).toBeTruthy();
  });

  it('does not claim a blanket no-refunds term', () => {
    page();
    // A flat "no refunds" is unenforceable against a UK consumer and would be
    // a term the page cannot rely on.
    expect(screen.queryByText(/^no refunds$/i)).toBeNull();
    expect(screen.getByText(/14 days to change your mind/i)).toBeTruthy();
  });

  it('names the cases where a refund is given anyway', () => {
    page();
    expect(screen.getByText(/You were charged twice/)).toBeTruthy();
    expect(screen.getByText(/unusable for a meaningful stretch/)).toBeTruthy();
  });

  it('says who the seller actually is, and where we cannot help', () => {
    page();
    expect(screen.getByText(/merchant of record/)).toBeTruthy();
    expect(screen.getByText(/cannot refund an App Store purchase/)).toBeTruthy();
  });

  it('preserves statutory rights explicitly', () => {
    page();
    expect(screen.getByText(/Consumer Rights Act 2015/)).toBeTruthy();
  });
});

describe('CoolingOffWaiver', () => {
  it('is never pre-ticked, because a pre-ticked box is not consent', () => {
    waiver();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('states both halves the Regulations require', () => {
    waiver();
    const label = screen.getByRole('checkbox').closest('label')?.textContent ?? '';
    // Express consent to immediate supply...
    expect(label).toMatch(/start\s+immediately/i);
    // ...and acknowledgement of what that costs.
    expect(label).toMatch(/lose my right to cancel within 14 days/i);
  });

  it('offers a real alternative to giving up the right', () => {
    waiver();
    // An option nobody would take is evidence consent was not freely given.
    expect(screen.getByText(/access will begin in 14 days instead/)).toBeTruthy();
  });

  it('reports the acknowledgement to the caller', () => {
    const onChange = waiver();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('explains the block rather than just refusing', () => {
    waiver({ showError: true });
    expect(screen.getByText(/cannot begin a subscription without knowing which you want/)).toBeTruthy();
  });

  it('says nothing about an error until one happens', () => {
    waiver();
    expect(screen.queryByText(/cannot begin a subscription/)).toBeNull();
  });
});
