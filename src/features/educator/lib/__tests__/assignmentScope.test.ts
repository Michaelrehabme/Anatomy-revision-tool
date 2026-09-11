import { describe, it, expect } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../../anatomy-revision/data/seed';
import { generateRevisionSet } from '../../../anatomy-revision/lib/questionGenerators/generateSet';
import { areaOf } from '../../../anatomy-revision/types/structure';
import { DEMO_ASSIGNMENTS } from '../../demo/demoData';
import { isScopedAssignment } from '../../types/cohort';
import { assignmentSetConfig, describeAssignmentScope } from '../assignmentScope';

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

describe('describeAssignmentScope', () => {
  it('leads with the muscle groups when there are any', () => {
    expect(describeAssignmentScope({ areas: ['hip'], category: 'muscle', groups: ['hip-flexors', 'hip-adductors'] })).toBe(
      'Hip flexors, Hip adductors · Hip',
    );
  });

  it('names the category and every area otherwise', () => {
    expect(describeAssignmentScope({ areas: ['shoulder', 'elbow'], category: 'bone' })).toBe('Bones · Shoulder, Elbow');
  });

  it('says "Everything" when no category is set', () => {
    expect(describeAssignmentScope({ areas: ['ankle-foot'] })).toBe('Everything · Ankle & Foot');
  });
});

/**
 * The demo assignments double as fixtures here: each narrows a different way,
 * and a demo assignment that built fewer questions than it claims, or asked
 * about a structure outside its scope, is exactly the bug a real one would have.
 */
describe('assignmentSetConfig', () => {
  const scoped = DEMO_ASSIGNMENTS.filter(isScopedAssignment);

  it.each(scoped.map((a) => [a.title, a] as const))('builds a full exam inside its scope: %s', (_title, assignment) => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, assignmentSetConfig(assignment));
    expect(questions).toHaveLength(assignment.questionCount);

    for (const q of questions) {
      expect(q.type).not.toBe('flashcard');
      expect(assignment.questionTypes).toContain(q.type);
      const structure = byId.get(q.structureId)!;
      expect(assignment.scope.areas).toContain(areaOf(structure));
      if (assignment.scope.category) expect(structure.category).toBe(assignment.scope.category);
      if (assignment.scope.groups) {
        expect((structure.groups ?? []).some((g) => assignment.scope.groups!.includes(g))).toBe(true);
      }
    }
  });
});
