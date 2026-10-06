import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiagnosticRoute } from '../Diagnostic/DiagnosticRoute';
import { createMemoryRepository } from '../../data/memoryRepository';
import { COHORT_DRAWN_VERSION, DIAGNOSTIC_SIZE, DIAGNOSTIC_VERSION } from '../../lib/diagnostic';
import { resolveDiagnosticPaper, type DiagnosticPaper } from '../../lib/diagnosticSample';
import { anatomyContentFrom } from '../../hooks/useAnatomyContent';

const DAY = 86_400_000;
let joinedAt: string | null = null;

vi.mock('../../../educator/data/cohortsRepository', () => ({
  getMyCohort: async () => ({ id: 'c1', name: 'Test class' }),
  getMyCohortJoinedAt: async () => joinedAt,
}));

vi.mock('../Diagnostic/DiagnosticScreen', () => ({
  DiagnosticScreen: ({ phase, paper }: { phase: string; paper: DiagnosticPaper }) => (
    <>
      <p>sitting: {phase}</p>
      <p>
        {`paper: ${paper.kind} v${paper.version}, `}
        {paper.kind === 'fixed' ? `${paper.questions.length} questions` : `replays ${(paper.replayIds ?? []).join('+')}`}
      </p>
    </>
  ),
}));

function open(phase: 'baseline' | 'followUp', repository = createMemoryRepository()) {
  return render(
    <MemoryRouter initialEntries={[`/diagnostic?phase=${phase}`]}>
      <DiagnosticRoute repository={repository} userId="u1" content={anatomyContentFrom([], [])} />
    </MemoryRouter>,
  );
}

/**
 * The route is a URL, so it must refuse what the prompt would not offer: a
 * "baseline" months into a class, or a second one, would skew the class's
 * before/after figure without anyone noticing.
 */
describe('/diagnostic only runs a sitting that is due', () => {
  beforeEach(() => {
    joinedAt = null;
  });

  it('runs a baseline in the first weeks of a class', async () => {
    joinedAt = new Date(Date.now() - 3 * DAY).toISOString();
    open('baseline');
    expect(await screen.findByText('sitting: baseline')).toBeTruthy();
  });

  it('refuses a baseline two months after joining', async () => {
    joinedAt = new Date(Date.now() - 60 * DAY).toISOString();
    open('baseline');
    expect(await screen.findByText(/no sitting due/)).toBeTruthy();
  });

  it('refuses a second baseline', async () => {
    joinedAt = new Date(Date.now() - 3 * DAY).toISOString();
    const repository = createMemoryRepository();
    await repository.saveDiagnosticResult({
      userId: 'u1',
      cohortId: 'c1',
      version: DIAGNOSTIC_VERSION,
      phase: 'baseline',
      correct: 5,
      total: 10,
      takenAt: new Date(Date.now() - DAY).toISOString(),
      questionIds: [],
    } as never);
    open('baseline', repository);
    expect(await screen.findByText(/no sitting due/)).toBeTruthy();
  });
});

/**
 * Which paper the route hands the screen. A baseline is the fixed paper. A
 * follow-up is whatever its baseline was, so a class that was mid-diagnostic
 * when the fixed paper arrived is not orphaned.
 */
describe('/diagnostic hands over the right paper', () => {
  const longAgo = new Date(Date.now() - 80 * DAY).toISOString();

  async function withBaseline(version: number, questionIds: string[]) {
    const repository = createMemoryRepository();
    await repository.saveDiagnosticResult({
      userId: 'u1', cohortId: 'c1', version, phase: 'baseline', correct: 5, total: 15, takenAt: longAgo, questionIds,
    });
    return repository;
  }

  beforeEach(() => {
    joinedAt = new Date(Date.now() - 3 * DAY).toISOString();
  });

  it('a baseline: the fixed paper, current version', async () => {
    open('baseline');
    expect(await screen.findByText(`paper: fixed v${DIAGNOSTIC_VERSION}, ${DIAGNOSTIC_SIZE} questions`)).toBeTruthy();
  });

  it("a follow-up to a version-1 baseline: that class's own paper, replayed", async () => {
    joinedAt = longAgo;
    open('followUp', await withBaseline(COHORT_DRAWN_VERSION, ['mcq-a', 'mcq-b']));
    expect(await screen.findByText(`paper: cohortDrawn v${COHORT_DRAWN_VERSION}, replays mcq-a+mcq-b`)).toBeTruthy();
  });

  it('a follow-up to a fixed-paper baseline: the fixed paper again', async () => {
    joinedAt = longAgo;
    const paper = await resolveDiagnosticPaper('baseline');
    const ids = paper.kind === 'fixed' ? paper.questions.map((q) => q.id) : [];
    open('followUp', await withBaseline(DIAGNOSTIC_VERSION, ids));
    expect(await screen.findByText(`paper: fixed v${DIAGNOSTIC_VERSION}, ${DIAGNOSTIC_SIZE} questions`)).toBeTruthy();
  });
});
