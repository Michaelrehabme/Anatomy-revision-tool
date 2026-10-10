import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DIAGNOSTIC_SECTION_ID, PUBLIC_FIGURE_MIN_STUDENTS, PrivacyPage } from '../PrivacyPage';
import { DIAGNOSTIC_SIZE, MIN_PAIRED } from '../../anatomy-revision/lib/diagnostic';
import { DIAGNOSTIC_PRIVACY_HREF, promptCopy } from '../../anatomy-revision/lib/diagnosticPrompt';

/**
 * The privacy policy on the before-and-after test (11 October 2026).
 *
 * docs/CLAIMS.md will not let a class's figure be quoted in public unless its
 * students were told, before the baseline, that a class-level figure may be
 * reported outside their course. Until this section existed /privacy did not
 * mention the test at all. What is pinned here is that each sentence still
 * matches the thing it describes: the stored record, the permission rules,
 * the floors in the code and in CLAIMS.md, and the deletion route.
 */

function renderPage() {
  const { container } = render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
  const section = container.querySelector(`#${DIAGNOSTIC_SECTION_ID}`);
  return { page: container.textContent ?? '', section: (section?.textContent ?? '').replace(/\s+/g, ' ') };
}

const source = (path: string) => readFileSync(path, 'utf8');

describe('PrivacyPage', () => {
  it('carries the date it was last revised', () => {
    renderPage();
    expect(screen.getByText('Last updated 11 October 2026')).toBeTruthy();
  });

  it('has a section on the test, where the cards link to', () => {
    const { section } = renderPage();
    expect(screen.getByRole('heading', { name: 'The before-and-after test' })).toBeTruthy();
    expect(section.length).toBeGreaterThan(500);
    expect(DIAGNOSTIC_PRIVACY_HREF).toBe(`/privacy#${DIAGNOSTIC_SECTION_ID}`);
  });

  it('says it is optional and counts for nothing', () => {
    const { section } = renderPage();
    expect(section).toContain(`${DIAGNOSTIC_SIZE} questions soon after you join`);
    expect(section).toContain('Sitting it is your choice');
    expect(section).toContain('nothing happens if you skip it');
  });

  // The stored record is a score. If a sitting ever starts keeping the answer
  // to each question, the sentence that says it does not is false.
  it('says what a sitting keeps, and that is what a sitting keeps', () => {
    const { section } = renderPage();
    expect(section).toContain(
      `your score out of ${DIAGNOSTIC_SIZE}, which paper you sat and which questions were on it, the date, how long you took, and the class you were in`,
    );
    expect(section).toContain('The answer you gave to each question is not kept');

    const model = source('src/features/anatomy-revision/lib/diagnostic.ts');
    const record = model.slice(model.indexOf('export interface DiagnosticResult {'), model.indexOf('export function sameQuestions'));
    const fields = [...record.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]).sort();
    expect(fields).toEqual(['cohortId', 'correct', 'durationMs', 'paperId', 'phase', 'questionIds', 'takenAt', 'total', 'userId', 'version']);
  });

  // "Your course leader cannot" is a claim about firestore.rules, not about a screen.
  it('says who can see a score, as the permission rules have it', () => {
    const { section } = renderPage();
    expect(section).toContain('The person who runs LocusMSK can');
    expect(section).toContain('Your course leader cannot, and neither can anyone else in your class');

    const rules = source('firestore.rules');
    const opening = 'match /{sub}/{document=**} {';
    expect(rules).toContain(opening);
    const block = rules.slice(rules.indexOf(opening) + opening.length);
    const allows = block.slice(0, block.indexOf('}')).split('\n').filter((line) => line.trim().startsWith('allow'));
    expect(allows.map((line) => line.trim())).toEqual([
      'allow read, write: if isSignedIn() && request.auth.uid == uid;',
      'allow read: if isAdmin();',
    ]);
  });

  it('quotes the floor for a class figure from the code', () => {
    const { section } = renderPage();
    expect(MIN_PAIRED).toBe(8);
    expect(section).toContain(`No figure is given unless at least ${MIN_PAIRED} students in the class sat both tests on the same paper`);
    expect(section).toContain("Never a name, and never one student’s score");
    // The report says the same to whoever runs it.
    expect(source('src/features/anatomy-revision/lib/diagnosticReport.ts')).toContain('Not for the course lead either');
  });

  it('says a class figure may be used outside the course, on the conditions CLAIMS.md sets', () => {
    const { section } = renderPage();
    expect(section).toContain('may also be used outside the course');
    expect(section).toContain(`at least ${PUBLIC_FIGURE_MIN_STUDENTS} students sat both tests`);
    expect(section).toContain('only with your course leader’s written agreement');
    expect(section).toContain('are not named without their permission');

    const claims = source('docs/CLAIMS.md').replace(/\s+/g, ' ');
    expect(claims).toContain(`At least ${PUBLIC_FIGURE_MIN_STUDENTS} students with both sittings`);
    expect(claims).toContain('The owner, and the course lead of that class, both in writing');
    expect(claims).toContain('named only with the course lead’s written permission'.replace('’', "'"));
    // Nothing causal: the page describes a change in scores, never an effect.
    expect(section).not.toMatch(/improve|effective|works|proves|because of the app/i);
  });

  it('says how the scores are deleted, and the account deletion does delete them', () => {
    const { section } = renderPage();
    expect(section).toContain('Delete my account removes them with everything else');
    expect(section).toContain('If you leave the class, you are left out of any class figure worked out after that');
    expect(section).toContain('email michael@rehabme.uk');

    const lifecycle = source('src/features/anatomy-revision/data/accountLifecycle.ts');
    const list = lifecycle.slice(lifecycle.indexOf('const USER_SUBCOLLECTIONS = ['), lifecycle.indexOf('] as const;', lifecycle.indexOf('const USER_SUBCOLLECTIONS = [')));
    expect(list).toContain("'diagnostics'");
    // The class figure is added up over the class's members as they are when the report runs.
    expect(source('scripts/cohortReport.ts')).toContain(".where('cohort', '==', cohortId)");
  });

  // Which basis covers the class figure has not been decided. Until it is,
  // the section states none rather than one somebody guessed.
  it('does not invent a lawful basis for the test', () => {
    const { section, page } = renderPage();
    expect(section).not.toMatch(/lawful basis|legitimate interests|consent|contract/i);
    expect(page.match(/Lawful basis:/g)).toHaveLength(3);
  });

  it('is what the cards say too: the figure may leave the course', () => {
    for (const phase of ['baseline', 'followUp'] as const) {
      const { body } = promptCopy(phase);
      expect(body).toContain('never sees your score');
      expect(body).toContain('outside your course');
      expect(body).toContain('no names');
      expect(body).not.toContain('only that figure may be shared with your course leader');
    }
  });
});
