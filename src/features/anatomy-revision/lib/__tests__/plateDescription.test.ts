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
      ['bone', 'gap', 'joint', 'landmark', 'ligament-context', 'ligament-highlight', 'muscle-context', 'muscle-highlight', 'panel', 'subregion'],
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
      // A gap plate counts its gaps and names none: there the names ARE the
      // answer (see 'second renders, gap plates and views from above', below).
      expect(described, image.id).toContain(plateFamily(image) === 'gap' ? 'gaps between the bones can be chosen' : 'In frame:');
    }
  });

  it('keeps the title as the name on a locate picture, where the prompt has already said it', () => {
    const image = imagesById.get('landmark-acromion-anterior')!;
    expect(plateLabel(image, 'place')).toBe('Acromion — Anterior View');
    expect(plateLabel(image, 'name')).toBe('Anatomy image — anterior view');
    expect(plateLabel(image)).toBe('Acromion — Anterior View');
  });
});

/**
 * The families that arrived with the buried ligaments (types/image.ts,
 * ImageVariant; the gap plates in images.seed.ts), which the generator was
 * written before. Pinned here because each is a way for a description to be
 * wrong that the older families did not have.
 */
describe('second renders, gap plates and views from above', () => {
  const gapPlates = ALL_IMAGES.filter((i) => i.filePath.startsWith('/anatomy/gaps/'));
  const withVariant = ALL_IMAGES.filter((i) => i.variant);

  it('has the pictures these tests are about', () => {
    expect(gapPlates.length).toBeGreaterThan(0);
    expect(gapPlates.every((i) => plateFamily(i) === 'gap' && (i.hotspots ?? []).length > 0)).toBe(true);
    expect(new Set(withVariant.map((i) => i.variant!.kind))).toEqual(new Set(['hidden', 'solid']));
  });

  it('gap plate, question open: names neither the gap asked for, nor any other, nor a bone either side of one', () => {
    for (const image of gapPlates) {
      for (const asked of image.hotspots!) {
        for (const conceal of ['place', 'name'] as const) {
          const described = describePlate({ image, subjectId: asked.structureId, conceal, imagesById, structuresById });
          expect(described, image.id).toContain('a full description is given once you have answered');
          expect(described, image.id).not.toMatch(/of the picture|to its (left|right)|above it|below it|covering about|It lies|attaches/);
          for (const h of image.hotspots!) {
            const ligament = structuresById.get(h.structureId)!;
            expect(described, image.id).not.toContain(ligament.name);
            if (ligament.category !== 'ligament') continue;
            for (const boneId of ligament.attachmentStructureIds) {
              const bone = structuresById.get(boneId)?.name;
              if (bone) expect(described.toLowerCase(), `${image.id} ${bone}`).not.toContain(bone.toLowerCase());
            }
          }
        }
      }
    }
  });

  it('gap plate: says it is bones only and how many gaps there are; once answered, says which gap and what it joins', () => {
    const image = imagesById.get('gap-carpal-gaps-a000-plate')!;
    const open = describePlate({ image, subjectId: 'scapholunate-interosseous-ligament', conceal: 'place', imagesById, structuresById });
    expect(open).toContain('Anterior view of the wrist and hand.');
    expect(open).toContain('Only the bones are drawn');
    expect(open).toContain(`${image.hotspots!.length} gaps between the bones can be chosen in this view.`);
    const answered = describePlate({ image, subjectId: 'scapholunate-interosseous-ligament', imagesById, structuresById });
    expect(answered).toContain('Scapholunate interosseous ligament is not drawn: it lies in the gap between two bones');
    expect(answered).toContain('It attaches to the scaphoid and lunate.');
    expect(answered).toContain('Also in frame: ');
  });

  it('a frame with a second render says there are two and what differs, and never which one is showing', () => {
    for (const image of withVariant) {
      const subjectId = subjectOf(image.id);
      for (const conceal of [undefined, 'name', 'place'] as const) {
        const described = describePlate({ image, subjectId, conceal, imagesById, structuresById });
        const [first, second] = image.variant!.kind === 'hidden' ? ['ghosted', 'hidden'] : ['see-through', 'solid'];
        expect(described, image.id).toContain(`with the ${image.variant!.subject.toLowerCase()} ${first} and with`);
        expect(described, image.id).toContain(`${second}; the switch under the picture chooses between the two.`);
        expect(described, image.id).not.toMatch(/is showing|currently|now shown|switched/);
      }
    }
    expect(text('ligament-anterior-cruciate-ligament-a000-highlight', 'anterior-cruciate-ligament')).not.toContain('rendered twice');
  });

  it('the word the switch is named after is not the answer to any picture it appears on', () => {
    for (const image of withVariant) {
      const subject = structuresById.get(subjectOf(image.id) ?? '');
      expect(subject, image.id).toBeDefined();
      expect(subject!.name.toLowerCase(), image.id).not.toContain(image.variant!.subject.toLowerCase());
    }
  });

  it('a view from above says so in the description and in the concealed name, so it is not mistaken for the level frame', () => {
    const tilted = ALL_IMAGES.filter((i) => /-a\d{3}u\d{3}-/.test(i.id));
    expect(tilted.length).toBeGreaterThan(0);
    for (const image of tilted) {
      expect(describePlate({ image, imagesById, structuresById }), image.id).toMatch(/\d+° above the horizontal/);
      expect(plateLabel(image, 'name'), image.id).toMatch(/, from \d+° above$/);
    }
    const above = imagesById.get('ligament-anterior-meniscotibial-ligament-lateral-meniscus-a000u045-highlight')!;
    expect(plateLabel(above, 'name')).toBe('Anatomy image — anterior view, from 45° above');
  });

  it('describes each buried ligament by name once answered, and not before', () => {
    const buried = [...new Set(withVariant.map((i) => subjectOf(i.id)!))];
    expect(buried.length).toBeGreaterThanOrEqual(7);
    for (const id of buried) {
      const image = ALL_IMAGES.find((i) => subjectOf(i.id) === id && i.id.endsWith('-highlight'))!;
      const name = structuresById.get(id)!.name;
      expect(describePlate({ image, subjectId: id, imagesById, structuresById })).toContain(`${name} is the structure in cyan.`);
      expect(describePlate({ image, subjectId: id, conceal: 'name', imagesById, structuresById })).not.toContain(name);
    }
  });
});
