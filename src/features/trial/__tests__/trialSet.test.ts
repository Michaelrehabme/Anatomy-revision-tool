import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../anatomy-revision/data/seed';
import { QUESTION_FORMATS } from '../../anatomy-revision/lib/questionFormats';
import { buildTrialSet, TRIAL_SPECS, TRIAL_TYPES } from '../trialSet';

/**
 * The trial is a fixed set by the owner's decision (12 October 2026), and it
 * names its questions by the ids the generators give them. A renamed picture
 * or a reworded generator would quietly shorten it; this is what notices.
 */
describe('the trial set', () => {
  const set = buildTrialSet(ALL_STRUCTURES, ALL_IMAGES);

  it('builds every question it names, in the order it names them', () => {
    expect(set.map((q) => [q.type, q.structureId])).toEqual(TRIAL_SPECS.map((spec) => [spec.type, spec.structureId]));
    for (const [index, spec] of TRIAL_SPECS.entries()) {
      if (spec.id) expect(set[index].id).toBe(spec.id);
    }
  });

  it('is the same on every visit, wrong answers and their order included', () => {
    expect(buildTrialSet(ALL_STRUCTURES, ALL_IMAGES)).toEqual(set);
  });

  it('has every format a student can choose', () => {
    expect([...TRIAL_TYPES].sort()).toEqual(QUESTION_FORMATS.map((format) => format.value).sort());
  });

  it('asks nothing about blood supply', () => {
    expect(set.filter((q) => q.promptKind.startsWith('blood-supply'))).toEqual([]);
  });
});
