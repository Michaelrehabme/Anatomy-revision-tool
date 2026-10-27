import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES as LIVE_STRUCTURES, structuresWithLigamentPictures } from '../../data/seed';

/**
 * The typed boxes are part of the picture question, switched off for
 * ligaments for now (data/clinicalLigaments.ts); the tests below run on the
 * data with it on, so the boxes keep working for when it returns. The live
 * data's own ligaments-only session is checked at the end.
 */
const ALL_STRUCTURES = structuresWithLigamentPictures();
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
    // Built rather than found. This used to look for an unchecked ligament in
    // the data, and on 28 Sep 2026 the last one was checked — at which point
    // the test failed for the best possible reason and stopped testing the
    // guard at all. The guard is what matters: the next ligament added
    // unreviewed must still be asked by picture and name only.
    const target = ALL_STRUCTURES.filter(isLigament).find(
      // Asked from a picture: only the clinically important ligaments are.
      (l) => l.attachmentStructureIds.length > 0 && l.eligibility.mcq && l.eligibility.picture !== false && l.imageIds.length > 0,
    )!;
    const structures = ALL_STRUCTURES.map((s) => (s.id === target.id ? { ...s, needsReview: true } : s));
    const questions = generateRevisionSet(structures, ALL_IMAGES, {
      entitledAreas: AREAS,
      types: ['identify-typed', 'multi-select'],
      category: 'ligament',
      mode: 'practice',
      structureIds: [target.id],
      seed: 11,
    });

    const attachmentQs = questions.filter(
      (q) => q.type === 'multi-select' || (q.type === 'identify-typed' && (q.attachmentSlots?.length ?? 0) > 0),
    );
    expect(attachmentQs.map((q) => q.id)).toEqual([]);
    // It is still asked by picture and name.
    expect(questions.some((q) => q.type === 'identify-typed')).toBe(true);
  });
});

describe('a ligaments-only session on the live data', () => {
  const set = generateRevisionSet(LIVE_STRUCTURES, ALL_IMAGES, {
    entitledAreas: AREAS,
    types: ['mcq', 'identify-typed'],
    category: 'ligament',
    mode: 'practice',
    seed: 11,
  });

  // Since 27 Oct 2026 a redrawn ligament is also named from its redraw — only
  // ever the redraw, and typed on the name alone. Everything else stays as it was.
  it('names a ligament from its redraw or from its attachments, as bullet points — never the old plate', () => {
    const named = set.filter((q) => (q.type === 'mcq' || q.type === 'identify-typed') && q.promptKind === 'identify');
    expect(named.length).toBeGreaterThan(0);
    for (const q of named) {
      const image = (q as { promptImageId?: string }).promptImageId;
      if (image) {
        expect(image, q.id).toMatch(/^redraw-/);
        expect((q as { attachmentSlots?: unknown[] }).attachmentSlots, q.id).toBeUndefined();
        continue;
      }
      const lines = (q as { promptLines?: string[] }).promptLines ?? [];
      expect(lines.length, q.id).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line, q.id).toMatch(/^Attaches to: /);
        // Named from the index, not the narrowed pool: no raw ids.
        // The site's name, that is: its sourced part may say "under-surface".
        expect(line.split(' — ')[0], q.id).not.toMatch(/[a-z]-[a-z]/);
      }
    }
  });
});
