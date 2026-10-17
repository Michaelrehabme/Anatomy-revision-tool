import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { buildMcqQuestions } from '../questionGenerators/mcq';
import { buildIndexes } from '../indexes';
import { createRng } from '../rng';
import { isMuscle } from '../../types/structure';
import { cardBullets } from '../facts';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { AREAS } from '../../types/region';

/**
 * A muscle is asked "What muscle is this?" over its four facts, one labelled
 * line each (owner, 17 Oct 2026), and its card uses the same labels.
 */
describe('a muscle as its four facts', () => {
  const muscles = ALL_STRUCTURES.filter(isMuscle);
  // Built over everything, landmarks and bones included, so a non-muscle has
  // every chance to turn up among the choices.
  const muscleIds = new Set(muscles.map((m) => m.id));
  const questions = buildMcqQuestions(ALL_STRUCTURES, ALL_IMAGES, buildIndexes(ALL_STRUCTURES), createRng(5), { promptKinds: ['identify'] });
  const text = questions.filter((q) => q.id.endsWith('-identify-text') && muscleIds.has(q.structureId));

  it('is asked with Origin(s), Insertion(s), Nerve supply and Action(s), in that order', () => {
    expect(text.length).toBeGreaterThan(50);
    for (const q of text) {
      expect(q.prompt, q.id).toBe('What muscle is this?');
      expect(q.promptLines?.map((line) => line.split(':')[0]), q.id).toEqual(['Origin(s)', 'Insertion(s)', 'Nerve supply', 'Action(s)']);
      for (const line of q.promptLines ?? []) expect(line.split(': ')[1]?.trim().length, `${q.id}: ${line}`).toBeGreaterThan(0);
    }
  });

  it('offers only muscles as the wrong answers', () => {
    const byName = new Map(ALL_STRUCTURES.map((s) => [s.name, s]));
    for (const q of text) for (const choice of q.choices) expect(byName.get(choice)?.category, `${q.id}: ${choice}`).toBe('muscle');
  });

  it('offers only muscles in a one-muscle drill too, where every wrong answer comes from the top-up pool', () => {
    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS, types: ['mcq'], mode: 'practice', structureIds: ['deltoid'], seed: 1 });
    const q = set.find((x) => x.id === 'mcq-deltoid-identify-text');
    expect(q?.type).toBe('mcq');
    const byName = new Map(ALL_STRUCTURES.map((s) => [s.name, s.category]));
    if (q?.type === 'mcq') for (const choice of q.choices) expect(byName.get(choice), choice).toBe('muscle');
  });

  it('uses the same labels on the card, with the facts in bold', () => {
    const deltoid = muscles.find((m) => m.id === 'deltoid')!;
    const back = cardBullets(deltoid);
    expect(back).toContain('• Origin(s): **');
    expect(back).toContain('• Insertion(s): **');
    expect(back).toContain('• Nerve supply: **');
    expect(back).toMatch(/• Action\(s\): .*\*\*Abducts\*\*/);
  });
});
