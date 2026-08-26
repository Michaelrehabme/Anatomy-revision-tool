/**
 * Idempotent seed for the Firestore `changeRequests` collection, from the
 * version-controlled backlog at src/features/admin/data/changeRequests.seed.ts
 * — see that file's comment for why the backlog lives in git, not just Firestore.
 *
 * Only creates documents whose `ref` doesn't already exist; never overwrites
 * an existing doc, so it's safe to re-run after an admin has edited status/
 * notes in the live app. `ref` is used as the Firestore document id, which
 * is what makes the "already exists" check a plain doc read rather than a query.
 *
 * Usage: npm run admin:seed-changes
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from './firebaseAdmin';
import { CHANGE_REQUESTS_SEED } from '../src/features/admin/data/changeRequests.seed';

async function main(): Promise<void> {
  const db = getFirestore(getAdminApp());
  const collection = db.collection('changeRequests');

  let created = 0;
  let skipped = 0;

  for (const item of CHANGE_REQUESTS_SEED) {
    const ref = collection.doc(item.ref);
    const snapshot = await ref.get();
    if (snapshot.exists) {
      skipped += 1;
      continue;
    }
    await ref.set(item);
    created += 1;
    console.log(`Created ${item.ref} — ${item.title}`);
  }

  console.log(`\nDone: ${created} created, ${skipped} already existed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
