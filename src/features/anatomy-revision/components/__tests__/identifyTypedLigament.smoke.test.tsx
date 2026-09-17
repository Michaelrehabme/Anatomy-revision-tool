import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdentifyTypedSession } from '../IdentifyTypedSession/IdentifyTypedSession';
import { buildIdentifyTypedQuestions } from '../../lib/questionGenerators/identifyTyped';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import type { TypedIdentifyQuestion } from '../../types/question';

/**
 * A ligament's typed identify asks for the name and one box per attachment.
 * Built from the real seed so the boxes are whatever the seed says the
 * ligament attaches to — the generator, not the test, decides how many.
 */
const question = buildIdentifyTypedQuestions(ALL_STRUCTURES, ALL_IMAGES).find(
  (q): q is TypedIdentifyQuestion => q.structureId === 'anterior-tibiofibular-ligament' && !!q.attachmentSlots,
);

describe('IdentifyTypedSession for a ligament', () => {
  it('generates one attachment box per attachment', () => {
    expect(question).toBeDefined();
    expect(question!.attachmentSlots).toHaveLength(2);
    expect(question!.attachmentSlots!.map((s) => s.accepted[0]).sort()).toEqual(['Fibula', 'Tibia']);
  });

  it('is correct only when the name and both attachments are, in any order', () => {
    const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
    const onAnswer = vi.fn();
    render(<IdentifyTypedSession question={question!} imagesById={imagesById} onAnswer={onAnswer} onNext={vi.fn()} examMode />);

    fireEvent.change(screen.getByPlaceholderText("Type the structure's name…"), { target: { value: 'anterior tibiofibular ligament' } });
    // Attachments the other way round from the seed order still pass.
    fireEvent.change(screen.getByLabelText('Attaches to 1'), { target: { value: 'fibula' } });
    fireEvent.change(screen.getByLabelText('Attaches to 2'), { target: { value: 'tibia' } });
    fireEvent.click(screen.getByText('Submit'));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0][0].correct).toBe(true);
    expect(onAnswer.mock.calls[0][0].correctAnswer).toMatch(/attaches to/);
  });

  it('is wrong when an attachment is missing, even with the name right', () => {
    const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
    const onAnswer = vi.fn();
    render(<IdentifyTypedSession question={question!} imagesById={imagesById} onAnswer={onAnswer} onNext={vi.fn()} examMode />);

    fireEvent.change(screen.getByPlaceholderText("Type the structure's name…"), { target: { value: 'anterior tibiofibular ligament' } });
    fireEvent.change(screen.getByLabelText('Attaches to 1'), { target: { value: 'tibia' } });
    fireEvent.click(screen.getByText('Submit'));

    expect(onAnswer.mock.calls[0][0].correct).toBe(false);
  });
});
