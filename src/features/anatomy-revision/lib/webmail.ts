/**
 * A web inbox to open for the common providers, so "check your email" is one
 * tap. Gmail opens on a search for the sender. University addresses (.ac.uk)
 * are almost all Microsoft 365. Anything else gets no button.
 */
export function webmailFor(email: string): { name: string; url: string } | null {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#search/from%3Alocusmsk.co.uk' };
  }
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) return { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' };
  if (domain.endsWith('.ac.uk')) return { name: 'Outlook', url: 'https://outlook.office.com/mail/' };
  if (/^(yahoo|ymail)\.[a-z.]+$/.test(domain)) return { name: 'Yahoo Mail', url: 'https://mail.yahoo.com/' };
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') return { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' };
  return null;
}
