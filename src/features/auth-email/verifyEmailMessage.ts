/**
 * The "Confirm your email" message a new account is sent, and the address its
 * link leads to. Pure, so the function that sends it
 * (netlify/functions/send-verification-email.ts) and the tests share it.
 *
 * WHY THE APP SENDS IT AND NOT FIREBASE. Firebase's own email comes from an
 * address on firebaseapp.com and links to a page on firebaseapp.com: a sender
 * that is not the site the student signed up on, and a link to yet another
 * domain, which is what spam filters look for. This one comes from
 * hello@locusmsk.co.uk through Resend (the same sender as every other email
 * the app sends) and links to locusmsk.co.uk/auth/action, where the app's own
 * page confirms the address (components/Auth/EmailActionPage.tsx).
 *
 * DARK, like the app at night and its marketing. Every colour is a literal
 * from index.css's dark scope, because email clients read no stylesheet
 * variables. The fonts are named and fall back to system faces in clients
 * that do not load web fonts.
 */

export interface VerifyEmailMessage {
  from: string;
  to: string;
  reply_to: string;
  subject: string;
  text: string;
  html: string;
}

export const VERIFY_EMAIL_SUBJECT = 'Confirm your email for LocusMSK';

/** The path of the app's own page for links from account emails. */
export const EMAIL_ACTION_PATH = '/auth/action';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The one-time code out of the link Firebase generates
 * (`…/__/auth/action?mode=verifyEmail&oobCode=…`), or null if it has none.
 */
export function oobCodeFromLink(link: string): string | null {
  try {
    return new URL(link).searchParams.get('oobCode') || null;
  } catch {
    return null;
  }
}

/** The link the email carries: the app's own page, on `origin`, with the code. */
export function verifyEmailActionUrl(origin: string, oobCode: string): string {
  const url = new URL(EMAIL_ACTION_PATH, origin);
  url.searchParams.set('mode', 'verifyEmail');
  url.searchParams.set('oobCode', oobCode);
  return url.toString();
}

const DISPLAY = "'Bricolage Grotesque','Segoe UI',Helvetica,Arial,sans-serif";
const UI = "'Hanken Grotesk','Segoe UI',Helvetica,Arial,sans-serif";

export function verifyEmailMessage(input: {
  to: string;
  link: string;
  appOrigin: string;
  from: string;
  replyTo: string;
}): VerifyEmailMessage {
  const to = escapeHtml(input.to);
  const link = escapeHtml(input.link);
  const site = escapeHtml(input.appOrigin);
  const siteName = escapeHtml(new URL(input.appOrigin).host);

  const text = [
    'Confirm your email',
    '',
    `Open this link to confirm ${input.to} and choose your free area on LocusMSK:`,
    input.link,
    '',
    'You are getting this because this address was used to create a LocusMSK account.',
    'If that was not you, ignore this email and nothing will happen.',
    '',
    'Questions? Reply to this email and Michael will get back to you.',
    input.appOrigin,
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(VERIFY_EMAIL_SUBJECT)}</title>
<style>
body{margin:0;padding:0;background:#121927}
a{color:#86d2c9}
@media (max-width:620px){.card{padding:32px 24px !important}.h1{font-size:30px !important}}
</style>
</head>
<body style="margin:0;padding:0;background:#121927;">
<div style="display:none;max-height:0;overflow:hidden;">One tap to confirm your address and open your free area.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121927;">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:0 4px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;"><img src="${site}/icons/icon-192.png" width="36" height="36" alt="" style="display:block;border-radius:9px;border:1px solid #39414f;"></td>
        <td style="vertical-align:middle;padding-left:12px;font-family:${DISPLAY};font-size:20px;font-weight:600;letter-spacing:-.01em;color:#f3eee2;">LocusMSK</td>
      </tr></table>
    </td></tr>
    <tr><td class="card" style="background:#1c2537;border:1px solid #39414f;border-radius:6px;padding:44px 44px 40px;">
      <p style="margin:0 0 16px;font-family:${UI};font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#86d2c9;">One thing first</p>
      <h1 class="h1" style="margin:0 0 16px;font-family:${DISPLAY};font-size:36px;line-height:1.05;font-weight:500;letter-spacing:-.02em;color:#f3eee2;">Confirm your email</h1>
      <p style="margin:0 0 28px;font-family:${UI};font-size:16px;line-height:1.6;color:#c5cbd6;">Press the button to confirm <strong style="color:#f3eee2;font-weight:600;">${to}</strong> and choose your free area. It takes one tap.</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:4px;background:#63beb5;">
        <a href="${link}" style="display:inline-block;padding:16px 30px;font-family:${UI};font-size:16px;font-weight:600;color:#0e1524;text-decoration:none;border-radius:4px;">Confirm my email</a>
      </td></tr></table>
      <p style="margin:28px 0 6px;font-family:${UI};font-size:13px;line-height:1.55;color:#9ba4b5;">Button not working? Paste this into your browser:</p>
      <p style="margin:0;font-family:${UI};font-size:13px;line-height:1.55;word-break:break-all;"><a href="${link}" style="color:#86d2c9;">${link}</a></p>
    </td></tr>
    <tr><td style="padding:24px 4px 0;font-family:${UI};font-size:12.5px;line-height:1.6;color:#9ba4b5;">
      You are getting this because this address was used to create a LocusMSK account. If that was not you, ignore this email and nothing will happen.<br><br>
      Questions? Reply to this email and Michael will get back to you.<br>
      <a href="${site}" style="color:#9ba4b5;">${siteName}</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { from: input.from, to: input.to, reply_to: input.replyTo, subject: VERIFY_EMAIL_SUBJECT, text, html };
}
