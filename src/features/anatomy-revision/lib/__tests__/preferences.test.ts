import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_LEARN_CARD_ATTEMPTS,
  getLearnCardAttempts,
  getPreferredAreas,
  setLearnCardAttempts,
  setPreferredAreas,
} from '../preferences';

const KEY = 'anatomy-revision:v1:oinaLearnCardAttempts';

describe('learn-card preference', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to teaching for the first few attempts', () => {
    expect(getLearnCardAttempts()).toBe(DEFAULT_LEARN_CARD_ATTEMPTS);
  });

  it('round-trips a choice, including turning cards off', () => {
    setLearnCardAttempts(1);
    expect(getLearnCardAttempts()).toBe(1);
    setLearnCardAttempts(0);
    expect(getLearnCardAttempts()).toBe(0);
  });

  /** A corrupt value must not silently switch teaching off for a new student. */
  it('falls back to the default rather than trusting a bad stored value', () => {
    for (const bad of ['', 'lots', '-2', 'NaN', '{}']) {
      localStorage.setItem(KEY, bad);
      expect(getLearnCardAttempts(), bad).toBe(DEFAULT_LEARN_CARD_ATTEMPTS);
    }
  });

  it('never stores a negative or fractional count', () => {
    setLearnCardAttempts(-5);
    expect(getLearnCardAttempts()).toBe(0);
    setLearnCardAttempts(2.7);
    expect(getLearnCardAttempts()).toBe(2);
  });
});

describe('preferred-areas preference', () => {
  beforeEach(() => localStorage.clear());

  it('means "every area" until something is chosen', () => {
    expect(getPreferredAreas()).toEqual([]);
  });

  it('round-trips a choice in canonical order without duplicates', () => {
    setPreferredAreas(['knee', 'shoulder', 'knee']);
    expect(getPreferredAreas()).toEqual(['shoulder', 'knee']);
  });

  /**
   * A student who chose Back & Core before CR-032 split it must keep the whole spine.
   * Dropping the value instead would leave an empty selection, which every filter
   * reads as "every area" — silently widening their study from the back to the
   * entire body without telling them.
   */
  it('expands a stored area that has since been split', () => {
    localStorage.setItem('anatomy-revision:v1:preferredAreas', JSON.stringify(['back-core', 'hip']));
    expect(getPreferredAreas()).toEqual(['hip', 'cervical-spine', 'thoracic-spine', 'lumbar-spine']);
  });

  it('rewrites the legacy value on the next save, so the expansion happens once', () => {
    localStorage.setItem('anatomy-revision:v1:preferredAreas', JSON.stringify(['back-core']));
    setPreferredAreas(getPreferredAreas());
    expect(JSON.parse(localStorage.getItem('anatomy-revision:v1:preferredAreas')!)).toEqual([
      'cervical-spine',
      'thoracic-spine',
      'lumbar-spine',
    ]);
  });

  /** A stale or hand-edited value must not produce a session nothing can match. */
  it('drops anything that is not a real area and survives junk', () => {
    localStorage.setItem('anatomy-revision:v1:preferredAreas', JSON.stringify(['hip', 'forearm-hand', 42]));
    expect(getPreferredAreas()).toEqual(['hip']);
    for (const bad of ['', 'not json', '{}', '"hip"']) {
      localStorage.setItem('anatomy-revision:v1:preferredAreas', bad);
      expect(getPreferredAreas(), bad).toEqual([]);
    }
  });
});
