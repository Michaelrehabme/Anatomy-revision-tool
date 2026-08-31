/**
 * One-off script: grants (or revokes) the `educator` custom claim, plus the
 * `cohorts` array it's scoped to, on a Firebase Auth user — see
 * firestore.rules for exactly what that claim unlocks (read-only access to
 * users/attemptEvents for students whose users/{uid}.cohort is in that
 * array). Mirrors scripts/setAdmin.ts.
 *
 * Usage (see README "Admin scripts"):
 *   npm run educator:set-claim -- <uid> <cohortId1,cohortId2,...>   # grant/replace
 *   npm run educator:set-claim -- <uid> --remove                    # revoke
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key.
 * The cohort doc(s) themselves must already exist (create them from the
 * /admin dashboard or directly in Firestore) — this script only grants the
 * claim, it doesn't create cohorts. The affected user must sign out/in (or
 * call getIdToken(true)) before the new claim shows up in their ID token.
 */
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdmin';

async function main(): Promise<void> {
  const [uid, arg] = process.argv.slice(2);

  if (!uid || !arg) {
    console.error('Usage: npm run educator:set-claim -- <uid> <cohortId1,cohortId2,...>');
    console.error('       npm run educator:set-claim -- <uid> --remove');
    process.exit(1);
  }

  const remove = arg === '--remove';
  const cohorts = remove ? [] : arg.split(',').map((id) => id.trim()).filter(Boolean);

  if (!remove && cohorts.length === 0) {
    console.error('No cohort ids given — pass a comma-separated list, or --remove to revoke entirely.');
    process.exit(1);
  }

  const auth = getAuth(getAdminApp());

  const user = await auth.getUser(uid).catch(() => null);
  if (!user) {
    console.error(`No Firebase Auth user found with uid "${uid}".`);
    process.exit(1);
  }

  const nextClaims = { ...user.customClaims, educator: !remove, cohorts };
  await auth.setCustomUserClaims(uid, nextClaims);

  console.log(
    remove
      ? `Revoked educator claim for ${user.email ?? uid}.`
      : `Granted educator claim for ${user.email ?? uid}, scoped to cohorts: ${cohorts.join(', ')}.`,
  );
  console.log('They must sign out and back in (or force-refresh their ID token) before it takes effect.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
