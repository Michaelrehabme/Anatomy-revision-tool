import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { REDRAW_TURNTABLES } from '../../data/seed/redrawTurntables.generated';
import { buildFlashcardQuestions } from '../questionGenerators/flashcards';
import { buildMcqQuestions } from '../questionGenerators/mcq';
import { buildIdentifyTypedQuestions } from '../questionGenerators/identifyTyped';
import { buildIndexes } from '../indexes';
import { createRng } from '../rng';
import { isLigament } from '../../types/structure';

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const acl = byId.get('anterior-cruciate-ligament')!;
const aclOpening = REDRAW_TURNTABLES.find((t) => t.structureId === acl.id)!.frames[0];
const aclFirstFrame = `redraw-${acl.id}-a${String(aclOpening.angle).padStart(3, '0')}-plate`;

describe('the redrawn ligaments in flashcards and questions (owner, 27 Oct 2026)', () => {
  it('puts the redraw on a ligament flashcard, not the older plate', () => {
    const cards = buildFlashcardQuestions([acl], ALL_IMAGES);
    const pictured = cards.filter((c) => c.back.imageId || c.front.imageId);
    expect(pictured.length).toBeGreaterThan(0);
    for (const c of pictured) expect(c.back.imageId ?? c.front.imageId, c.id).toBe(aclFirstFrame);
  });

  it('names a redrawn ligament from its redraw, opening on the slide view, beside its attachment lines', () => {
    // The knee's ligaments as the pool: multiple choice needs other names to offer.
    const knee = ALL_STRUCTURES.filter((s) => isLigament(s) && s.subregion === 'knee');
    const mcq = buildMcqQuestions(knee, ALL_IMAGES, buildIndexes(ALL_STRUCTURES), createRng(3), { promptKinds: ['identify'] }).filter(
      (q) => q.structureId === acl.id,
    );
    const pictures = mcq.filter((q) => q.promptImageId);
    expect(pictures.map((q) => q.promptImageId)).toEqual([aclFirstFrame]);
    expect(pictures[0].prompt).toBe('Which structure is shown?');
    expect(mcq.some((q) => q.id === `mcq-${acl.id}-identify-text` && (q.promptLines?.length ?? 0) > 0)).toBe(true);
  });

  it('types a redrawn ligament from its redraw on the name alone', () => {
    const typed = buildIdentifyTypedQuestions([acl], ALL_IMAGES, ALL_STRUCTURES).filter((q) => q.promptImageId);
    expect(typed.map((q) => q.promptImageId)).toEqual([aclFirstFrame]);
    expect(typed[0].attachmentSlots).toBeUndefined();
  });

  it('never asks a ligament to be tapped, and leaves a ligament with no redraw off pictures', () => {
    const redrawn = new Set(REDRAW_TURNTABLES.map((t) => t.structureId));
    for (const s of ALL_STRUCTURES.filter(isLigament)) {
      expect(s.eligibility.locate, s.id).toBe(false);
      if (!redrawn.has(s.id)) expect(s.eligibility.picture, s.id).toBe(false);
      else expect(s.eligibility.redrawOnly, s.id).toBe(true);
    }
  });
});
