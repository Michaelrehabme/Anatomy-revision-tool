import { describe, it, expect } from 'vitest';
import type { LandmarkStructure } from '../../types/structure';
import { buildIdentifyClue, describeStructure } from '../facts';
import { ALL_STRUCTURES } from '../../data/seed';

function landmark(overrides: Partial<LandmarkStructure> & { id: string; name: string }): LandmarkStructure {
  return {
    category: 'landmark',
    region: 'back-core',
    subregion: 'spine',
    description: 'A bony process on a vertebra.',
    aliases: [],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: [],
    attachments: [],
    ...overrides,
  };
}

describe('buildIdentifyClue', () => {
  it('never returns an empty string for a landmark with empty attachments but populated articulations', () => {
    const s = landmark({ id: 'costovertebral-joint', name: 'Costovertebral Joint', articulations: ['Rib head with the vertebral body'] });
    const clue = buildIdentifyClue(s);
    expect(clue.length).toBeGreaterThan(0);
    expect(clue).toBe('Rib head with the vertebral body');
  });

  it('falls back to the description when both attachments and articulations are empty', () => {
    const s = landmark({ id: 'x', name: 'X', description: 'A notch on the bone.' });
    expect(buildIdentifyClue(s)).toBe('A notch on the bone.');
  });

  it('prefers attachments over articulations when both are present', () => {
    const s = landmark({ id: 'y', name: 'Y', attachments: ['Ligament X'], articulations: ['Joint Y'] });
    expect(buildIdentifyClue(s)).toBe('Ligament X');
  });

  it('every structure in the real seed dataset produces a non-empty identify clue', () => {
    for (const s of ALL_STRUCTURES) {
      expect(buildIdentifyClue(s).length, `${s.id} produced an empty identify clue`).toBeGreaterThan(0);
    }
  });
});

/**
 * The "Area:" line leads every fact panel, flashcard back and MCQ explanation, and
 * it has to agree with the chip the student filtered by. Since CR-032 a structure
 * can sit in several areas, so the line names all of them.
 */
describe('describeStructure area line', () => {
  const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
  const areaLine = (id: string) => describeStructure(byId.get(id)!)[0];

  it('names every spine level for a vertebral part that has none of its own', () => {
    expect(areaLine('pedicle')).toBe('Area: Cervical Spine, Thoracic Spine, Lumbar Spine');
  });

  it('names the single level for a structure that has one', () => {
    expect(areaLine('sacrum')).toBe('Area: Lumbar Spine');
    expect(areaLine('atlas-c1')).toBe('Area: Cervical Spine (Neck)');
  });

  it('keeps the subregion only where it says something the area does not', () => {
    // 'Torso' and 'Spine' add information next to the area; 'Shoulder' would just repeat it.
    expect(areaLine('ribs')).toBe('Area: Thoracic Spine (Torso)');
    expect(areaLine('sacroiliac-joint')).toBe('Area: Hip (Spine)');
    expect(areaLine('deltoid')).toBe('Area: Shoulder');
  });
});
