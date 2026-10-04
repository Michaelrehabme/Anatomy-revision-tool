import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudySession } from '../StudySession/StudySession';
import { MobileStudySession } from '../mobile/MobileStudySession';
import {
  END_SESSION_ASSIGNMENT_DETAIL,
  END_SESSION_DETAIL,
  END_SESSION_EXAM_DETAIL,
  END_SESSION_QUESTION,
} from '../shared/EndSessionControl';
import type { useRevisionSession } from '../../hooks/useRevisionSession';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { MCQQuestion } from '../../types/question';

/**
 * End session asks first (docs/ACCESSIBILITY-AUDIT-2026-10-04.md, finding 2).
 *
 * The control is one Tab from the answers and used to act on the first press;
 * a stray Enter ended a session during the keyboard-only run. These hold the
 * behaviour a keyboard user depends on, on both layouts, through the real
 * session screens rather than the control on its own: where focus goes when
 * the question appears, that Escape and Enter both keep the session, and
 * that focus comes back to the button it left.
 *
 * jsdom does not turn Enter on a focused button into a click the way a
 * browser does, so "pressing Enter" below is a click on whatever holds focus.
 * Which element that is, is the thing under test.
 */

const question: MCQQuestion = {
  id: 'mcq-deltoid-nerve',
  type: 'mcq',
  structureId: 'deltoid',
  region: 'shoulder-arm',
  subregion: 'shoulder',
  area: 'shoulder',
  category: 'muscle',
  difficulty: 'medium',
  promptKind: 'nerve',
  prompt: 'What nerve innervates Deltoid?',
  choices: ['Axillary nerve', 'Radial nerve', 'Median nerve', 'Ulnar nerve'],
  correctIndex: 0,
  explanation: 'Axillary nerve (C5, C6).',
};

type Session = ReturnType<typeof useRevisionSession>;

function sessionWith(answered: number, extra: Partial<Session> = {}): Session {
  return {
    phase: 'in-progress',
    questions: [question, { ...question, id: 'q2' }, { ...question, id: 'q3' }],
    currentIndex: Math.min(answered, 2),
    currentQuestion: question,
    answers: Array.from({ length: answered }, (_, i) => ({
      questionId: `earlier-${i}`,
      structureId: 'deltoid',
      correct: true,
      durationMs: 1000,
    })),
    setupParams: { types: ['mcq'], mode: 'practice' },
    summary: null,
    isLastQuestion: false,
    gamification: null,
    levelChanges: [],
    persistError: null,
    retryPersist: vi.fn(),
    dismissPersistError: vi.fn(),
    start: vi.fn(),
    submitAnswer: vi.fn(),
    next: vi.fn(),
    finish: vi.fn(),
    reset: vi.fn(),
    abandon: vi.fn(),
    ...extra,
  } as unknown as Session;
}

const content = { structures: [], images: [], imagesById: new Map(), structuresById: new Map() } as unknown as AnatomyContent;

const LAYOUTS = [
  {
    name: 'desktop',
    renderSession: (session: Session, onEnd: () => void) =>
      render(
        <MemoryRouter>
          <StudySession session={session} content={content} onEnd={onEnd} onBackToSetup={vi.fn()} />
        </MemoryRouter>,
      ),
  },
  {
    name: 'mobile',
    renderSession: (session: Session, onEnd: () => void) =>
      render(
        <MemoryRouter>
          <MobileStudySession session={session} content={content} onEnd={onEnd} onBackToSetup={vi.fn()} onOpenMuscle={vi.fn()} />
        </MemoryRouter>,
      ),
  },
] as const;

/** What Enter does in a browser: activates whatever has focus. */
const pressEnter = () => fireEvent.click(document.activeElement as HTMLElement);
const endButton = () => screen.getByRole('button', { name: /^(× )?End session$/ });

describe.each(LAYOUTS)('End session on $name', ({ renderSession }) => {
  it('ends at once when nothing has been answered', () => {
    const onEnd = vi.fn();
    renderSession(sessionWith(0), onEnd);
    fireEvent.click(endButton());
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(END_SESSION_QUESTION)).not.toBeInTheDocument();
  });

  it('asks instead of ending once there is an answer to lose the place after', () => {
    const onEnd = vi.fn();
    renderSession(sessionWith(2), onEnd);
    fireEvent.click(endButton());

    expect(onEnd).not.toHaveBeenCalled();
    const group = screen.getByRole('group', { name: END_SESSION_QUESTION });
    expect(within(group).getByText(END_SESSION_DETAIL)).toBeInTheDocument();
    // In the page, not over it: the question in hand is still there to answer.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(question.prompt)).toBeInTheDocument();
  });

  it('puts focus on Keep going, so the Enter that opened it cannot also end it', () => {
    const onEnd = vi.fn();
    renderSession(sessionWith(2), onEnd);
    endButton().focus();
    pressEnter();

    const keep = screen.getByRole('button', { name: 'Keep going' });
    expect(keep).toHaveFocus();
    // What ending costs is read with the button focus lands on.
    expect(keep).toHaveAccessibleDescription(END_SESSION_DETAIL);

    // The stray second Enter.
    pressEnter();
    expect(onEnd).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: END_SESSION_QUESTION })).not.toBeInTheDocument();
  });

  it('Keep going returns focus to End session', () => {
    renderSession(sessionWith(2), vi.fn());
    fireEvent.click(endButton());
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(endButton()).toHaveFocus();
  });

  it('Escape cancels and returns focus to End session', () => {
    const onEnd = vi.fn();
    renderSession(sessionWith(2), onEnd);
    fireEvent.click(endButton());
    fireEvent.keyDown(screen.getByRole('button', { name: 'Keep going' }), { key: 'Escape' });

    expect(onEnd).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: END_SESSION_QUESTION })).not.toBeInTheDocument();
    expect(endButton()).toHaveFocus();
  });

  it('ends on the second, deliberate press', () => {
    const onEnd = vi.fn();
    renderSession(sessionWith(2), onEnd);
    fireEvent.click(endButton());
    const group = screen.getByRole('group', { name: END_SESSION_QUESTION });
    fireEvent.click(within(group).getByRole('button', { name: 'End session' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('asks after a learn card too: a card seen is a place in the set', () => {
    const onEnd = vi.fn();
    const session = sessionWith(1);
    session.answers[0] = { ...session.answers[0], graded: false };
    renderSession(session, onEnd);
    fireEvent.click(endButton());
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('says what is really kept: outside an exam, not an answer still waiting for its rating', () => {
    // An answer is recorded when it is rated, not when it is chosen, so the
    // one on screen with no rating yet is lost. An exam has no rating step.
    expect(END_SESSION_DETAIL).toBe(
      'Your answers so far are kept, except one you have not rated yet. A session ended early has no results page and earns no XP.',
    );
    expect(END_SESSION_EXAM_DETAIL).toBe('Your answers so far are kept. A session ended early has no results page and earns no XP.');

    const { unmount } = renderSession(sessionWith(2), vi.fn());
    fireEvent.click(endButton());
    expect(screen.getByText(END_SESSION_DETAIL)).toBeInTheDocument();
    unmount();

    renderSession(sessionWith(2, { setupParams: { types: ['mcq'], mode: 'assessment' } }), vi.fn());
    fireEvent.click(endButton());
    expect(screen.getByText(END_SESSION_EXAM_DETAIL)).toBeInTheDocument();
  });

  it('says an assignment attempt will not count, only when it is one', () => {
    const { unmount } = renderSession(sessionWith(2), vi.fn());
    fireEvent.click(endButton());
    expect(screen.queryByText(new RegExp(END_SESSION_ASSIGNMENT_DETAIL))).not.toBeInTheDocument();
    unmount();

    renderSession(
      sessionWith(2, {
        setupParams: { types: ['mcq'], mode: 'practice', assignment: { id: 'a1', title: 'Shoulder week', targetAccuracyPct: 80 } },
      }),
      vi.fn(),
    );
    fireEvent.click(endButton());
    expect(screen.getByText(`${END_SESSION_DETAIL} ${END_SESSION_ASSIGNMENT_DETAIL}`)).toBeInTheDocument();
  });
});
