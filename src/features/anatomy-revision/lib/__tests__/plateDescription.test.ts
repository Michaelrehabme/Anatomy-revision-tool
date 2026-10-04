import { beforeAll, describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { attachHotspots } from '../../data/seed/hotspots';
import { describePlate, gridPosition, pictureDirection, plateFamily, type PlateFamily } from '../plateDescription';
import { plateLabel } from '../plateLabel';

/**
 * The long descriptions are written by a function, so what is pinned here is
 * the function's promises rather than 5,000 paragraphs: every picture gets a
 * description, an open question's description does not answer it, and what it
 * says about a structure is what the seed says.
 */

const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
const structuresById = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const text = (id: string, subjectId?: string, conceal?: 'name' | 'place') =>
  describePlate({ image: imagesById.get(id)!, subjectId, conceal, imagesById, structuresById });

/** The structure a picture is about: its own, or the one its id is named after. */
function subjectOf(id: string): string | undefined {
  const own = imagesById.get(id)?.structureId;
  if (own) return own;
  const named = /^(?:muscle|ligament)-(.+)-a\d{3}(?:[ud]\d{3})?-(?:context|highlight)$/.exec(id)?.[1];
  return named && structuresById.has(named) ? named : undefined;
}

beforeAll(async () => {
  await attachHotspots();
});

describe('gridPosition and pictureDirection', () => {
  it('places a point on a three-by-three grid of the picture', () => {
    expect(gridPosition([0.5, 0.5])).toBe('at the centre of the picture');
    expect(gridPosition([0.1, 0.1])).toBe('in the upper left of the picture');
    expect(gridPosition([0.9, 0.5])).toBe('on the right of the picture, halfway up');
    expect(gridPosition([0.5, 0.9])).toBe('in the lower middle of the picture');
  });

  it('speaks in left and right of the picture, never medial or lateral', () => {
    expect(pictureDirection([0.5, 0.5], [0.1, 0.5])).toBe('to its left');
    expect(pictureDirection([0.5, 0.5], [0.5, 0.9])).toBe('below it');
    expect(pictureDirection([0.5, 0.5], [0.8, 0.2])).toBe('above it and to the right');
  });
});

describe('describePlate', () => {
  it('describes every picture in the seed', () => {
    const families = new Set<PlateFamily>();
    for (const image of ALL_IMAGES) {
      families.add(plateFamily(image));
      const described = describePlate({ image, imagesById, structuresById });
      expect(described.length, image.id).toBeGreaterThan(60);
      expect(described, image.id).not.toMatch(/undefined|null|NaN|\[object/);
    }
    // A family the generator does not recognise would be described as "other".
    expect([...families].sort()).toEqual(
      ['bone', 'joint', 'landmark', 'ligament-context', 'ligament-highlight', 'muscle-context', 'muscle-highlight', 'panel', 'subregion'],
    );
  });

  it('says what view it is, what is highlighted, where it lies and what is beside it', () => {
    const described = text('muscle-deltoid-a000-highlight', 'deltoid');
    expect(described).toContain('Anterior view of the shoulder.');
    expect(described).toContain('One muscle is picked out in bright cyan');
    expect(described).toContain('Deltoid is the structure in cyan. It lies at the centre of the picture, covering about 14% of it.');
    expect(described).toContain('Pectoralis Major is below it and to the left');
    // Straight from the seed's origin and insertion, not paraphrased.
    expect(described).toContain('Origin: Lateral 1/3 clavicle; Acromion; Spine of scapula.');
    expect(described).toContain('Insertion: Deltoid tuberosity of humerus.');
  });

  it('reads the neighbours of a highlight plate from its context twin, which is the same camera', () => {
    expect(imagesById.get('muscle-deltoid-a000-highlight')!.hotspots ?? []).toHaveLength(0);
    expect(text('muscle-deltoid-a000-highlight', 'deltoid')).toContain('Also in frame: Pectoralis Major');
  });

  it('gives the degrees for a frame that shares its view name with another', () => {
    expect(text('muscle-supraspinatus-a180-highlight', 'supraspinatus')).toContain(
      'Posterior view of the shoulder, the camera 180° round from the front.',
    );
  });

  it('states the attachments and joint of a ligament, and the bone of a landmark', () => {
    const ligament = text('ligament-coracohumeral-ligament-a000-context', 'coracohumeral-ligament');
    expect(ligament).toContain('It attaches to the humerus and scapula.');
    expect(ligament).toContain('It belongs to the Glenohumeral Joint.');
    expect(text('landmark-acromion-anterior')).toContain('It is part of the scapula.');
    expect(text('joint-glenohumeral-joint-a000-plate')).toContain(
      'It is a ball-and-socket joint formed by the humerus and glenoid cavity.',
    );
  });

  it('never states an attachment nobody has reviewed', () => {
    const unreviewed = ALL_STRUCTURES.filter((s) => s.category === 'ligament' && s.needsReview);
    for (const ligament of unreviewed) {
      const image = ALL_IMAGES.find((i) => subjectOf(i.id) === ligament.id);
      if (!image) continue;
      expect(describePlate({ image, subjectId: ligament.id, imagesById, structuresById }), ligament.id).not.toContain('It attaches to');
    }
  });

  it('does not claim a view for a card panel, whose seed view is nominal', () => {
    const described = text('panel-clavicle');
    expect(described).toContain('shown from more than one side');
    expect(described).not.toMatch(/posterior view/i);
    expect(described).toContain('Clavicle is picked out in blue.');
  });
});

describe('an open question is not answered by the description of its picture', () => {
  it('identify: neither the name nor the description names the structure, or anything else in frame', () => {
    let checked = 0;
    for (const image of ALL_IMAGES) {
      const subjectId = subjectOf(image.id);
      if (!subjectId) continue;
      checked++;
      const described = describePlate({ image, subjectId, conceal: 'name', imagesById, structuresById });
      const label = plateLabel(image, 'name');
      for (const h of [{ structureId: subjectId }, ...(image.hotspots ?? [])]) {
        const name = structuresById.get(h.structureId)?.name;
        if (!name) continue;
        expect(described, image.id).not.toContain(name);
        expect(label, image.id).not.toContain(name);
      }
      expect(described, image.id).toContain('a full description is given once you have answered');
    }
    expect(checked).toBeGreaterThan(4000);
  });

  it('locate: lists what is in frame, and says where none of it is', () => {
    for (const image of ALL_IMAGES) {
      if ((image.hotspots ?? []).length === 0) continue;
      const subjectId = subjectOf(image.id) ?? image.hotspots![0].structureId;
      const described = describePlate({ image, subjectId, conceal: 'place', imagesById, structuresById });
      expect(described, image.id).not.toMatch(/of the picture|to its (left|right)|above it|below it|covering about|It lies/);
      expect(described, image.id).toContain('In frame:');
    }
  });

  it('keeps the title as the name on a locate picture, where the prompt has already said it', () => {
    const image = imagesById.get('landmark-acromion-anterior')!;
    expect(plateLabel(image, 'place')).toBe('Acromion — Anterior View');
    expect(plateLabel(image, 'name')).toBe('Anatomy image — anterior view');
    expect(plateLabel(image)).toBe('Acromion — Anterior View');
  });
});
