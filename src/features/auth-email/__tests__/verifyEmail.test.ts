import { describe, expect, it } from 'vitest';
import { decideVerificationSend, MAX_PER_DAY, MIN_GAP_MS } from '../verificationThrottle';
import { oobCodeFromLink, verifyEmailActionUrl, verifyEmailMessage, VERIFY_EMAIL_SUBJECT } from '../verifyEmailMessage';
import { webmailFor } from '../../anatomy-revision/lib/webmail';

describe('the confirmation email', () => {
  const link = verifyEmailActionUrl('https://locusmsk.co.uk', 'abc/123+x');
  const message = verifyEmailMessage({
    to: 'sam<script>@example.com',
    link,
    appOrigin: 'https://locusmsk.co.uk',
    from: 'LocusMSK <hello@locusmsk.co.uk>',
    replyTo: 'michael@rehabme.uk',
  });

  it('links to the app’s own page with the code, on the same domain as the sender', () => {
    expect(link).toBe('https://locusmsk.co.uk/auth/action?mode=verifyEmail&oobCode=abc%2F123%2Bx');
    expect(message.html).toContain('href="https://locusmsk.co.uk/auth/action?mode=verifyEmail&amp;oobCode=abc%2F123%2Bx"');
    expect(message.text).toContain(link);
    expect(message.from).toBe('LocusMSK <hello@locusmsk.co.uk>');
  });

  it('has a subject, a reply-to and a plain-text part', () => {
    expect(message.subject).toBe(VERIFY_EMAIL_SUBJECT);
    expect(message.reply_to).toBe('michael@rehabme.uk');
    expect(message.text).toMatch(/^Confirm your email/);
  });

  it('escapes the address in the HTML', () => {
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('sam&lt;script&gt;@example.com');
  });

  it('reads the code out of the link Firebase makes', () => {
    expect(oobCodeFromLink('https://x.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=Q1w2&apiKey=k&lang=en')).toBe('Q1w2');
    expect(oobCodeFromLink('https://x.firebaseapp.com/__/auth/action?mode=verifyEmail')).toBeNull();
    expect(oobCodeFromLink('not a url')).toBeNull();
  });
});

describe('how often the app sends it', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('sends the first one and records it', () => {
    expect(decideVerificationSend(undefined, now)).toEqual({ send: true, record: { sentAt: [now.toISOString()] } });
  });

  it('refuses two within the gap', () => {
    expect(decideVerificationSend({ sentAt: [ago(MIN_GAP_MS - 1000)] }, now)).toEqual({ send: false, reason: 'too-soon' });
    expect(decideVerificationSend({ sentAt: [ago(MIN_GAP_MS + 1000)] }, now).send).toBe(true);
  });

  it('refuses more than the day allows, and forgets sends older than a day', () => {
    const full = Array.from({ length: MAX_PER_DAY }, (_, i) => ago((i + 1) * 60 * 60 * 1000));
    expect(decideVerificationSend({ sentAt: full }, now)).toEqual({ send: false, reason: 'daily-limit' });
    const old = Array.from({ length: MAX_PER_DAY }, (_, i) => ago(25 * 60 * 60 * 1000 + i));
    const decided = decideVerificationSend({ sentAt: old }, now);
    expect(decided.send && decided.record.sentAt).toEqual([now.toISOString()]);
  });
});

describe('the “Open your inbox” button', () => {
  it('knows the common providers and university addresses', () => {
    expect(webmailFor('sam@gmail.com')?.name).toBe('Gmail');
    expect(webmailFor('sam@hotmail.co.uk')?.name).toBe('Outlook');
    expect(webmailFor('s.taylor@edu.salford.ac.uk')?.url).toBe('https://outlook.office.com/mail/');
    expect(webmailFor('sam@icloud.com')?.name).toBe('iCloud Mail');
    expect(webmailFor('sam@example.com')).toBeNull();
  });
});
