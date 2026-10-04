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
 * A LOCATE QUESTION ANSWERED IN WORDS IS NOT A LOCATE.
 *
 * The owner has not decided whether it should count as one
 * (docs/accessibility-locate.md), so the default keeps them apart and one
 * constant joins them. Both settings are pinned here, so whichever is chosen
 * the other is known to work.
 */
const locate = { type: 'locate', promptKind: 'identify' } as const;

describe('what an answer is recorded and credited as', () => {
  it('a tap, or a name from the list, is the locate question it answered', () => {
    expect(askedAs(locate, undefined)).toEqual({ recorded: locate, credited: locate });
  });

  it('a description is recorded as its own kind, and by default credited as its own kind', () => {
    expect(DESCRIBED_REGION_COUNTS_AS_LOCATE).toBe(false);
    const words = { type: 'mcq', promptKind: 'described-region' };
    expect(askedAs(locate, 'described-region')).toEqual({ recorded: words, credited: words });
  });

  it('so by default it moves a fact row of its own, never the row a tap moves, and never the naming ladder', () => {
    const { credited } = askedAs(locate, 'described-region');
    // A tap goes to the structure's own row...
    expect(skillOf(locate.type, locate.promptKind)).toBe('identify');
    // ...a description to a row nothing else writes.
    expect(skillOf(credited.type, credited.promptKind)).toBe('described-region');
  });

  it('and that row is not one a structure needs for its level, so answering in words cannot lower or raise it', () => {
    for (const s of ALL_STRUCTURES) expect(requiredFactKinds(s)).not.toContain('described-region');
  });

  it('with the switch on, it is credited exactly as the tap would be — and still recorded as what it was', () => {
    const { recorded, credited } = askedAs(locate, 'described-region', true);
    expect(recorded).toEqual({ type: 'mcq', promptKind: 'described-region' });
    expect(credited).toEqual(locate);
    expect(skillOf(credited.type, credited.promptKind)).toBe('identify');
    // Locate is outside the naming ladder either way.
    expect(rungOfQuestion(credited.type, undefined, credited.promptKind)).toBeNull();
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
