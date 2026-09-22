import { describe, expect, it } from 'vitest';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { AREAS } from '../../types/region';
import { isLigament } from '../../types/structure';

/**
 * A session narrowed to ligaments is the one session that is entirely about
 * ligaments, and it was the one where both attachment features silently
 * disappeared: the generators looked their bones up in the filtered POOL,
 * which by definition contains no bones once the category filter is on.
 *
 * Nothing caught it, because every existing test called the generators with
 * the whole dataset — the shape the app never uses once a student picks a
 * category. Running the app found it in a minute. These tests pin the
 * narrowed pool specifically.
 */
describe('a ligaments-only session', () => {
  const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
    types: ['identify-typed', 'multi-select'],
    category: 'ligament',
    mode: 'practice',
    seed: 11,
  });

  it('still asks for attachments in the typed boxes', () => {
    const typed = set.filter((q) => q.type === 'identify-typed');
    expect(typed.length).toBeGreaterThan(0);
    const withSlots = typed.filter((q) => 'attachmentSlots' in q && q.attachmentSlots?.length);
    expect(withSlots.length).toBeGreaterThan(0);

    // The boxes must be NAMED — an unresolved id would render "tibia" as a
    // placeholder but accept nothing a student would type.
    for (const q of withSlots) {
      for (const slot of (q as { attachmentSlots: { accepted: string[] }[] }).attachmentSlots) {
        expect(slot.accepted.length).toBeGreaterThan(0);
        expect(slot.accepted[0]).not.toMatch(/-/); // a raw id, not a name
      }
    }
  });

  it('still asks which bones a ligament attaches to, with real bone distractors', () => {
    const attachment = set.filter((q) => q.id.startsWith('multiselect-ligament-attachment-'));
    expect(attachment.length).toBeGreaterThan(0);
    for (const q of attachment) {
      // Two correct answers minimum means the wrong ones are real alternatives.
      const multi = q as { choices: string[]; correctIndices: number[] };
      expect(multi.choices.length).toBeGreaterThanOrEqual(multi.correctIndices.length + 2);
    }
  });

  it('names every attachment box from the dataset, not from the narrowed pool', () => {
    // The regression in one line: every ligament with attachments should get
    // one box per attachment however the pool is filtered.
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    const typed = set.filter((q) => q.type === 'identify-typed');
    for (const q of typed) {
      const lig = byId.get(q.structureId);
      if (!lig || !isLigament(lig)) continue;
      const slots = (q as { attachmentSlots?: unknown[] }).attachmentSlots ?? [];
      // Only checked attachments are asked (reviewedAttachmentIds).
      expect(slots.length).toBe(lig.needsReview ? 0 : lig.attachmentStructureIds.length);
    }
  });

  it('never asks or marks an attachment nobody has checked', () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    const unchecked = (id: string) => {
      const s = byId.get(id);
      return !!s && isLigament(s) && !!s.needsReview;
    };
    const attachmentQs = set.filter(
      (q) => unchecked(q.structureId) && (q.type === 'multi-select' || (q.type === 'identify-typed' && (q.attachmentSlots?.length ?? 0) > 0)),
    );
    expect(attachmentQs.map((q) => q.id)).toEqual([]);
    // They are still asked by picture and name.
    expect(set.some((q) => unchecked(q.structureId))).toBe(true);
  });
});
