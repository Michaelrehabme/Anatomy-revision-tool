import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OinaSession } from '../OinaSession/OinaSession';
import { FlashcardSession } from '../FlashcardSession/FlashcardSession';
import { buildOinaQuestions } from '../../lib/questionGenerators/oina';
import { buildFieldFlashcard } from '../../lib/questionGenerators/flashcards';
import { buildIndexes } from '../../lib/indexes';
import { createRng } from '../../lib/rng';
import { ALL_STRUCTURES } from '../../data/seed';
import type { OinaSelectQuestion, OinaTypedQuestion } from '../../types/question';

const muscle = ALL_STRUCTURES.find((s) => s.id === 'biceps-femoris')!;
const indexes = buildIndexes(ALL_STRUCTURES);

const question = (format: 'select' | 'typed') =>
  buildOinaQuestions([muscle], ALL_STRUCTURES, indexes, createRng(3), {
    promptKinds: ['origin'],
    forceFormat: format,
  })[0];

describe('OinaSession (select)', () => {
  const q = question('select') as OinaSelectQuestion;

  it('renders the prompt, the choices and how many are correct', () => {
    render(<OinaSession question={q} onAnswer={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByText('Select every origin of Biceps Femoris.')).toBeInTheDocument();
    expect(screen.getByText(/2 correct answers/)).toBeInTheDocument();
    for (const choice of q.choices) expect(screen.getByText(choice)).toBeInTheDocument();
  });

  it('only reports correct when every value is selected and nothing else', () => {
    const onAnswer = vi.fn();
    render(<OinaSession question={q} onAnswer={onAnswer} onNext={vi.fn()} />);

    // One of two — a partial answer is wrong, whatever the credit would be.
    fireEvent.click(screen.getByText(q.choices[q.correctIndices[0]]));
    fireEvent.click(screen.getByText('Check answer'));
    fireEvent.click(screen.getByText('Hard'));
    expect(onAnswer.mock.calls[0][0].correct).toBe(false);
  });

  it('accepts the complete set', () => {
    const onAnswer = vi.fn();
    render(<OinaSession question={q} onAnswer={onAnswer} onNext={vi.fn()} />);
    for (const i of q.correctIndices) fireEvent.click(screen.getByText(q.choices[i]));
    fireEvent.click(screen.getByText('Check answer'));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Easy'));
    expect(onAnswer.mock.calls[0][0].correct).toBe(true);
  });
});

describe('OinaSession (typed)', () => {
  const q = question('typed') as OinaTypedQuestion;

  it('renders one box per authored value, labelled with the count', () => {
    render(<OinaSession question={q} onAnswer={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByText('origin 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('origin 2 of 2')).toBeInTheDocument();
  });

  it('grades order-independently and reveals what was missed', () => {
    const onAnswer = vi.fn();
    render(<OinaSession question={q} onAnswer={onAnswer} onNext={vi.fn()} />);
    const boxes = screen.getAllByRole('textbox');
    // Deliberately the other way round, and with a typo in the first.
    fireEvent.change(boxes[0], { target: { value: 'linea aspera of the femur' } });
    fireEvent.change(boxes[1], { target: { value: 'ischial tuberocity' } });
    fireEvent.click(screen.getByText('Check answer'));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Easy'));
    expect(onAnswer.mock.calls[0][0].correct).toBe(true);
  });

  it('marks a blank box wrong and shows the answer for it', () => {
    render(<OinaSession question={q} onAnswer={vi.fn()} onNext={vi.fn()} />);
    const boxes = screen.getAllByRole('textbox');
    fireEvent.change(boxes[0], { target: { value: 'ischial tuberosity' } });
    fireEvent.click(screen.getByText('Check answer'));
    expect(screen.getByText('Not quite')).toBeInTheDocument();
    expect(screen.getByText('1/2 found')).toBeInTheDocument();
    // Revealed in its authored form, so a missed slot also teaches which head it was.
    expect(screen.getByText('Short head: linea aspera of the femur')).toBeInTheDocument();
  });
});

describe('FlashcardSession', () => {
  const card = buildFieldFlashcard(muscle, 'origin')!;

  it('reveals and moves on, with nothing to answer', () => {
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<FlashcardSession question={card} imagesById={new Map()} onAnswer={onAnswer} onNext={onNext} />);

    expect(screen.getByText('Learn · not scored')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByText('Reveal answer'));
    expect(onAnswer).toHaveBeenCalledWith({ structureId: 'biceps-femoris', correct: true, graded: false });
    expect(screen.getByText(card.back.text)).toBeInTheDocument();

    // No self-rating any more — the card is purely for learning.
    expect(screen.queryByText('Easy')).toBeNull();
    expect(screen.queryByText('Hard')).toBeNull();

    fireEvent.click(screen.getByText('Next'));
    expect(onNext).toHaveBeenCalled();
  });
});
