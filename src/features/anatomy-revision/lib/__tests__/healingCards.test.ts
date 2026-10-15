import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { STRUCTURE_HEALING, TISSUE_HEALING } from '../../data/seed/healing.seed';
import { AREAS } from '../../types/region';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { excludedWork } from '../../../../scripts/lib/provenance';

/**
 * The healing cards (15 October 2026): sourced claims about how a structure
 * heals, which replaced the unsourced blood supply questions. What is pinned:
 * every card reaches a real structure and a session, every source is from an
 * allowed work at an address it can be checked at, and a contested point is
 * never taught as settled.
 */

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const cards = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { types: ['flashcard'], entitledAreas: AREAS, mode: 'practice', seed: 1 }).filter(
  (q) => q.id.includes('-healing-'),
);

describe('the healing cards', () => {
  it('each belong to a structure the app has, which can carry cards', () => {
    for (const entry of STRUCTURE_HEALING) {
      const structure = byId.get(entry.structureId);
      expect(structure, entry.structureId).toBeDefined();
      expect(structure!.eligibility.flashcard, entry.structureId).toBe(true);
    }
  });

  it('all reach a flashcard session, one card per claim', () => {
    expect(cards).toHaveLength(STRUCTURE_HEALING.length);
    expect(new Set(cards.map((q) => q.id)).size).toBe(cards.length);
  });

  it('cite only allowed works, at addresses a reader can check', () => {
    const sources = [...STRUCTURE_HEALING.flatMap((e) => e.sources), ...Object.values(TISSUE_HEALING).map((t) => t.source)];
    for (const source of sources) {
      expect(excludedWork({ title: source.label, url: source.url }), source.label).toBeNull();
      expect(source.url, source.label).toMatch(/^https:\/\/(www\.ncbi\.nlm\.nih\.gov\/books\/NBK\d+\/|pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC\d+\/|europepmc\.org\/abstract\/MED\/\d+|radiopaedia\.org\/articles\/)/);
    }
  });

  it('name their sources and the tissue\'s healing on the back, and say so when a point is contested', () => {
    for (const card of cards) {
      if (card.type !== 'flashcard') continue;
      const entry = STRUCTURE_HEALING.find((e) => card.id === `flashcard-${e.structureId}-healing-${e.key}`)!;
      expect(card.back.text, card.id).toContain('Sources: ');
      expect(card.back.text, card.id).toContain(TISSUE_HEALING[entry.tissue].text);
      expect(card.back.text.includes('Contested: '), card.id).toBe(Boolean(entry.contested));
    }
  });

  it('never teach that the ACL fails to heal for want of a blood supply', () => {
    const acl = STRUCTURE_HEALING.find((e) => e.structureId === 'anterior-cruciate-ligament')!;
    expect(acl.contested).toMatch(/Do not learn "the ACL has no blood supply"/);
    expect(acl.answer).not.toMatch(/no blood supply|avascular/i);
  });
});
