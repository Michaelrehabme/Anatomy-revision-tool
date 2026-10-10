import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DiagnosticPrompt, type SittingMeans } from '../Diagnostic/DiagnosticPrompt';
import { createMemoryRepository } from '../../data/memoryRepository';
import { COHORT_DRAWN_VERSION, DIAGNOSTIC_VERSION, type DiagnosticResult } from '../../lib/diagnostic';
import { WHOLE_BODY_PAPER } from '../../lib/diagnosticPapers';
import { FOLLOW_UP_AFTER_DAYS } from '../../lib/diagnosticPrompt';
import { AREAS, type Area } from '../../types/region';

/**
 * The prompt sits on a screen a student opens for other reasons, so the
 * property that matters most is that it renders NOTHING unless there is
 * genuinely something to ask. A card saying "you have already done this" is
 * clutter, and clutter on the account screen is how the real offer gets
 * ignored when it does appear.
 */

const repository = createMemoryRepository();
vi.mock('../../hooks/useRepository', () => ({ useRepository: () => ({ repository }) }));

function sat(phase: 'baseline' | 'followUp', takenAt: string, over: Partial<DiagnosticResult> = {}): DiagnosticResult {
  return { userId: 'u1', cohortId: 'c1', version: DIAGNOSTIC_VERSION, paperId: WHOLE_BODY_PAPER, phase, correct: 6, total: 15, takenAt, ...over };
}

/** An account that may reach `areas`, on a device that holds the facts of `held`. */
function means(areas: readonly Area[], held: readonly Area[] = areas): SittingMeans {
  return { areas, missing: (asked) => asked.filter((a) => !held.includes(a)) };
}
const everything = means(AREAS);

/** What the student has sat, as the prompt will read it. */
async function having(...rows: DiagnosticResult[]) {
  const repo = createMemoryRepository();
  for (const row of rows) await repo.saveDiagnosticResult(row);
  vi.spyOn(repository, 'listDiagnosticResults').mockResolvedValueOnce(await repo.listDiagnosticResults('u1'));
}

const old = new Date(Date.now() - (FOLLOW_UP_AFTER_DAYS + 1) * 86400000).toISOString();

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('DiagnosticPrompt', () => {
  it('offers the baseline to a student who has not sat one', async () => {
    render(<DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} sitting={everything} onStart={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Take the baseline' })).toBeTruthy();
    expect(screen.getByText(/never sees your score/)).toBeTruthy();
    // No promise about what a course leader will be shown: none of it is on any screen.
    expect(screen.queryByText(/class as a whole moved/)).toBeNull();
    // Told before the baseline that a class figure may leave the course, and where to read how.
    expect(screen.getByText(/may be used outside your course/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'How this is used' }).getAttribute('href')).toBe('/privacy#before-and-after-test');
  });

  it('renders nothing at all once the baseline is done', async () => {
    await having(sat('baseline', new Date().toISOString()));
    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} sitting={everything} onStart={() => {}} />,
    );
    await waitFor(() => expect(container.querySelector('button')).toBeNull());
  });

  it('offers the follow-up a term later, in different words', async () => {
    await having(sat('baseline', old));
    render(<DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={old} sitting={everything} onStart={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Take the follow-up' })).toBeTruthy();
  });

  it('stays silent when the read fails rather than asking someone to redo it', async () => {
    vi.spyOn(repository, 'listDiagnosticResults').mockRejectedValueOnce(new Error('offline'));
    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} sitting={everything} onStart={() => {}} />,
    );
    // Not knowing whether they have sat one is not a reason to ask again.
    await waitFor(() => expect(container.querySelector('button')).toBeNull());
  });

  it('hands the phase back to the caller so it can route', async () => {
    const onStart = vi.fn();
    render(<DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} sitting={everything} onStart={onStart} />);
    (await screen.findByRole('button', { name: 'Take the baseline' })).click();
    expect(onStart).toHaveBeenCalledWith('baseline');
  });
});

/**
 * Due is not enough: the card is only an offer if the paper can be sat on
 * this device today. It used to be shown on every visit to a student whose
 * follow-up could never be set up, and led each time to the screen saying so.
 */
describe('DiagnosticPrompt offers only what can be sat', () => {
  /** Give the papers time to load and the card every chance to appear. */
  async function nothingOffered(container: HTMLElement) {
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(container.querySelector('button')).toBeNull();
  }

  it('offers a free student the baseline when their area is on the device', async () => {
    render(<DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} sitting={means(['knee'])} onStart={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Take the baseline' })).toBeTruthy();
  });

  it('does not offer a baseline to a free account that has not chosen an area', async () => {
    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} sitting={means([])} onStart={() => {}} />,
    );
    await nothingOffered(container);
  });

  it('does not offer a baseline whose facts are not on the device yet', async () => {
    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={null} sitting={means(['knee'], [])} onStart={() => {}} />,
    );
    await nothingOffered(container);
  });

  it('does not offer the knee follow-up to a student whose free area is now the hip', async () => {
    await having(sat('baseline', old, { paperId: 'knee' }));
    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={old} sitting={means(['hip'])} onStart={() => {}} />,
    );
    await nothingOffered(container);
  });

  it('…but does where the knee is still in hand: a bundled build, or a student who has since subscribed', async () => {
    await having(sat('baseline', old, { paperId: 'knee' }));
    render(<DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={old} sitting={means(['hip'], AREAS)} onStart={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Take the follow-up' })).toBeTruthy();
  });

  it('does not offer the whole-body follow-up to a lapsed subscriber holding one area', async () => {
    await having(sat('baseline', old));
    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={old} sitting={means(['shoulder'])} onStart={() => {}} />,
    );
    await nothingOffered(container);
  });

  it('does not offer a version-1 follow-up to an account without every area', async () => {
    await having(sat('baseline', old, { version: COHORT_DRAWN_VERSION, paperId: undefined, questionIds: ['mcq-a'] }));
    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={old} sitting={means(['knee'])} onStart={() => {}} />,
    );
    await nothingOffered(container);
  });

  it('offers a version-1 follow-up where every area is in hand', async () => {
    await having(sat('baseline', old, { version: COHORT_DRAWN_VERSION, paperId: undefined, questionIds: ['mcq-a'] }));
    render(<DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={old} sitting={everything} onStart={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Take the follow-up' })).toBeTruthy();
  });

  it('does not offer a follow-up to a paper this build does not have', async () => {
    await having(sat('baseline', old, { version: 2, paperId: undefined }));
    const { container } = render(
      <DiagnosticPrompt uid="u1" cohortId="c1" joinedAt={old} sitting={everything} onStart={() => {}} />,
    );
    await nothingOffered(container);
  });
});
