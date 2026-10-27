import { describe, expect, it } from 'vitest';
import type { Confidence, UserAttempt } from '../../types/attempt';
import { calibration, CALIBRATION_MIN } from '../confidenceCheck';

let n = 0;
function attempt(structureId: string, correct: boolean, confidence?: Confidence, day = n): UserAttempt {
  n += 1;
  return {
    id: `a${n}`, userId: 'u', sessionId: 's', questionId: `q${n}`, questionType: 'mcq', structureId,
    promptKind: 'identify', region: 'hip-thigh', category: 'muscle', correct, confidence, attemptNumber: 1,
    timestamp: new Date(Date.UTC(2026, 9, 1 + day)).toISOString(),
  } as UserAttempt;
}

/** `count` structures, each answered right with `rating`, then answered again `nextRight` or not. */
function pairs(rating: Confidence, count: number, nextRightCount: number): UserAttempt[] {
  const out: UserAttempt[] = [];
  for (let i = 0; i < count; i++) {
    const id = `${rating}-${i}`;
    out.push(attempt(id, true, rating, 1), attempt(id, i < nextRightCount, undefined, 9));
  }
  return out;
}

describe('calibration', () => {
  it('gives no advice until there are enough rated answers, but shows the figures from the first', () => {
    const result = calibration([...pairs('easy', CALIBRATION_MIN - 1, 0), ...pairs('hard', 3, 2)]);
    expect(result.verdict).toBe('too-soon');
    expect(result.hard.share).toBeCloseTo(2 / 3);
    expect(result.hard.judged).toBe(false);
    expect(result.medium.share).toBeNull();
  });

  it('flags Easy pressed for things that do not last', () => {
    const result = calibration(pairs('easy', 20, 12));
    expect(result.easy.share).toBeCloseTo(0.6);
    expect(result.verdict).toBe('easy-too-often');
  });

  it('flags Hard pressed for things the student keeps', () => {
    const result = calibration([...pairs('easy', 20, 18), ...pairs('hard', 20, 19)]);
    expect(result.verdict).toBe('hard-too-often');
  });

  it('is content when the ratings mean what they say', () => {
    expect(calibration([...pairs('easy', 20, 18), ...pairs('hard', 20, 10)]).verdict).toBe('well-judged');
  });

  it('ignores wrong answers and the last answer to a question, which has no next time', () => {
    const lone = [attempt('x', true, 'easy'), attempt('y', false, 'easy'), attempt('y', true, undefined)];
    const result = calibration(lone);
    expect(result.easy.pairs).toBe(0);
  });

  it('pairs within a question, not across a structure’s different questions', () => {
    const origin = { ...attempt('z', true, 'easy', 1), questionType: 'oina', promptKind: 'origin' } as UserAttempt;
    const naming = attempt('z', false, undefined, 2);
    expect(calibration([origin, naming]).easy.pairs).toBe(0);
  });
});
