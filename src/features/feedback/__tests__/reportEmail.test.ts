import { describe, expect, it } from 'vitest';
import { reportEmail } from '../data/reportEmail';
import type { QuestionReport } from '../data/rows';
import { questionShown } from '../data/questionShown';
import type { MCQQuestion } from '../../anatomy-revision/types/question';

const report: QuestionReport = {
  userId: 'u1',
  questionId: 'oina-flexor-hallucis-longus-insertion-typed',
  structureId: 'flexor-hallucis-longus',
  questionType: 'oina',
  promptKind: 'insertion',
  area: 'ankle-foot',
  reason: 'my-answer-right',
  note: 'hallux is the big toe',
  build: 'b1',
  createdAt: '2026-10-22T16:47:00.000Z',
};

const mcq: MCQQuestion = {
  id: 'q-acl',
  type: 'mcq',
  structureId: 'anterior-cruciate-ligament',
  promptKind: 'identify',
  prompt: 'What ligament is this?',
  promptLines: ['Femur: lateral condyle, inner surface', 'Tibia: anterior intercondylar area'],
  choices: ['Posterior cruciate ligament', 'Anterior cruciate ligament', 'Patellar ligament'],
  correctIndex: 1,
  promptImageId: 'redraw-x',
  explanation: '',
} as MCQQuestion;

const withShown: QuestionReport = {
  ...report,
  questionId: 'q-acl',
  structureId: 'anterior-cruciate-ligament',
  questionType: 'mcq',
  reason: 'wrong-answer',
  shown: questionShown(mcq, { subject: 'Anterior cruciate ligament', given: 'Posterior cruciate ligament', picture: () => '/anatomy/redraws/x.webp' }),
};

describe('reportEmail', () => {
  it('says what was reported, by whom, and where to resolve it', () => {
    const { subject, text, html } = reportEmail(report);
    expect(subject).toBe('Report: Flexor hallucis longus — My answer should have counted');
    expect(text).toContain('"hallux is the big toe"');
    expect(text).toContain('oina-flexor-hallucis-longus-insertion-typed');
    expect(text).toContain('Ankle & Foot');
    expect(text).toContain('/admin/feedback');
    expect(html).toContain('/admin/feedback');
    expect(html).toContain('&ldquo;hallux is the big toe&rdquo;');
  });

  it('leaves out an empty note', () => {
    const { text, html } = reportEmail({ ...report, note: '  ' });
    expect(text).not.toContain('""');
    expect(html).not.toContain('&ldquo;');
  });

  it('names the student when the account is known, first name in the subject', () => {
    const { subject, text } = reportEmail(report, { name: 'Sam Patel', email: 'sam@example.com' });
    expect(subject).toBe('Sam reported Flexor hallucis longus — My answer should have counted');
    expect(text).toContain('From Sam Patel (sam@example.com)');
  });

  it('shows the question as the student saw it: prompt, lines, picture, choices, right and theirs', () => {
    const { text, html } = reportEmail(withShown);
    expect(text).toContain('What ligament is this?');
    expect(text).toContain('• Femur: lateral condyle, inner surface');
    expect(text).toContain('✓ Anterior cruciate ligament');
    expect(text).toContain('Posterior cruciate ligament   ← their answer');
    expect(html).toContain('src="https://locusmsk.co.uk/anatomy/redraws/x.webp"');
    expect(html).toContain('their answer');
    expect(html).toContain('<li>Tibia: anterior intercondylar area</li>');
  });

  it('escapes what a student typed', () => {
    const { html } = reportEmail({ ...report, note: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
