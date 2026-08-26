import { describe, it, expect } from 'vitest';
import { applyStatusTransition, findIncompleteDependencies } from '../statusTransition';
import type { ChangeRequest, ChangeStatus } from '../../types/changeRequest';

function current(overrides: Partial<Pick<ChangeRequest, 'status' | 'startedAt' | 'completedAt'>> = {}) {
  return { status: 'new' as ChangeStatus, startedAt: null, completedAt: null, ...overrides };
}

const NOW = new Date('2026-08-26T12:00:00.000Z');

describe('applyStatusTransition', () => {
  it('stamps startedAt when moving new -> inProgress', () => {
    const result = applyStatusTransition(current(), 'inProgress', NOW);
    expect(result).toEqual({ status: 'inProgress', startedAt: NOW.toISOString(), completedAt: null });
  });

  it('stamps completedAt when moving inProgress -> completed', () => {
    const started = '2026-08-20T00:00:00.000Z';
    const result = applyStatusTransition(current({ status: 'inProgress', startedAt: started }), 'completed', NOW);
    expect(result).toEqual({ status: 'completed', startedAt: started, completedAt: NOW.toISOString() });
  });

  it('stamps both when jumping new -> completed directly', () => {
    const result = applyStatusTransition(current(), 'completed', NOW);
    expect(result).toEqual({ status: 'completed', startedAt: null, completedAt: NOW.toISOString() });
  });

  it('does not clobber an existing startedAt on a repeat move into inProgress', () => {
    const originalStart = '2026-08-01T00:00:00.000Z';
    const result = applyStatusTransition(
      current({ status: 'completed', startedAt: originalStart, completedAt: '2026-08-10T00:00:00.000Z' }),
      'inProgress',
      NOW,
    );
    expect(result.startedAt).toBe(originalStart);
  });

  it('does not clobber an existing completedAt on a repeat move into completed', () => {
    const originalComplete = '2026-08-10T00:00:00.000Z';
    const result = applyStatusTransition(
      current({ status: 'inProgress', startedAt: '2026-08-01T00:00:00.000Z', completedAt: originalComplete }),
      'completed',
      NOW,
    );
    expect(result.completedAt).toBe(originalComplete);
  });

  it('leaves timestamps untouched when moving back to new', () => {
    const result = applyStatusTransition(
      current({ status: 'completed', startedAt: '2026-08-01T00:00:00.000Z', completedAt: '2026-08-10T00:00:00.000Z' }),
      'new',
      NOW,
    );
    expect(result).toEqual({
      status: 'new',
      startedAt: '2026-08-01T00:00:00.000Z',
      completedAt: '2026-08-10T00:00:00.000Z',
    });
  });

  it('is a no-op when the status is unchanged', () => {
    const same = current({ status: 'inProgress', startedAt: '2026-08-01T00:00:00.000Z' });
    const result = applyStatusTransition(same, 'inProgress', NOW);
    expect(result).toEqual(same);
  });
});

describe('findIncompleteDependencies', () => {
  it('returns refs that are not completed', () => {
    const statusByRef = new Map<string, ChangeStatus>([
      ['CR-001', 'completed'],
      ['CR-002', 'inProgress'],
      ['CR-003', 'new'],
    ]);
    expect(findIncompleteDependencies(['CR-001', 'CR-002', 'CR-003'], statusByRef)).toEqual(['CR-002', 'CR-003']);
  });

  it('treats an unknown ref as incomplete', () => {
    const statusByRef = new Map<string, ChangeStatus>([['CR-001', 'completed']]);
    expect(findIncompleteDependencies(['CR-999'], statusByRef)).toEqual(['CR-999']);
  });

  it('returns an empty array when every dependency is completed', () => {
    const statusByRef = new Map<string, ChangeStatus>([
      ['CR-001', 'completed'],
      ['CR-002', 'completed'],
    ]);
    expect(findIncompleteDependencies(['CR-001', 'CR-002'], statusByRef)).toEqual([]);
  });

  it('returns an empty array for an empty dependsOn list', () => {
    expect(findIncompleteDependencies([], new Map())).toEqual([]);
  });
});
