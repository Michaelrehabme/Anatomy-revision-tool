import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MCQQuestion } from '../../anatomy-revision/types/question';

/**
 * The report control and the error boundary, with the writes replaced: what is
 * pinned here is what a student sees and what is handed to the data layer, not
 * Firestore (rules-tests/ holds the rules to the same shapes).
 */

const reportQuestion = vi.fn();
const reportClientError = vi.fn();

vi.mock('../data/telemetry', async (original) => ({
  ...(await original<typeof import('../data/telemetry')>()),
  REPORTING_AVAILABLE: true,
  reportQuestion: (...args: unknown[]) => reportQuestion(...args),
  reportClientError: (...args: unknown[]) => reportClientError(...args),
}));

const { ReportQuestionControl, REPORT_FAILED, REPORT_SENT, REPORT_TRIGGER } = await import('../ReportQuestionControl');
const { ErrorBoundary } = await import('../ErrorBoundary');

const question = (id: string): MCQQuestion => ({
  id,
  type: 'mcq',
  structureId: 'biceps-brachii',
  region: 'upper-limb' as MCQQuestion['region'],
  area: 'elbow' as MCQQuestion['area'],
  category: 'muscle' as MCQQuestion['category'],
  difficulty: 'core' as MCQQuestion['difficulty'],
  promptKind: 'nerve',
  prompt: 'Which nerve?',
  choices: ['Musculocutaneous', 'Radial'],
  correctIndex: 0,
  explanation: '',
});

afterEach(() => {
  cleanup();
  reportQuestion.mockReset();
  reportClientError.mockReset();
});

describe('ReportQuestionControl', () => {
  it('sends the question with the reason and the note, and says so', async () => {
    reportQuestion.mockResolvedValue(true);
    render(<ReportQuestionControl variant="sidebar" question={question('q1')} />);

    fireEvent.click(screen.getByRole('button', { name: REPORT_TRIGGER }));
    // Nothing can be sent until a reason is chosen.
    expect(screen.getByRole('button', { name: 'Send report' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByLabelText('The answer marked right is wrong'));
    fireEvent.change(screen.getByLabelText('Anything to add? (optional)'), { target: { value: 'It is the radial nerve.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(REPORT_SENT));
    expect(reportQuestion).toHaveBeenCalledWith({
      questionId: 'q1',
      structureId: 'biceps-brachii',
      questionType: 'mcq',
      promptKind: 'nerve',
      area: 'elbow',
      reason: 'wrong-answer',
      note: 'It is the radial nerve.',
    });
  });

  it('keeps what was typed when the report cannot be sent', async () => {
    reportQuestion.mockResolvedValue(false);
    render(<ReportQuestionControl variant="bar" question={question('q1')} />);

    fireEvent.click(screen.getByRole('button', { name: REPORT_TRIGGER }));
    fireEvent.click(screen.getByLabelText('Something else'));
    fireEvent.change(screen.getByLabelText('Anything to add? (optional)'), { target: { value: 'typed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(REPORT_FAILED));
    expect((screen.getByLabelText('Anything to add? (optional)') as HTMLTextAreaElement).value).toBe('typed');
  });

  it('starts again on the next question', async () => {
    reportQuestion.mockResolvedValue(true);
    const { rerender } = render(<ReportQuestionControl variant="sidebar" question={question('q1')} />);
    fireEvent.click(screen.getByRole('button', { name: REPORT_TRIGGER }));
    fireEvent.click(screen.getByLabelText('Something else'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());

    rerender(<ReportQuestionControl variant="sidebar" question={question('q2')} />);
    expect(screen.getByRole('button', { name: REPORT_TRIGGER })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('closes on Escape without sending', () => {
    render(<ReportQuestionControl variant="sidebar" question={question('q1')} />);
    fireEvent.click(screen.getByRole('button', { name: REPORT_TRIGGER }));
    fireEvent.keyDown(screen.getByLabelText('Something else'), { key: 'Escape' });
    expect(screen.getByRole('button', { name: REPORT_TRIGGER })).toBeTruthy();
    expect(reportQuestion).not.toHaveBeenCalled();
  });
});

describe('ErrorBoundary', () => {
  it('shows a way back and reports the error when a screen throws', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('render failed');
    const Broken = () => {
      throw failure;
    };

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'This page has stopped working' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(reportClientError).toHaveBeenCalledWith('boundary', failure);
    quiet.mockRestore();
  });

  it('is invisible while nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
