import type { AssignmentTemplate, NewAssignmentTemplate } from '../lib/assignmentTemplates';

/**
 * Demo-mode stand-in for data/assignmentTemplatesRepository.ts (see that
 * file, and README "Educator demo mode"). Templates saved here live in memory
 * for the session so the save and delete affordances can be exercised.
 */
const DEMO_TEMPLATES: AssignmentTemplate[] = [
  {
    id: 'demo-template-1',
    title: 'Knee ligaments — locate',
    blurb: 'Saved by the demo educator',
    scope: { areas: ['knee'], category: 'ligament' },
    questionTypes: ['locate', 'mcq'],
    questionCount: 10,
    defaultTargetAccuracyPct: 70,
  },
];

export async function listTemplates(): Promise<AssignmentTemplate[]> {
  return [...DEMO_TEMPLATES].sort((a, b) => a.title.localeCompare(b.title));
}

export async function saveTemplate(_uid: string, input: NewAssignmentTemplate): Promise<AssignmentTemplate> {
  const template: AssignmentTemplate = { ...input, id: `demo-template-${DEMO_TEMPLATES.length + 1}` };
  DEMO_TEMPLATES.push(template);
  return template;
}

export async function deleteTemplate(_uid: string, id: string): Promise<void> {
  const at = DEMO_TEMPLATES.findIndex((t) => t.id === id);
  if (at >= 0) DEMO_TEMPLATES.splice(at, 1);
}
