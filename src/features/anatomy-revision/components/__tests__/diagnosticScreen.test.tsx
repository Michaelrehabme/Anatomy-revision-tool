import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DiagnosticScreen } from '../Diagnostic/DiagnosticScreen';
import { createMemoryRepository } from '../../data/memoryRepository';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { DIAGNOSTIC_SIZE } from '../../lib/diagnostic';

/**
 * End to end over the real dataset: a cohort id in, a stored result out.
 *
 * The assertion that matters most is the negative one — that finishing a
 * sitting writes a diagnostic result and NOTHING else. An attempt recorded
 * here would reach the scheduler and the educator's weakness table, and the
 * sitting promises a student it does neither.
 */

function setup(phase: 'baseline' | 'followUp' = 'baseline') {
  const repository = createMemoryRepository();
  const recordAttempt = vi.spyOn(repository, 'recordAttempt');
  const upsertMastery = vi.spyOn(repository, 'upsertMastery');
  const onDone = vi.fn();

  render(
    <DiagnosticScreen
      repository={repository}
      userId="u1"
      cohortId="y2-physio-2026"
      phase={phase}
      structures={ALL_STRUCTURES}
      images={ALL_IMAGES}
      onDone={onDone}
    />,
  );
  return { repository, recordAttempt, upsertMastery, onDone };
}

/** Answer every question and submit. */
function completeSitting() {
  for (let i = 0; i < DIAGNOSTIC_SIZE; i++) {
    const choices = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null);
    fireEvent.click(choices[0]);
    const last = i === DIAGNOSTIC_SIZE - 1;
    fireEvent.click(screen.getByRole('button', { name: last ? 'Review answers' : 'Next' }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
}

describe('DiagnosticScreen', () => {
  it('opens on an intro that states what the sitting will not do', () => {
    setup();
    expect(screen.getByText('Before you start revising')).toBeTruthy();
    expect(screen.getByText(/never sees your score/)).toBeTruthy();
    expect(screen.getByText(/not be told what you got wrong/)).toBeTruthy();
  });

  it('lets a student decline without starting', () => {
    const { onDone } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('runs a full sitting over the real dataset and stores the result', async () => {
    const { repository } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    expect(screen.getByText(`Question 1 of ${DIAGNOSTIC_SIZE}`)).toBeTruthy();

    completeSitting();

    await waitFor(async () => {
      expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
    });
    const [stored] = await repository.listDiagnosticResults('u1');
    expect(stored.phase).toBe('baseline');
    expect(stored.total).toBe(DIAGNOSTIC_SIZE);
    expect(stored.cohortId).toBe('y2-physio-2026');
    // Recorded so a follow-up can replay exactly these.
    expect(stored.questionIds).toHaveLength(DIAGNOSTIC_SIZE);
  });

  it('records no attempt and touches no mastery, which is the whole promise', async () => {
    const { repository, recordAttempt, upsertMastery } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    completeSitting();

    await waitFor(async () => {
      expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
    });
    expect(recordAttempt).not.toHaveBeenCalled();
    expect(upsertMastery).not.toHaveBeenCalled();
    expect(await repository.listAttempts({ userId: 'u1' })).toEqual([]);
  });

  it('shows the score but never which answers were wrong', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    completeSitting();

    await screen.findByText('That is your starting point');
    expect(screen.getByText(/deliberately not showing you which ones/)).toBeTruthy();
    expect(screen.queryByText(/you got wrong:/i)).toBeNull();
  });

  it('asks the follow-up in different words', () => {
    setup('followUp');
    expect(screen.getByText('The same fifteen questions, ten weeks on')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take the follow-up' })).toBeTruthy();
  });
});
