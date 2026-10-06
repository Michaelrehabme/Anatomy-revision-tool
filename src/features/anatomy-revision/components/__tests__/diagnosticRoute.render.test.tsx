import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiagnosticRoute } from '../Diagnostic/DiagnosticRoute';
import { createMemoryRepository } from '../../data/memoryRepository';
import { COHORT_DRAWN_VERSION, DIAGNOSTIC_SIZE, DIAGNOSTIC_VERSION } from '../../lib/diagnostic';
import { WHOLE_BODY_PAPER, loadPapers, type DiagnosticPaper } from '../../lib/diagnosticPapers';
import { anatomyContentFrom } from '../../hooks/useAnatomyContent';
import { AREAS, type Area } from '../../types/region';

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
        {paper.kind === 'paper'
          ? `${paper.paper.id}, ${paper.paper.questions.length} questions`
          : paper.kind === 'cohortDrawn' ? `replays ${(paper.replayIds ?? []).join('+')}` : 'nothing'}
      </p>
    </>
  ),
}));

function open(phase: 'baseline' | 'followUp', repository = createMemoryRepository(), sitterAreas: readonly Area[] = AREAS) {
  return render(
    <MemoryRouter initialEntries={[`/diagnostic?phase=${phase}`]}>
      <DiagnosticRoute repository={repository} userId="u1" content={anatomyContentFrom([], [])} sitterAreas={sitterAreas} />
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
 * Which paper the route hands the screen. A baseline is the paper for what
 * the sitter holds. A follow-up is whatever its baseline was, whatever they
 * hold now, so nobody mid-diagnostic is orphaned or handed a different test.
 */
describe('/diagnostic hands over the right paper', () => {
  const longAgo = new Date(Date.now() - 80 * DAY).toISOString();

  async function withBaseline(version: number, questionIds: string[], paperId?: string) {
    const repository = createMemoryRepository();
    await repository.saveDiagnosticResult({
      userId: 'u1', cohortId: 'c1', version, ...(paperId ? { paperId } : {}),
      phase: 'baseline', correct: 5, total: 15, takenAt: longAgo, questionIds,
    });
    return repository;
  }
  const idsOf = async (paperId: string) =>
    (await loadPapers(DIAGNOSTIC_VERSION))!.papers.find((p) => p.id === paperId)!.questions.map((q) => q.id);

  beforeEach(() => {
    joinedAt = new Date(Date.now() - 3 * DAY).toISOString();
  });

  it('a baseline for a student with every area: the whole-body paper', async () => {
    open('baseline');
    expect(await screen.findByText(`paper: paper v${DIAGNOSTIC_VERSION}, ${WHOLE_BODY_PAPER}, ${DIAGNOSTIC_SIZE} questions`)).toBeTruthy();
  });

  it("a baseline for a free student: their free area's paper", async () => {
    open('baseline', createMemoryRepository(), ['ankle-foot']);
    expect(await screen.findByText(`paper: paper v${DIAGNOSTIC_VERSION}, ankle-foot, ${DIAGNOSTIC_SIZE} questions`)).toBeTruthy();
  });

  it('a baseline for a free account that has not chosen an area: nothing to ask', async () => {
    open('baseline', createMemoryRepository(), []);
    expect(await screen.findByText(`paper: unknown v${DIAGNOSTIC_VERSION}, nothing`)).toBeTruthy();
  });

  it("a follow-up to a version-1 baseline: that class's own paper, replayed", async () => {
    joinedAt = longAgo;
    open('followUp', await withBaseline(COHORT_DRAWN_VERSION, ['mcq-a', 'mcq-b']));
    expect(await screen.findByText(`paper: cohortDrawn v${COHORT_DRAWN_VERSION}, replays mcq-a+mcq-b`)).toBeTruthy();
  });

  it("a follow-up to a knee baseline is the knee paper, though the student's free area is now the hip", async () => {
    joinedAt = longAgo;
    open('followUp', await withBaseline(DIAGNOSTIC_VERSION, await idsOf('knee'), 'knee'), ['hip']);
    expect(await screen.findByText(`paper: paper v${DIAGNOSTIC_VERSION}, knee, ${DIAGNOSTIC_SIZE} questions`)).toBeTruthy();
  });

  it('a follow-up to a knee baseline is the knee paper, though the student now holds every area', async () => {
    joinedAt = longAgo;
    open('followUp', await withBaseline(DIAGNOSTIC_VERSION, await idsOf('knee'), 'knee'), AREAS);
    expect(await screen.findByText(`paper: paper v${DIAGNOSTIC_VERSION}, knee, ${DIAGNOSTIC_SIZE} questions`)).toBeTruthy();
  });

  it('a follow-up to a whole-body baseline is the whole-body paper, though the subscription has lapsed', async () => {
    joinedAt = longAgo;
    open('followUp', await withBaseline(DIAGNOSTIC_VERSION, await idsOf(WHOLE_BODY_PAPER), WHOLE_BODY_PAPER), ['shoulder']);
    expect(await screen.findByText(`paper: paper v${DIAGNOSTIC_VERSION}, ${WHOLE_BODY_PAPER}, ${DIAGNOSTIC_SIZE} questions`)).toBeTruthy();
  });
});
