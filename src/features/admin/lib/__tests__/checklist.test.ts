import { describe, expect, it } from 'vitest';
import {
  checklistProgress,
  isChecklistItemDone,
  orphanedChecklistTicks,
  sortChecklist,
  toggleChecklistItem,
  walkthroughSteps,
} from '../checklist';
import type { ChecklistItem } from '../../types/changeRequest';

function item(id: string, rank: number): ChecklistItem {
  return { id, rank, label: id, why: '', walkthrough: '', effort: '1 hour' };
}

const ITEMS = [item('c', 3), item('a', 1), item('b', 2)];

describe('sortChecklist', () => {
  it('orders by rank, not by declaration order', () => {
    expect(sortChecklist(ITEMS).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks rank ties on id so the list never reshuffles between renders', () => {
    const tied = [item('z', 1), item('y', 1)];
    expect(sortChecklist(tied).map((i) => i.id)).toEqual(['y', 'z']);
  });

  it('does not mutate the input', () => {
    const input = [item('c', 3), item('a', 1)];
    sortChecklist(input);
    expect(input.map((i) => i.id)).toEqual(['c', 'a']);
  });
});

describe('toggleChecklistItem', () => {
  it('stamps the time it was ticked rather than a boolean', () => {
    const now = new Date('2026-09-13T10:00:00.000Z');
    expect(toggleChecklistItem(undefined, 'a', now)).toEqual({ a: '2026-09-13T10:00:00.000Z' });
  });

  it('removes the key on untick, so only done items are stored', () => {
    const done = { a: '2026-09-13T10:00:00.000Z', b: '2026-09-13T11:00:00.000Z' };
    expect(toggleChecklistItem(done, 'a')).toEqual({ b: '2026-09-13T11:00:00.000Z' });
  });

  it('round-trips: untick then retick stamps the new time, losing the old one', () => {
    // Documented, not accidental — it is why the panel confirms an untick.
    const done = { a: '2026-09-13T10:00:00.000Z' };
    const unticked = toggleChecklistItem(done, 'a');
    expect(isChecklistItemDone(unticked, 'a')).toBe(false);
    expect(toggleChecklistItem(unticked, 'a', new Date('2027-01-01T00:00:00.000Z'))).toEqual({
      a: '2027-01-01T00:00:00.000Z',
    });
  });

  it('does not mutate the record it was given', () => {
    const done = { a: '2026-09-13T10:00:00.000Z' };
    toggleChecklistItem(done, 'b');
    expect(done).toEqual({ a: '2026-09-13T10:00:00.000Z' });
  });
});

describe('checklistProgress', () => {
  it('counts ticks and names the highest-ranked outstanding item', () => {
    const progress = checklistProgress(ITEMS, { a: '2026-09-13T10:00:00.000Z' });
    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(3);
    expect(progress.fraction).toBeCloseTo(1 / 3);
    expect(progress.nextUp?.id).toBe('b');
  });

  it('reports nextUp as null once everything is ticked', () => {
    const done = { a: 'x', b: 'x', c: 'x' };
    expect(checklistProgress(ITEMS, done).nextUp).toBeNull();
    expect(checklistProgress(ITEMS, done).fraction).toBe(1);
  });

  it('reads an empty checklist as 0 rather than NaN', () => {
    expect(checklistProgress([], undefined).fraction).toBe(0);
  });

  it('ignores ticks for ids the seed no longer defines', () => {
    const progress = checklistProgress(ITEMS, { a: 'x', 'removed-step': 'x' });
    expect(progress.completed).toBe(1);
  });
});

describe('orphanedChecklistTicks', () => {
  it('surfaces stored ticks with no matching step, which means an id was renamed', () => {
    expect(orphanedChecklistTicks(ITEMS, { a: 'x', gone: 'x', alsoGone: 'x' })).toEqual(['alsoGone', 'gone']);
  });

  it('is empty when every tick matches a step', () => {
    expect(orphanedChecklistTicks(ITEMS, { a: 'x' })).toEqual([]);
    expect(orphanedChecklistTicks(ITEMS, undefined)).toEqual([]);
  });
});

describe('walkthroughSteps', () => {
  it('splits on newlines and drops blank lines', () => {
    expect(walkthroughSteps('1. One\n\n2. Two\n   \n3. Three')).toEqual(['1. One', '2. Two', '3. Three']);
  });

  it('returns nothing for an empty walkthrough', () => {
    expect(walkthroughSteps('')).toEqual([]);
  });
});
