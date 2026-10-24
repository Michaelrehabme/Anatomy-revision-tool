import { describe, expect, it } from 'vitest';
import { reportEmail } from '../data/reportEmail';
import type { QuestionReport } from '../data/rows';

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

describe('reportEmail', () => {
  it('says what was reported, by whom, and where to resolve it', () => {
    const { subject, text } = reportEmail(report);
    expect(subject).toBe('Report: flexor-hallucis-longus — My answer should have counted');
    expect(text).toContain('"hallux is the big toe"');
    expect(text).toContain('Question id: oina-flexor-hallucis-longus-insertion-typed');
    expect(text).toContain('Area: ankle-foot');
    expect(text).toContain('/admin/feedback');
  });

  it('leaves out an empty note', () => {
    expect(reportEmail({ ...report, note: '  ' }).text).not.toContain('""');
  });
});
