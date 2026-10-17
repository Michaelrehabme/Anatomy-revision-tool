import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { buildLocateQuestions } from '../questionGenerators/locate';
import { rotationAngle } from '../rotationFrames';

/**
 * The owner's opening views (data/openingViews.ts, 17 Oct 2026): the
 * intervertebral joint opens from the side, on the lumbar spine with nothing
 * in front of it, and the facet joint from behind.
 */
describe('a tap question opens on the view a student expects', () => {
  const locate = buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES);
  const of = (id: string) => locate.filter((q) => q.targetStructureId === id);

  it('opens the intervertebral joint from the side, and never shows it from behind', () => {
    const [q] = of('intervertebral-joint');
    expect(of('intervertebral-joint')).toHaveLength(1);
    expect(rotationAngle(q.imageId)).toBe(90);
    const angles = (q.frameImageIds ?? [q.imageId]).map(rotationAngle);
    for (const angle of angles) expect([120, 150, 180, 210, 240]).not.toContain(angle);
  });

  it('opens the facet joint from behind', () => {
    const [q] = of('facet-joint');
    expect(rotationAngle(q.imageId)).toBe(180);
  });
});
