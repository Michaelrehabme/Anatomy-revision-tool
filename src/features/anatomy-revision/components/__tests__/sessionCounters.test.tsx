import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionSidebar } from '../shell/SessionSidebar';

/**
 * The two numbers must be readable as two numbers. Flashcards are outside the
 * question count on purpose — a card is taught, not asked — but with no number
 * of their own, clicking past one and watching the counter stand still reads
 * as a bug rather than as a distinction.
 */
describe('SessionSidebar counters', () => {
  it('counts the cards seen separately from the questions answered', () => {
    render(
      <SessionSidebar current={4} total={15} correctCount={3} wrongCount={1} cardsSeen={2} cardsTotal={5} onEnd={vi.fn()} />,
    );
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('/ 15')).toBeInTheDocument();
    expect(screen.getByText('questions answered')).toBeInTheDocument();

    expect(screen.getByText('Learn cards')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('/ 5')).toBeInTheDocument();
  });

  it('says the cards are not scored, so the two numbers cannot be read as one total', () => {
    render(
      <SessionSidebar current={4} total={15} correctCount={3} wrongCount={1} cardsSeen={0} cardsTotal={5} onEnd={vi.fn()} />,
    );
    expect(screen.getByText('seen · not scored')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows no card block for a session with no cards in it', () => {
    render(<SessionSidebar current={4} total={15} correctCount={3} wrongCount={1} onEnd={vi.fn()} />);
    expect(screen.queryByText('Learn cards')).not.toBeInTheDocument();
  });
});
