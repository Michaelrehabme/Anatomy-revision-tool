import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiagnosticRoute } from '../Diagnostic/DiagnosticRoute';
import { createMemoryRepository } from '../../data/memoryRepository';
import { DIAGNOSTIC_VERSION } from '../../lib/diagnostic';
import { anatomyContentFrom } from '../../hooks/useAnatomyContent';

const DAY = 86_400_000;
let joinedAt: string | null = null;

vi.mock('../../../educator/data/cohortsRepository', () => ({
  getMyCohort: async () => ({ id: 'c1', name: 'Test class' }),
  getMyCohortJoinedAt: async () => joinedAt,
}));

vi.mock('../Diagnostic/DiagnosticScreen', () => ({
  DiagnosticScreen: ({ phase }: { phase: string }) => <p>sitting: {phase}</p>,
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
