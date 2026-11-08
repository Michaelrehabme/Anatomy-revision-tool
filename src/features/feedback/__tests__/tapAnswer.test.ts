import { describe, expect, it } from 'vitest';
import { describeTap, parseTap } from '../data/tapAnswer';

describe('a locate tap in a report', () => {
  it('reads as words and parses back to the point and the frame (owner, 8 Nov 2026)', () => {
    const given = describeTap([0.51234, 0.6339], '/anatomy/landmarks/anatomical-neck-humerus-lateral.webp');
    expect(given).toBe('Tapped 51.2% across, 63.4% down on /anatomy/landmarks/anatomical-neck-humerus-lateral.webp');
    expect(parseTap(given)).toEqual({ x: 0.512, y: 0.634, picture: '/anatomy/landmarks/anatomical-neck-humerus-lateral.webp' });
  });

  it('is not read into an ordinary answer', () => {
    expect(parseTap('flexor carpi radialis')).toBeNull();
    expect(parseTap(undefined)).toBeNull();
    expect(parseTap(describeTap([0.2, 0.3], ''))).toEqual({ x: 0.2, y: 0.3 });
  });
});
