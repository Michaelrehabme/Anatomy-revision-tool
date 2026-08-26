/**
 * One-off script: grants (or revokes) the `admin` custom claim on a Firebase
 * Auth user, which is what firestore.rules and <RequireAdmin> both check.
 *
 * Usage (see README "Admin scripts"):
 *   npm run admin:set-claim -- <uid>              # grant
 *   npm run admin:set-claim -- <uid> --remove      # revoke
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key.
 * The affected user must sign out/in (or call getIdToken(true)) before the
 * new claim shows up in their ID token — custom claims only propagate on
 * token refresh, not immediately.
 */
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdmin';

async function main(): Promise<void> {
  const [uid, flag] = process.argv.slice(2);

  if (!uid) {
    console.error('Usage: npm run admin:set-claim -- <uid> [--remove]');
    process.exit(1);
  }

  const grant = flag !== '--remove';
  const auth = getAuth(getAdminApp());

  const user = await auth.getUser(uid).catch(() => null);
  if (!user) {
    console.error(`No Firebase Auth user found with uid "${uid}".`);
    process.exit(1);
  }

  const nextClaims = { ...user.customClaims, admin: grant };
  await auth.setCustomUserClaims(uid, nextClaims);

  console.log(
    `${grant ? 'Granted' : 'Revoked'} admin claim for ${user.email ?? uid}. ` +
      'They must sign out and back in (or force-refresh their ID token) before it takes effect.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
