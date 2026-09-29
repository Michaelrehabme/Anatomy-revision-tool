import { describe, it, expect } from 'vitest';
import { structureTitle, titleForPath } from '../shared/PageTitle';

describe('page titles (WCAG 2.4.2)', () => {
  it('names each route, most specific first', () => {
    expect(titleForPath('/atlas')).toBe('Atlas · LocusMSK');
    expect(titleForPath('/study/setup')).toBe('Set up a session · LocusMSK');
    expect(titleForPath('/study')).toBe('Study · LocusMSK');
    expect(titleForPath('/session/results')).toBe('Session results · LocusMSK');
    expect(titleForPath('/educator/demo-cohort/students')).toBe('Class dashboard · LocusMSK');
    expect(titleForPath('/privacy')).toBe('Privacy policy · LocusMSK');
  });

  it('leaves a structure card to name itself, and calls anything else the app', () => {
    expect(titleForPath('/structure/deltoid')).toBeNull();
    expect(structureTitle('Deltoid')).toBe('Deltoid · LocusMSK');
    expect(titleForPath('/')).toBe('LocusMSK');
    expect(titleForPath('/atlasfoo')).toBe('LocusMSK');
  });
});
