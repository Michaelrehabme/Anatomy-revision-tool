import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DiagnosticPrompt } from '../Diagnostic/DiagnosticPrompt';
import { createMemoryRepository } from '../../data/memoryRepository';
import { DIAGNOSTIC_VERSION, type DiagnosticResult } from '../../lib/diagnostic';
import { FOLLOW_UP_AFTER_DAYS } from '../../lib/diagnosticPrompt';

/**
 * The prompt sits on a screen a student opens for other reasons, so the
 * property that matters most is that it renders NOTHING unless there is
 * genuinely something to ask. A card saying "you have already done this" is
 * clutter, and clutter on the account screen is how the real offer gets
 * ignored when it does appear.
 */

const repository = createMemoryRepository();
vi.mock('../../hooks/useRepository', () => ({ useRepository: () => ({ repository }) }));

function sat(phase: 'baseline' | 'followUp', takenAt: string): DiagnosticResult {
  return { userId: 'u1', cohortId: 'c1', version: DIAGNOSTIC_VERSION, phase, correct: 6, total: 15, takenAt };
}

beforeEach(async () => {
  for (const r of await repository.listDiagnosticResults('u1')) void r;
});

describe('DiagnosticPrompt', () => {
  it('offers the baseline to a student who has not sat one', async () => {
    render(<DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} onStart={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Take the baseline' })).toBeTruthy();
    expect(screen.getByText(/never sees your score/)).toBeTruthy();
  });

  it('renders nothing at all once the baseline is done', async () => {
    const repo = createMemoryRepository();
    await repo.saveDiagnosticResult(sat('baseline', new Date().toISOString()));
    vi.spyOn(repository, 'listDiagnosticResults').mockResolvedValueOnce(
      await repo.listDiagnosticResults('u1'),
    );

    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} onStart={() => {}} />,
    );
    await waitFor(() => expect(container.querySelector('button')).toBeNull());
  });

  it('offers the follow-up a term later, in different words', async () => {
    const old = new Date(Date.now() - (FOLLOW_UP_AFTER_DAYS + 1) * 86400000).toISOString();
    const repo = createMemoryRepository();
    await repo.saveDiagnosticResult(sat('baseline', old));
    vi.spyOn(repository, 'listDiagnosticResults').mockResolvedValueOnce(
      await repo.listDiagnosticResults('u1'),
    );

    render(<DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={old} onStart={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Take the follow-up' })).toBeTruthy();
  });

  it('stays silent when the read fails rather than asking someone to redo it', async () => {
    vi.spyOn(repository, 'listDiagnosticResults').mockRejectedValueOnce(new Error('offline'));
    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} onStart={() => {}} />,
    );
    // Not knowing whether they have sat one is not a reason to ask again.
    await waitFor(() => expect(container.querySelector('button')).toBeNull());
  });

  it('hands the phase back to the caller so it can route', async () => {
    const onStart = vi.fn();
    render(<DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} onStart={onStart} />);
    (await screen.findByRole('button', { name: 'Take the baseline' })).click();
    expect(onStart).toHaveBeenCalledWith('baseline');
  });
});
