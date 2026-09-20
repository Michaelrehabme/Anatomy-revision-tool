import { describe, it, expect } from 'vitest';
import { AREAS } from '../../../anatomy-revision/types/region';
import { BUILT_IN_TEMPLATES, applyTemplate, matchesTemplate, templateFromChoices } from '../assignmentTemplates';
import { previewAssignment, describeAssignmentScope } from '../assignmentScope';

describe('BUILT_IN_TEMPLATES', () => {
  it('ships one per area, in area order', () => {
    expect(BUILT_IN_TEMPLATES.map((t) => t.scope.areas)).toEqual(AREAS.map((a) => [a]));
    expect(new Set(BUILT_IN_TEMPLATES.map((t) => t.id)).size).toBe(AREAS.length);
  });

  it('can each build a full attempt from the real content', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      const { poolSize, available } = previewAssignment(template.scope, template.questionTypes);
      expect(poolSize, template.title).toBeGreaterThan(0);
      expect(available, template.title).toBeGreaterThanOrEqual(template.questionCount);
      expect(describeAssignmentScope(template.scope)).not.toBe('');
    }
  });
});

describe('applyTemplate', () => {
  it('produces an assignment the form would accept, from a date and a pass mark', () => {
    const template = BUILT_IN_TEMPLATES[0];
    const assignment = applyTemplate(template, {
      cohortId: 'cohort-1',
      createdBy: 'educator-1',
      dueAt: '2026-10-01T23:59:59.000Z',
      targetAccuracyPct: 80,
    });
    expect(assignment.title).toBe(template.title);
    expect(assignment.scope.areas.length).toBeGreaterThan(0);
    expect(assignment.questionTypes.length).toBeGreaterThan(0);
    expect(assignment.targetAccuracyPct).toBe(80);
    expect(assignment.questionCount).toBe(template.questionCount);
    // Firestore rejects undefined: an unset category or groups must be absent, not undefined.
    expect('category' in assignment.scope).toBe(false);
    expect('groups' in assignment.scope).toBe(false);
  });

  it('lets the educator rename it', () => {
    const assignment = applyTemplate(BUILT_IN_TEMPLATES[3], {
      cohortId: 'c',
      createdBy: 'e',
      dueAt: '2026-10-01T23:59:59.000Z',
      targetAccuracyPct: 70,
      title: '  Hip before the practical ',
    });
    expect(assignment.title).toBe('Hip before the practical');
  });
});

describe('templateFromChoices and matchesTemplate', () => {
  it('round-trips the form choices and recognises them', () => {
    const choices = {
      scope: { areas: ['knee', 'hip'] as const, category: 'ligament' as const },
      questionTypes: ['mcq', 'locate'] as const,
      questionCount: 30,
      targetAccuracyPct: 75,
    };
    const saved = templateFromChoices('Lower limb ligaments', {
      scope: { areas: [...choices.scope.areas], category: choices.scope.category },
      questionTypes: [...choices.questionTypes],
      questionCount: choices.questionCount,
      targetAccuracyPct: choices.targetAccuracyPct,
    });
    expect(saved.defaultTargetAccuracyPct).toBe(75);
    const template = { ...saved, id: 't1' };
    expect(
      matchesTemplate(template, {
        scope: { areas: ['hip', 'knee'], category: 'ligament' },
        questionTypes: ['locate', 'mcq'],
        questionCount: 30,
      }),
    ).toBe(true);
    expect(matchesTemplate(template, { scope: { areas: ['hip'] }, questionTypes: ['mcq'], questionCount: 30 })).toBe(false);
  });
});
