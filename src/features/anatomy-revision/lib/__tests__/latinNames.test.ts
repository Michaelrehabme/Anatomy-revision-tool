import { describe, it, expect, beforeEach } from 'vitest';
import { MUSCLE_STRUCTURES } from '../../data/seed/structures.muscles.seed';
import { getShowLatin, setShowLatin } from '../preferences';

describe('Latin names', () => {
  it('gives every muscle its TA2 Latin name', () => {
    const missing = MUSCLE_STRUCTURES.filter((m) => !m.latin).map((m) => m.id);
    expect(missing).toEqual([]);
    expect(MUSCLE_STRUCTURES.find((m) => m.id === 'external-oblique')?.latin).toBe('Musculus obliquus externus abdominis');
  });

  describe('the setting', () => {
    beforeEach(() => localStorage.clear());

    it('is off until someone turns it on, and remembers the choice', () => {
      expect(getShowLatin()).toBe(false);
      setShowLatin(true);
      expect(getShowLatin()).toBe(true);
      setShowLatin(false);
      expect(getShowLatin()).toBe(false);
    });
  });
});
