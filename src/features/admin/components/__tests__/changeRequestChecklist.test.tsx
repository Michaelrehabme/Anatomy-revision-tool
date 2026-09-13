import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChangeRequestChecklist } from '../ChangeRegister/ChangeRequestChecklist';
import type { ChecklistItem } from '../../types/changeRequest';

/**
 * Smoke coverage for the tickable checklist under jsdom. The pure ordering and
 * tick-state rules are tested in lib/__tests__/checklist.test.ts; what this
 * pins is the part that only exists in the component — that the control is a
 * real checkbox a keyboard can reach, that an untick needs a second click, and
 * that the walkthrough is behind a disclosure rather than a hover.
 */

const ITEMS: ChecklistItem[] = [
  {
    id: 'second',
    rank: 2,
    label: 'Email the course leaders',
    why: 'The window closes in weeks.',
    walkthrough: '1. Build the list.\n2. Send the email.',
    effort: '2 weeks',
  },
  {
    id: 'first',
    rank: 1,
    label: 'Register with the ICO',
    why: 'The duty is already live.',
    walkthrough: '1. Run the fee self-assessment.',
    effort: '1 hour',
    links: [{ label: 'ICO fee self-assessment', url: 'https://ico.org.uk/fee-self-assessment' }],
  },
];

describe('ChangeRequestChecklist', () => {
  it('renders steps in rank order, not declaration order', () => {
    const { container } = render(<ChangeRequestChecklist items={ITEMS} done={undefined} onToggle={() => {}} />);
    // Rank 1 is declared SECOND in ITEMS, so reading the list back in order is the assertion.
    const steps = Array.from(container.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(steps).toHaveLength(2);
    expect(steps[0]).toContain('Register with the ICO');
    expect(steps[1]).toContain('Email the course leaders');
  });

  it('exposes each step as a real checkbox reflecting stored tick state', () => {
    render(<ChangeRequestChecklist items={ITEMS} done={{ first: '2026-09-13T10:00:00.000Z' }} onToggle={() => {}} />);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes[0].checked).toBe(true);
    expect(boxes[1].checked).toBe(false);
  });

  it('ticks immediately, with no confirmation step', () => {
    const onToggle = vi.fn();
    render(<ChangeRequestChecklist items={ITEMS} done={undefined} onToggle={onToggle} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onToggle).toHaveBeenCalledWith('first');
  });

  it('requires a second click to untick, because unticking discards the completion date', () => {
    const onToggle = vi.fn();
    render(
      <ChangeRequestChecklist items={ITEMS} done={{ first: '2026-09-13T10:00:00.000Z' }} onToggle={onToggle} />,
    );
    const box = screen.getAllByRole('checkbox')[0];

    fireEvent.click(box);
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByText(/discards the date it was completed/)).toBeTruthy();

    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith('first');
  });

  it('reports progress and names the highest-ranked outstanding step', () => {
    render(<ChangeRequestChecklist items={ITEMS} done={{ first: '2026-09-13T10:00:00.000Z' }} onToggle={() => {}} />);
    expect(screen.getByText('1/2 done')).toBeTruthy();
    // The label appears twice by design — once in the list, once as "Next up".
    expect(screen.getAllByText('Email the course leaders')).toHaveLength(2);
    expect(screen.getAllByText('Register with the ICO')).toHaveLength(1);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('2');
  });

  it('keeps the walkthrough behind a keyboard-reachable disclosure', () => {
    render(<ChangeRequestChecklist items={ITEMS} done={undefined} onToggle={() => {}} />);
    expect(screen.queryByText('1. Run the fee self-assessment.')).toBeNull();

    const toggle = screen.getByRole('button', { name: /Walkthrough \(1 steps\)/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(screen.getByText('1. Run the fee self-assessment.')).toBeTruthy();
    expect(screen.getByText(/The duty is already live/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Hide walkthrough/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('shows a step\'s links inside the disclosure, opening them safely in a new tab', () => {
    render(<ChangeRequestChecklist items={ITEMS} done={undefined} onToggle={() => {}} />);
    expect(screen.queryByRole('link', { name: 'ICO fee self-assessment' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Walkthrough \(1 steps\)/ }));

    const link = screen.getByRole('link', { name: 'ICO fee self-assessment' });
    expect(link.getAttribute('href')).toBe('https://ico.org.uk/fee-self-assessment');
    expect(link.getAttribute('target')).toBe('_blank');
    // rel is not decoration here — target="_blank" without it hands the opened tab a window.opener.
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders no links section for a step that has none', () => {
    render(<ChangeRequestChecklist items={ITEMS} done={undefined} onToggle={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Walkthrough \(2 steps\)/ }));
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('flags stored ticks whose step id no longer exists rather than dropping them silently', () => {
    render(
      <ChangeRequestChecklist items={ITEMS} done={{ 'renamed-step': '2026-09-13T10:00:00.000Z' }} onToggle={() => {}} />,
    );
    expect(screen.getByText(/renamed-step/)).toBeTruthy();
    expect(screen.getByText('0/2 done')).toBeTruthy();
  });
});
