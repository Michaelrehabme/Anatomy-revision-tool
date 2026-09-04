/**
 * The one account that is admin without being granted admin.
 *
 * Roles are stored in roles/{uid} and only an admin may write one, which is
 * a chicken-and-egg: with no admin in existence, nobody can create the first
 * one. Rather than keep a service-account script in the loop forever, this
 * address is admin by definition — matched here for the UI and, separately,
 * in firestore.rules for the actual enforcement.
 *
 * KEEP THIS IN SYNC with isBootstrapAdmin() in firestore.rules. Changing it
 * in one place only will either lock the owner out of /admin or leave a
 * former owner holding access at the rules layer, where nothing in the app
 * can revoke it. Both sides require a verified email.
 */
export const BOOTSTRAP_ADMIN_EMAIL = 'nearyomichael@gmail.com';

export function isBootstrapAdmin(email: string | null, emailVerified: boolean): boolean {
  return emailVerified && email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
}
