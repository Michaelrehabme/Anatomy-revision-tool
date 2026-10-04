import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MCQSession } from '../MCQSession/MCQSession';
import { MultiSelectSession } from '../MultiSelectSession/MultiSelectSession';
import { OinaSelectSession } from '../OinaSession/OinaSelectSession';
import { LocateStructureSession } from '../LocateStructureSession/LocateStructureSession';
import { FlashcardSession } from '../FlashcardSession/FlashcardSession';
import { MobileMultiSelectSession } from '../mobile/MobileMultiSelectSession';
import { ImageViewer } from '../shared/ImageViewer';
import { PlateCatalogueProvider } from '../shared/PlateDescription';
import { ResultsHeading } from '../shared/ResultsHeading';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import type { FlashcardQuestion, LocateQuestion, MCQQuestion, MultiSelectQuestion, OinaSelectQuestion } from '../../types/question';

/**
 * The keyboard and accessible-name pass of 4 October 2026, pinned.
 *
 * Each of these was found by driving the built app in a browser with the
 * keyboard alone and reading back what a screen reader would be given:
 *
 *  - the picture on "Which structure is shown?" was NAMED after its subject,
 *    so the answer was read out before the question;
 *  - "select all" options did not say whether they were chosen, sat in no
 *    group, and ignored the arrow keys multiple choice answers to;
 *  - checking a multi-select answer, or answering locate from the list, left
 *    focus on the page body, so the verdict was never read;
 *  - revealing a flashcard put focus on the question wrapper, not the answer;
 *  - "Reset zoom" removed itself and took focus with it.
 */

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
});

const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
const structuresById = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const catalogue = { imagesById, structuresById };

const base = {
  region: 'shoulder-arm' as const,
  subregion: 'shoulder' as const,
  area: 'shoulder' as const,
  difficulty: 'medium' as const,
};

const identify: MCQQuestion = {
  ...base,
  id: 'mcq-identify-deltoid',
  type: 'mcq',
  structureId: 'deltoid',
  category: 'muscle',
  promptKind: 'identify',
  prompt: 'Which structure is shown?',
  promptImageId: 'muscle-deltoid-a000-highlight',
  choices: ['Deltoid', 'Trapezius', 'Supraspinatus', 'Pectoralis Major'],
  correctIndex: 0,
  explanation: 'Abducts the shoulder.',
};

const multi: MultiSelectQuestion = {
  ...base,
  id: 'multi-1',
  type: 'multi-select',
  structureId: 'coracohumeral-ligament',
  category: 'ligament',
  promptKind: 'attachment',
  prompt: 'Select ALL the bones the Coracohumeral ligament attaches to.',
  choices: ['Humerus', 'Scapula', 'Clavicle', 'Sternum'],
  correctIndices: [0, 1],
  explanation: 'Humerus and scapula.',
};

const oinaSelect: OinaSelectQuestion = {
  ...base,
  id: 'oina-1',
  type: 'oina',
  format: 'select',
  structureId: 'deltoid',
  category: 'muscle',
  promptKind: 'origin',
  prompt: 'Select every origin of Deltoid.',
  choices: ['Acromion', 'Spine of scapula', 'Coracoid process'],
  correctIndices: [0, 1],
  explanation: 'x',
};

const locate: LocateQuestion = {
  ...base,
  id: 'locate-1',
  type: 'locate',
  structureId: 'scapula',
  category: 'bone',
  promptKind: 'identify',
  imageId: 'bone-shoulder-arm-anterior',
  imageMode: 'atlas-slide',
  targetStructureId: 'scapula',
  prompt: 'Tap Scapula on the image.',
};

const card: FlashcardQuestion = {
  ...base,
  id: 'card-1',
  type: 'flashcard',
  structureId: 'deltoid',
  category: 'muscle',
  promptKind: 'identify',
  front: { imageId: 'muscle-deltoid-a000-highlight' },
  back: { text: 'Deltoid', imageId: 'muscle-deltoid-a000-highlight' },
};

/** Every string a screen reader could be given for the picture: its name, its alt, its description. */
function pictureText(): string {
  const stage = screen.getByRole('img').closest('[role="group"], [role="application"]')!;
  // Every element it is described by: the description, and on a picture that
  // takes a tap, its keyboard instructions.
  const described = stage
    .getAttribute('aria-describedby')!
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
  return [stage.getAttribute('aria-label'), screen.getByRole('img').getAttribute('alt'), described].join(' | ');
}

describe('a picture does not name its own answer', () => {
  it('multiple choice identify: the subject is named only once the answer is checked', async () => {
    render(
      <PlateCatalogueProvider value={catalogue}>
        <MCQSession question={identify} imagesById={imagesById} onAnswer={vi.fn()} onNext={vi.fn()} />
      </PlateCatalogueProvider>,
    );
    // The description is written by a module fetched on demand.
    await screen.findByText(/One muscle is picked out in bright cyan/);
    expect(pictureText()).not.toMatch(/deltoid/i);
    // ...and nothing else in frame is named either: those are the distractors.
    expect(pictureText()).not.toMatch(/trapezius|pectoralis/i);

    fireEvent.click(screen.getByRole('button', { name: /Trapezius/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(pictureText()).toContain('Deltoid — Anterior View (highlighted)');
    expect(pictureText()).toContain('Deltoid is the structure in cyan. It lies at the centre of the picture');
  });

  it('an exam never reveals it, checked or not', () => {
    render(<MCQSession question={identify} imagesById={imagesById} onAnswer={vi.fn()} onNext={vi.fn()} examMode />);
    fireEvent.click(screen.getByRole('button', { name: /Trapezius/ }));
    expect(pictureText()).not.toMatch(/deltoid/i);
  });

  it('a flashcard front conceals the name, and the back gives it', () => {
    render(<FlashcardSession question={card} imagesById={imagesById} onAnswer={vi.fn()} onNext={vi.fn()} />);
    expect(pictureText()).not.toMatch(/deltoid/i);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    expect(pictureText()).toMatch(/Deltoid/);
  });

  it('locate: the picture keeps its title, lists what is in frame and says where nothing is', async () => {
    render(
      <PlateCatalogueProvider value={catalogue}>
        <LocateStructureSession question={locate} imagesById={imagesById} structuresById={structuresById} onAnswer={vi.fn()} onNext={vi.fn()} />
      </PlateCatalogueProvider>,
    );
    await screen.findByText(/In frame: Humerus, Scapula and Clavicle\./);
    expect(pictureText()).toContain('Shoulder and Arm — Skeleton, Anterior View');
    expect(pictureText()).not.toMatch(/It lies|of the picture/);
  });

  it('the tappable picture is a keyboard stop that is pointed at, not a button that is pressed', () => {
    render(<LocateStructureSession question={locate} imagesById={imagesById} structuresById={structuresById} onAnswer={vi.fn()} onNext={vi.fn()} />);
    // It was role="button" and could not be focused; then a group, honestly
    // inert. Now it takes the arrow keys and Enter (keyboardCrosshair.parity.test.tsx).
    const stage = screen.getByRole('img').closest('[role]') as HTMLElement;
    expect(stage.getAttribute('role')).toBe('application');
    expect(stage.tabIndex).toBe(0);
  });
});

describe('select-all options', () => {
  it.each([
    ['desktop multi-select', <MultiSelectSession key="d" question={multi} onAnswer={vi.fn()} onNext={vi.fn()} />],
    ['phone multi-select', <MobileMultiSelectSession key="m" question={multi} onAnswer={vi.fn()} onNext={vi.fn()} />],
  ])('%s: say whether they are chosen, in a named group the arrow keys move through', (_name, ui) => {
    render(ui);
    const group = screen.getByRole('group', { name: /choose every one that applies/ });
    const options = within(group).getAllByRole('button');
    expect(options.map((o) => o.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'false']);

    options[0].focus();
    fireEvent.keyDown(options[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);
    // Moving does not choose.
    expect(options[1].getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(options[1]);
    expect(options[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('once checked, each option says in words what its border says in colour', () => {
    render(<MultiSelectSession question={multi} onAnswer={vi.fn()} onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Humerus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clavicle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByRole('button', { name: 'Humerus (correct)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Scapula (correct, not chosen)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clavicle (wrong)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sternum' })).toBeDisabled();
  });

  it('the verdict takes focus when a multi-select answer is checked', () => {
    render(<MultiSelectSession question={multi} onAnswer={vi.fn()} onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Humerus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: /50% credit\. 1 of 2 correct\./ }));
  });

  it('OINA select options carry the same state', () => {
    render(<OinaSelectSession question={oinaSelect} onAnswer={vi.fn()} onNext={vi.fn()} />);
    const group = screen.getByRole('group', { name: /choose every one that applies/ });
    fireEvent.click(within(group).getByRole('button', { name: 'Acromion' }));
    expect(within(group).getByRole('button', { name: 'Acromion' }).getAttribute('aria-pressed')).toBe('true');
  });
});

// Locate without the picture — the question in words, and the list of names
// it falls back to — has a file of its own: locateWithoutPicture.a11y.test.tsx.

describe('focus is not dropped', () => {
  it('revealing a flashcard moves focus to the answer', () => {
    render(<FlashcardSession question={card} imagesById={imagesById} onAnswer={vi.fn()} onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    expect(document.activeElement?.textContent).toBe('Deltoid');
  });

  it('the results page opens with focus on its heading, which reads the score', () => {
    render(<ResultsHeading label="Session complete. 7 of 10 correct.">Session complete</ResultsHeading>);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Session complete. 7 of 10 correct.' }));
  });

  it('resetting the zoom leaves focus on a zoom control', () => {
    render(<ImageViewer image={imagesById.get('landmark-acromion-anterior')!} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const reset = screen.getByRole('button', { name: 'Reset zoom' });
    reset.focus();
    fireEvent.click(reset);
    expect(screen.queryByRole('button', { name: 'Reset zoom' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zoom in' }));
  });
});
