import { describe, expect, it } from 'vitest';
import { shouldSendStudyReminder, studyReminderMessage } from '../studyReminder';
import { unsubscribeToken, unsubscribeTokenIsValid } from '../../../../netlify/functions/lib/unsubscribeToken';

/** The weekly study reminder (16 October 2026): opt-in only, never empty, never twice a week, always stoppable. */

const NOW = new Date('2026-10-19T07:00:00.000Z');

describe('who gets the weekly reminder', () => {
  it('only a student who ticked the box, and only when something is due', () => {
    expect(shouldSendStudyReminder(undefined, 5, NOW)).toBe(false);
    expect(shouldSendStudyReminder({ weekly: false }, 5, NOW)).toBe(false);
    expect(shouldSendStudyReminder({ weekly: true }, 0, NOW)).toBe(false);
    expect(shouldSendStudyReminder({ weekly: true }, 5, NOW)).toBe(true);
  });

  it('not twice in the same week, if the run is repeated', () => {
    expect(shouldSendStudyReminder({ weekly: true, lastSentAt: '2026-10-19T06:00:00.000Z' }, 5, NOW)).toBe(false);
    expect(shouldSendStudyReminder({ weekly: true, lastSentAt: '2026-10-12T07:00:00.000Z' }, 5, NOW)).toBe(true);
  });
});

describe('the email', () => {
  const message = studyReminderMessage({
    to: 'sam@uni.ac.uk',
    dueCount: 12,
    appUrl: 'https://locusmsk.co.uk/',
    unsubscribeUrl: 'https://locusmsk.co.uk/.netlify/functions/study-reminders-unsubscribe?u=abc&t=xyz',
    from: 'LocusMSK <hello@locusmsk.co.uk>',
    replyTo: 'michael@rehabme.uk',
  });

  it('says how much is due, and how to stop the emails, in both versions', () => {
    expect(message.subject).toBe('12 structures are due for review');
    for (const body of [message.text, message.html]) {
      expect(body).toContain('12 structures are due');
      expect(body).toContain('Stop these emails');
      expect(body).toContain('study-reminders-unsubscribe?u=abc');
    }
    expect(message.headers['List-Unsubscribe']).toBe('<https://locusmsk.co.uk/.netlify/functions/study-reminders-unsubscribe?u=abc&t=xyz>');
    expect(message.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('reads right for a single structure', () => {
    expect(studyReminderMessage({ ...{ to: 'a', appUrl: 'x', unsubscribeUrl: 'y', from: 'f', replyTo: 'r' }, dueCount: 1 }).subject).toBe(
      '1 structure is due for review',
    );
  });
});

describe('the unsubscribe link', () => {
  it('works for its own account and no other, and not without a secret', () => {
    const token = unsubscribeToken('student-a', 'secret')!;
    expect(unsubscribeTokenIsValid('student-a', token, 'secret')).toBe(true);
    expect(unsubscribeTokenIsValid('student-b', token, 'secret')).toBe(false);
    expect(unsubscribeTokenIsValid('student-a', token, 'other-secret')).toBe(false);
    expect(unsubscribeTokenIsValid('student-a', '', 'secret')).toBe(false);
    expect(unsubscribeToken('student-a', null)).toBeNull();
  });
});
