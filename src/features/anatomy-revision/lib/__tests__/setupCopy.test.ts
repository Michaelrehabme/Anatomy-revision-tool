import { describe, it, expect } from 'vitest';
import { unbuildableSessionReason } from '../setupCount';
import { firstRunTitle, minutesFor } from '../sessionCopy';

describe('unbuildableSessionReason', () => {
  it('stays quiet while there is something to ask, or nothing chosen', () => {
    expect(unbuildableSessionReason({ types: ['mcq'], poolSize: 10, available: 3 })).toBeNull();
    expect(unbuildableSessionReason({ types: [], poolSize: 10, available: 0 })).toBeNull();
    expect(unbuildableSessionReason({ types: ['mcq'], poolSize: 0, available: 0 })).toBeNull();
  });

  it('names the hotspot gap for a locate-only dead end and the muscle-only one for OINA', () => {
    expect(unbuildableSessionReason({ types: ['locate'], poolSize: 28, available: 0 })).toMatch(/hotspots/);
    expect(unbuildableSessionReason({ types: ['oina'], poolSize: 28, available: 0 })).toMatch(/only muscles/);
    expect(unbuildableSessionReason({ types: ['locate', 'mcq'], poolSize: 28, available: 0 })).toMatch(/adding a format/);
  });
});

describe('first-run copy', () => {
  it('names one area, generalises several, and copes with none', () => {
    expect(firstRunTitle(['shoulder'])).toBe('Start with the shoulder');
    expect(firstRunTitle(['shoulder', 'knee'])).toBe('Start with your areas');
    expect(firstRunTitle([])).toBe('Start with a short session');
  });

  it('never promises zero minutes', () => {
    expect(minutesFor(8)).toBe(4);
    expect(minutesFor(1)).toBe(1);
  });
});
