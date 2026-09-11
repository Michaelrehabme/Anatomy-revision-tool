import { describe, it, expect, beforeEach } from 'vitest';
import { HINT_SHOW_LIMIT, recordHintShown, shouldShowHint } from '../firstTimeHints';

describe('first-time hints', () => {
  beforeEach(() => localStorage.clear());

  it('shows a hint its allotted number of times, then stops', () => {
    for (let i = 0; i < HINT_SHOW_LIMIT.confidence; i++) {
      expect(shouldShowHint('confidence')).toBe(true);
      recordHintShown('confidence');
    }
    expect(shouldShowHint('confidence')).toBe(false);
  });

  it('counts each hint separately and shrugs off a corrupt value', () => {
    recordHintShown('confidence');
    expect(shouldShowHint('locate')).toBe(true);
    localStorage.setItem('anatomy-revision:v1:hint:locate', 'many');
    expect(shouldShowHint('locate')).toBe(true);
  });
});
