import type { ChangeRequest } from '../types/changeRequest';

/**
 * Joins the version-controlled backlog to the Firestore mirror for reads.
 *
 * The seed file already calls itself the source of truth, and the checklist
 * already overlays its step definitions on the stored document. This applies
 * the same rule to the whole register, for one reason: before this, a change
 * request that existed in git but had never been through
 * `scripts/seedChangeRequests.ts` did not appear in /admin/changes at all.
 * Writing a CR and having the screen show nothing is indistinguishable from
 * the screen being broken, and the seeder needs a service account key —
 * a credential the app itself never needs, because every write here is a
 * `setDoc(..., {merge: true})` made as the signed-in admin, which creates the
 * document on demand. So seeding is now an optimisation (it pre-fills status
 * and notes for anyone reading the Firestore console), not a precondition for
 * the register to work.
 *
 * The split is the same one the checklist draws, applied to every field:
 *
 * - GIT owns the DEFINITION — title, category, priority, effort, description,
 *   prompt, dependsOn, checklist. Editing a walkthrough in git therefore
 *   reaches an admin who seeded months ago, instead of being frozen at the
 *   moment the seeder ran.
 * - FIRESTORE owns the STATE — status, the three timestamps, notes and
 *   checklistDone. These are what an admin changes by using the screen, and
 *   nothing in git may overwrite them.
 *
 * A change request created in the app has no seed entry and passes through
 * untouched; one in git that Firestore has never seen shows its seed defaults.
 */

/** Firestore owns these; a seed entry never overrides a stored one. */
type StateFields = Pick<
  ChangeRequest,
  'status' | 'createdAt' | 'startedAt' | 'completedAt' | 'notes' | 'checklistDone'
>;

function stateOf(stored: ChangeRequest, seed: ChangeRequest): StateFields {
  return {
    // `??` rather than `||` throughout: a stored empty `notes` is a real
    // value an admin cleared, not a missing field to fall back on.
    status: stored.status ?? seed.status,
    createdAt: stored.createdAt ?? seed.createdAt ?? null,
    startedAt: stored.startedAt ?? null,
    completedAt: stored.completedAt ?? null,
    notes: stored.notes ?? seed.notes ?? '',
    checklistDone: stored.checklistDone,
  };
}

/**
 * The register as the screen should see it: every ref in either source, seed
 * definitions carrying stored state, ordered by ref so CR-002 precedes CR-010
 * — the refs are zero-padded, so a plain string sort is the numeric one.
 */
export function overlayChangeRequests(
  seed: readonly ChangeRequest[],
  stored: readonly ChangeRequest[],
): ChangeRequest[] {
  const seedByRef = new Map(seed.map((item) => [item.ref, item]));
  const storedByRef = new Map(stored.map((item) => [item.ref, item]));

  const refs = [...new Set([...seedByRef.keys(), ...storedByRef.keys()])].sort();

  return refs.map((ref) => {
    const seedItem = seedByRef.get(ref);
    const storedItem = storedByRef.get(ref);

    // Created in the app, never written down in git. Nothing to overlay.
    if (!seedItem) return storedItem as ChangeRequest;

    // In git, never seeded. The seed entry already carries sensible defaults
    // (status 'new', no timestamps), so it stands as its own first state.
    if (!storedItem) return { ...seedItem };

    return { ...seedItem, ...stateOf(storedItem, seedItem) };
  });
}
