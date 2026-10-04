import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LocateStructureSession } from '../LocateStructureSession/LocateStructureSession';
import { MobileLocateStructureSession } from '../mobile/MobileLocateStructureSession';
import { ThemeControls } from '../shared/ThemeControls';
import { ThemeProvider } from '../../context/ThemeProvider';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { buildLocateQuestions } from '../../lib/questionGenerators/locate';
import { getLocateWithoutPicture, setLocateWithoutPicture } from '../../lib/preferences';
import type { LocateQuestion } from '../../types/question';

/**
 * LOCATE WITHOUT THE PICTURE, as a student meets it (docs/accessibility-locate.md).
 *
 * The question asked in words where the seed supports one (B), the list of at
 * least four names where it does not (A), the Account setting that makes it
 * the route a locate question opens on, and the one thing that must hold
 * however it is answered: a description is never reported as a locate.
 */

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  // jsdom has no media queries; the theme provider asks the device for its own.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
beforeEach(() => localStorage.clear());

const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
const structuresById = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const questions = buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES);
const questionFor = (id: string): LocateQuestion => {
  const q = questions.find((x) => x.targetStructureId === id);
  if (!q) throw new Error(`no locate question for ${id}`);
  return q;
};
// A landmark plate: one hotspot, so the list used to be one name long.
const acromion = questionFor('acromion');
// A landmark the seed holds no relations for: no question in words is possible.
const pedicle = questionFor('pedicle');

const desktop = (question: LocateQuestion, props: { onAnswer?: ReturnType<typeof vi.fn>; examMode?: boolean } = {}) =>
  render(
    <LocateStructureSession
      question={question}
      imagesById={imagesById}
      structuresById={structuresById}
      onAnswer={props.onAnswer ?? vi.fn()}
      onNext={vi.fn()}
      examMode={props.examMode}
    />,
  );
const phone = (question: LocateQuestion, onAnswer = vi.fn()) =>
  render(
    <MobileLocateStructureSession
      question={question}
      imagesById={imagesById}
      structuresById={structuresById}
      onAnswer={onAnswer}
      onNext={vi.fn()}
      onFullCard={vi.fn()}
    />,
  );

/** Open the words route and wait for the options, which arrive with a lazily loaded module. */
async function openWords() {
  fireEvent.click(screen.getByRole('button', { name: /^Answer without the picture/ }));
  return screen.findByRole('group', { name: /Descriptions|Structure names/ });
}

const ACROMION_ANSWER =
  'Part of: Scapula. Attached here: Deltoid origin (acromial part); Trapezius insertion (upper fibres). Articulates: Acromioclavicular joint with the clavicle.';

describe('a locate question asked in words (desktop)', () => {
  it('opens on the picture, with a button whose name begins with its own words', () => {
    desktop(acromion);
    expect(screen.getByRole('img')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /^Answer without the picture/ });
    // WCAG 2.5.3: someone using voice control says what they can read.
    expect(toggle.textContent).toBe('Answer without the picture');
    expect(screen.getByText(/If you cannot see the image/)).toBeInTheDocument();
  });

  it('asks where the structure sits, with four descriptions and no picture', async () => {
    desktop(acromion);
    const group = await openWords();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Which of these describes where the Acromion sits?');
    expect(screen.queryByRole('img')).toBeNull();
    const options = within(group).getAllByRole('button');
    expect(options).toHaveLength(4);
    expect(options.filter((o) => o.textContent!.includes(ACROMION_ANSWER))).toHaveLength(1);
    // The arrow keys move between them without choosing, as on multiple choice.
    options[0].focus();
    fireEvent.keyDown(options[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);
    expect(screen.queryByRole('heading', { name: /Correct|Not quite/ })).toBeNull();
  });

  it('a right answer: the verdict takes focus, and it is reported as a description, not a locate', async () => {
    const onAnswer = vi.fn();
    desktop(acromion, { onAnswer });
    const group = await openWords();
    fireEvent.click(within(group).getByRole('button', { name: new RegExp(ACROMION_ANSWER.replace(/[()]/g, '\\$&')) }));
    const verdict = screen.getByRole('heading', { name: /^Correct/ });
    expect(document.activeElement).toBe(verdict);
    expect(verdict.getAttribute('aria-label')).toContain(ACROMION_ANSWER);
    // Nothing is recorded until it is rated, as with every other study answer.
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Medium/ }));
    expect(onAnswer).toHaveBeenCalledWith({
      structureId: 'acromion',
      correct: true,
      selectedAnswer: ACROMION_ANSWER,
      correctAnswer: ACROMION_ANSWER,
      route: 'described-region',
      confidence: 'medium',
    });
    // Once answered there is no going back for a second go on the picture.
    expect(screen.queryByRole('button', { name: /Answer on the picture/ })).toBeNull();
  });

  it('a wrong answer says in words, not only in colour, which was right and which was chosen', async () => {
    const onAnswer = vi.fn();
    desktop(acromion, { onAnswer });
    const group = await openWords();
    const wrong = within(group).getAllByRole('button').find((o) => !o.textContent!.includes(ACROMION_ANSWER))!;
    fireEvent.click(wrong);
    expect(wrong.textContent).toMatch(/\(wrong\)$/);
    expect(within(group).getAllByRole('button').find((o) => o.textContent!.includes(ACROMION_ANSWER))!.textContent).toMatch(/\(correct, not chosen\)$/);
    expect(screen.getByRole('heading', { name: /^Not quite/ }).getAttribute('aria-label')).toContain(ACROMION_ANSWER);
    fireEvent.click(screen.getByRole('button', { name: /Hard/ }));
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, route: 'described-region', correctAnswer: ACROMION_ANSWER });
    expect(onAnswer.mock.calls[0][0].selectedAnswer).not.toBe(ACROMION_ANSWER);
  });

  it('in an exam: recorded at once, and nothing says whether it was right', async () => {
    const onAnswer = vi.fn();
    desktop(acromion, { onAnswer, examMode: true });
    const group = await openWords();
    const wrong = within(group).getAllByRole('button').find((o) => !o.textContent!.includes(ACROMION_ANSWER))!;
    fireEvent.click(wrong);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, route: 'described-region' });
    expect(screen.getByText('Answer recorded.')).toBeInTheDocument();
    expect(group.textContent).not.toMatch(/\((correct|wrong)/);
    expect(screen.queryByRole('heading', { name: /Correct|Not quite/ })).toBeNull();
  });

  it('can be swapped for the picture and back until it is answered', async () => {
    desktop(acromion);
    await openWords();
    const back = screen.getByRole('button', { name: /^Answer on the picture/ });
    expect(back.textContent).toBe('Answer on the picture');
    fireEvent.click(back);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(acromion.prompt);
  });
});

describe('the list of names, where the question cannot be asked in words', () => {
  it('offers at least four names in name order, and says what to do with them', async () => {
    desktop(pedicle);
    const group = await openWords();
    expect(group.getAttribute('aria-label')).toMatch(/^Structure names/);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Choose Pedicle from the list.');
    const names = within(group).getAllByRole('button').map((b) => b.textContent!);
    expect(names.length).toBeGreaterThanOrEqual(4);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain('Pedicle');
  });

  it('is recorded as the locate question it always was, and the verdict takes focus', async () => {
    const onAnswer = vi.fn();
    desktop(pedicle, { onAnswer });
    const group = await openWords();
    fireEvent.click(within(group).getByRole('button', { name: 'Pedicle' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: /^Correct/ }));
    fireEvent.click(screen.getByRole('button', { name: /Easy/ }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ structureId: 'pedicle', correct: true, confidence: 'easy' });
    expect(onAnswer.mock.calls[0][0].route).toBeUndefined();
  });
});

describe('"Answer locate questions without the picture"', () => {
  it('is off until chosen, and is a labelled switch on the Account screen that says what it does', () => {
    expect(getLocateWithoutPicture()).toBe(false);
    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole('switch', { name: 'Answer locate questions without the picture' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/which of four descriptions says where the structure\s+sits/)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(getLocateWithoutPicture()).toBe(true);
    fireEvent.click(toggle);
    expect(getLocateWithoutPicture()).toBe(false);
  });

  it('on: a locate question opens in words, with the picture one button away', async () => {
    setLocateWithoutPicture(true);
    desktop(acromion);
    await screen.findByRole('group', { name: /^Descriptions/ });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Which of these describes where the Acromion sits?');
    fireEvent.click(screen.getByRole('button', { name: /^Answer on the picture/ }));
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('on: the picture\'s prompt is never shown first and then replaced', () => {
    setLocateWithoutPicture(true);
    desktop(acromion);
    // Before the words have arrived the heading is empty, not "Tap the Acromion."
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('');
  });
});

describe('on the phone', () => {
  it('the same route, the same four descriptions, reported the same way', async () => {
    const onAnswer = vi.fn();
    phone(acromion, onAnswer);
    expect(screen.getByText(/If you cannot see the image/)).toBeInTheDocument();
    const group = await openWords();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Which of these describes where the Acromion sits?');
    const options = within(group).getAllByRole('button');
    expect(options).toHaveLength(4);
    fireEvent.click(options.find((o) => o.textContent!.includes(ACROMION_ANSWER))!);
    expect(screen.getByText(new RegExp(`Acromion — ${ACROMION_ANSWER.replace(/[()]/g, '\\$&')}`))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Easy/ }));
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, route: 'described-region', confidence: 'easy' });
  });

  it('the list is a named group of at least four', async () => {
    phone(pedicle);
    const group = await openWords();
    expect(group.getAttribute('aria-label')).toMatch(/^Structure names/);
    expect(within(group).getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  });
});
