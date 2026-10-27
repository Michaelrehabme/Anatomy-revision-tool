import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlashcardSession } from '../FlashcardSession/FlashcardSession';
import { MobileFlashcardSession } from '../mobile/MobileFlashcardSession';
import { buildFlashcardQuestions } from '../../lib/questionGenerators/flashcards';
import { ownPictureOf } from '../../lib/ownPicture';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';

/**
 * A landmark or joint picture is a plain skeleton with its target stored
 * beside it. The flashcard drew the picture and not the target, so the
 * obturator foramen's card was an unmarked pelvis (student report, 16 Oct
 * 2026). The card draws it now, front and back, as MCQ and the Atlas do.
 */
const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
const cards = buildFlashcardQuestions(ALL_STRUCTURES.filter((s) => s.id === 'obturator-foramen'), ALL_IMAGES);
const card = cards.find((q) => q.id === 'flashcard-obturator-foramen-image')!;
const wordCard = cards.find((q) => q.id === 'flashcard-obturator-foramen-text')!;
/** What the overlay draws on the picture: an outline, or the target face for a traced region. */
const outlines = () => document.querySelectorAll('svg polygon, svg path').length;

describe('the obturator foramen flashcard', () => {
  it('exists, and shows a picture on its front', () => {
    expect(card).toBeDefined();
    expect(card.front.imageId).toBeDefined();
  });

  for (const [name, Session] of [['desktop', FlashcardSession], ['mobile', MobileFlashcardSession]] as const) {
    it(`marks the foramen on the picture card's front (${name})`, () => {
      render(<Session question={card} imagesById={imagesById} onAnswer={vi.fn()} onNext={vi.fn()} />);
      expect(outlines()).toBeGreaterThan(0);
    });

    it(`marks it on the word card's back (${name})`, () => {
      render(<Session question={wordCard} imagesById={imagesById} onAnswer={vi.fn()} onNext={vi.fn()} />);
      expect(outlines()).toBe(0);
      fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }));
      expect(outlines()).toBeGreaterThan(0);
    });
  }
});

describe('a joint card shows its traced joint line, not the old ligament strip', () => {
  // Eight joints listed their five-view strip first, which colours the
  // ligaments over the joint; the owner's rule is the joint line.
  const joints = ALL_STRUCTURES.filter((s) => s.category === 'joint');
  it.each(joints.map((s) => s.id))('%s', (id) => {
    const traced = ALL_IMAGES.some((i) => i.structureId === id && (i.hotspots ?? []).some((h) => h.structureId === id));
    const picture = ownPictureOf(id, ALL_IMAGES);
    if (traced) expect((picture?.hotspots ?? []).some((h) => h.structureId === id)).toBe(true);
  });
});
