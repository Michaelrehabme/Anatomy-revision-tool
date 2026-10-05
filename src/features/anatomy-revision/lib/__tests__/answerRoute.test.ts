import { beforeEach, describe, expect, it } from 'vitest';
import { askedAs, DESCRIBED_REGION_COUNTS_AS_LOCATE } from '../answerRoute';
import { skillOf } from '../factMastery';
import { rungOfQuestion } from '../ladder';
import { requiredFactKinds } from '../factMastery';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { generateRevisionSet, type RevisionSetConfig } from '../questionGenerators/generateSet';
import { setLocateWithoutPicture } from '../preferences';
import { AREAS } from '../../types/region';

/**
 * A LOCATE QUESTION ANSWERED IN WORDS IS CREDITED AS A LOCATE, AND RECORDED AS
 * WHAT IT WAS.
 *
 * The owner decided on 5 October 2026 that it counts toward the locate level
 * (docs/accessibility-locate.md). One constant says so. Both settings are
 * pinned here, so the one not chosen is still known to work if the decision
 * is ever reversed.
 */
const locate = { type: 'locate', promptKind: 'identify' } as const;

describe('what an answer is recorded and credited as', () => {
  it('a tap, or a name from the list, is the locate question it answered', () => {
    expect(askedAs(locate, undefined)).toEqual({ recorded: locate, credited: locate });
  });

  it('a description is recorded as its own kind, and by default credited as the locate it answered', () => {
    expect(DESCRIBED_REGION_COUNTS_AS_LOCATE).toBe(true);
    const { recorded, credited } = askedAs(locate, 'described-region');
    // The attempt row still says what was done...
    expect(recorded).toEqual({ type: 'mcq', promptKind: 'described-region' });
    // ...and the credit goes where a tap's would.
    expect(credited).toEqual(locate);
  });

  it('so by default it moves the row a tap moves, and never the naming ladder', () => {
    const { credited } = askedAs(locate, 'described-region');
    expect(skillOf(credited.type, credited.promptKind)).toBe(skillOf(locate.type, locate.promptKind));
    expect(skillOf(credited.type, credited.promptKind)).toBe('identify');
    // Locate is outside the naming ladder, so words cannot promote a structure to typed answers.
    expect(rungOfQuestion(credited.type, undefined, credited.promptKind)).toBeNull();
  });

  it('with the switch off, it is credited as its own kind, on a fact row nothing else writes', () => {
    const words = { type: 'mcq', promptKind: 'described-region' };
    const { recorded, credited } = askedAs(locate, 'described-region', false);
    expect(recorded).toEqual(words);
    expect(credited).toEqual(words);
    expect(skillOf(credited.type, credited.promptKind)).toBe('described-region');
  });

  it('and that row is not one a structure needs for its level, so with the switch off words cannot lower or raise it', () => {
    for (const s of ALL_STRUCTURES) expect(requiredFactKinds(s)).not.toContain('described-region');
  });

  it('other questions are untouched', () => {
    const origin = { type: 'mcq', promptKind: 'origin' } as const;
    expect(askedAs(origin, undefined)).toEqual({ recorded: origin, credited: origin });
  });
});

describe('the setting changes how a question is answered, never which questions are asked', () => {
  beforeEach(() => localStorage.clear());

  it('the same seeds build the same sets, byte for byte, with it off and with it on', () => {
    const configs: RevisionSetConfig[] = AREAS.flatMap((area) => [
      { types: ['locate'], mode: 'practice', areas: [area], entitledAreas: [area], seed: 21 },
      { types: ['mcq', 'locate', 'identify-typed'], mode: 'adaptive', areas: [area], entitledAreas: [area], count: 20, seed: 7 },
    ]);
    const build = () => JSON.stringify(configs.map((c) => generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, c)));
    setLocateWithoutPicture(false);
    const off = build();
    setLocateWithoutPicture(true);
    const on = build();
    expect(on).toBe(off);
    // And no generated question is of the kind an answer in words is recorded as.
    expect(off).not.toContain('described-region');
    expect(JSON.parse(off).flat().length).toBeGreaterThan(700);
  });
});
