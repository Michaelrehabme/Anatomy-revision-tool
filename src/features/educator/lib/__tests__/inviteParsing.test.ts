import { describe, it, expect } from 'vitest';
import { inviteId, normalizeEmail, parseEmailList } from '../../data/invitesRepository';

/**
 * Educators paste from wherever the register lives — a spreadsheet column, a
 * mail client's To: field, a Word table. The parser's job is to accept all of
 * it and to be loud about what it could not read, because a mistyped address
 * is a student who never hears about the class and never appears in the
 * dashboard, with nothing on screen to say so.
 */

describe('parseEmailList', () => {
  it('reads a spreadsheet column', () => {
    const { emails, invalid } = parseEmailList('a.okafor@uni.ac.uk\nb.shah@uni.ac.uk\nc.reid@uni.ac.uk');
    expect(emails).toEqual(['a.okafor@uni.ac.uk', 'b.shah@uni.ac.uk', 'c.reid@uni.ac.uk']);
    expect(invalid).toEqual([]);
  });

  it('reads a comma or semicolon separated list, as mail clients produce', () => {
    expect(parseEmailList('a@uni.ac.uk, b@uni.ac.uk; c@uni.ac.uk').emails).toEqual([
      'a@uni.ac.uk',
      'b@uni.ac.uk',
      'c@uni.ac.uk',
    ]);
  });

  it('reads "Name <address>" pasted from a To: field', () => {
    const { emails } = parseEmailList('Amara Okafor <a.okafor@uni.ac.uk>, Ben Shah <b.shah@uni.ac.uk>');
    expect(emails).toEqual(['a.okafor@uni.ac.uk', 'b.shah@uni.ac.uk']);
  });

  it('lowercases and trims, so a capitalised address still matches the student', () => {
    expect(parseEmailList('  A.Okafor@Uni.AC.UK  ').emails).toEqual(['a.okafor@uni.ac.uk']);
    expect(normalizeEmail(' B.Shah@Uni.ac.uk ')).toBe('b.shah@uni.ac.uk');
  });

  it('deduplicates, because the natural way to add three late enrolments is to paste the register again', () => {
    const { emails } = parseEmailList('a@uni.ac.uk, A@UNI.AC.UK, a@uni.ac.uk, b@uni.ac.uk');
    expect(emails).toEqual(['a@uni.ac.uk', 'b@uni.ac.uk']);
  });

  it('reports what it could not read instead of dropping it', () => {
    const { emails, invalid } = parseEmailList('a@uni.ac.uk\nnot-an-address\nb@uni.ac.uk\nfred@localhost');
    expect(emails).toEqual(['a@uni.ac.uk', 'b@uni.ac.uk']);
    expect(invalid).toEqual(['not-an-address', 'fred@localhost']);
  });

  it('accepts unusual but real institutional addresses', () => {
    const { emails, invalid } = parseEmailList(
      "o'brien+msk@st-georges.nhs.uk, a_b.c-d@sub.dept.uni.ac.uk",
    );
    expect(invalid).toEqual([]);
    expect(emails).toHaveLength(2);
  });

  it('returns nothing for empty or whitespace input', () => {
    expect(parseEmailList('   \n\n  ')).toEqual({ emails: [], invalid: [] });
  });
});

describe('inviteId', () => {
  it('is stable for the same person and class, so re-inviting updates one row', () => {
    expect(inviteId('A.Okafor@uni.ac.uk', 'cohort-1')).toBe(inviteId('a.okafor@uni.ac.uk', 'cohort-1'));
  });

  it('differs per class, so one person can be invited to two', () => {
    expect(inviteId('a@uni.ac.uk', 'cohort-1')).not.toBe(inviteId('a@uni.ac.uk', 'cohort-2'));
  });

  it('contains no character Firestore forbids in a document id', () => {
    const id = inviteId('a.b.c@uni.ac.uk', 'cohort-1');
    expect(id).not.toMatch(/[/]/);
    expect(id).not.toBe('.');
    expect(id).not.toBe('..');
    expect(id.length).toBeLessThan(1500);
  });
});
