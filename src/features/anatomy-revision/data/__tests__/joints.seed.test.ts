import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES } from '../seed';
import { isJoint, isLandmark, areaOf } from '../../types/structure';
import { AREAS, AREA_LABELS } from '../../types/region';

/**
 * Seed-integrity checks for the joint dataset (CR-017). These guard the two things
 * the type system can't: that every area the UI offers actually has joint content,
 * and that the landmark -> joint migration stayed complete and id-stable.
 */
describe('joint seed data', () => {
  const joints = ALL_STRUCTURES.filter(isJoint);

  it('has at least one joint in every area offered in the picker', () => {
    // An empty area is a dead end in the picker: the user selects it and the session
    // generates zero questions.
    for (const area of AREAS) {
      const count = joints.filter((j) => areaOf(j) === area).length;
      expect(count, `no joints in ${AREA_LABELS[area]}`).toBeGreaterThan(0);
    }
  });

  it('no longer models an actual joint as a landmark', () => {
    // Six entries were `category: 'landmark'` before CR-017, which meant no joint generator
    // ever saw them. Keyed on the *name*, not on `groups: [..., 'joint']` — plenty of
    // landmarks are legitimately tagged 'joint' because they are articular surfaces that
    // form one (glenoid cavity, acetabulum, trochlear notch, the costal facets). Being
    // named "<Something> Joint" is what marks a structure as the joint itself.
    const jointsModelledAsLandmarks = ALL_STRUCTURES.filter(
      (s) => isLandmark(s) && /\bjoint$/i.test(s.name),
    );
    expect(jointsModelledAsLandmarks.map((s) => s.id)).toEqual([]);
  });

  it('preserves the ids of the six migrated joints, which user progress is keyed on', () => {
    const migrated = [
      'sacroiliac-joint',
      'facet-joint',
      'costovertebral-joint',
      'distal-radioulnar-joint',
      'carpometacarpal-joint-thumb',
      'proximal-tibiofibular-joint',
    ];
    for (const id of migrated) {
      const structure = ALL_STRUCTURES.find((s) => s.id === id);
      expect(structure, `${id} should still exist after the landmark -> joint migration`).toBeDefined();
      expect(structure?.category).toBe('joint');
    }
  });

  it('covers every joint classification, including the non-synovial ones', () => {
    const types = new Set(joints.map((j) => j.jointType));
    // Condyloid had no shoulder-arm representative in the CR-014 pilot; symphysis and
    // syndesmosis did not exist as types at all until the roster needed them.
    expect(types).toContain('condyloid');
    expect(types).toContain('symphysis');
    expect(types).toContain('syndesmosis');
  });

  it('gives every joint at least one movement', () => {
    for (const joint of joints) {
      expect(joint.movements.length, `${joint.id} has no movements`).toBeGreaterThan(0);
    }
  });
});
