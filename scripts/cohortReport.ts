/**
 * The pilot report: what a cohort actually did, in the terms a course lead
 * has to justify it in.
 *
 *   npx tsx scripts/cohortReport.ts                 # every cohort, one line each
 *   npx tsx scripts/cohortReport.ts <cohortId>      # the full report
 *
 * WHY A SCRIPT AND NOT A SCREEN. The educator dashboard already answers the
 * educator's question — which regions is my year group weak at, this week.
 * This answers ours: did the pilot take, and is there a case to buy. Those
 * are different questions with different audiences, and a screen for a
 * question asked once a term by one person is a screen nobody maintains.
 *
 * AGGREGATES ONLY, NO NAMES. The privacy policy tells students their
 * educator sees the class's weak spots and not their individual answers, and
 * this report is the thing most likely to be pasted into an email to that
 * educator. Counts and medians travel safely; a named row does not. Student
 * names are available in the dashboard, to the person who already has a
 * relationship with them.
 *
 * READ-ONLY. It writes nothing, so it needs no --apply.
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS — see the README's "Admin scripts".
 */
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAdminApp } from './firebaseAdmin';

const DAY_MS = 86_400_000;

interface Member {
  uid: string;
  joinedAt: string | null;
  lastActiveAt: string | null;
}

interface Sitting {
  phase: 'baseline' | 'followUp';
  correct: number;
  total: number;
  takenAt: string;
}

function pct(correct: number, total: number): string {
  return total > 0 ? `${Math.round((correct / total) * 100)}%` : '—';
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

async function members(db: Firestore, cohortId: string): Promise<Member[]> {
  const snap = await db.collection('users').where('cohort', '==', cohortId).get();
  return snap.docs.map((d) => ({
    uid: d.id,
    joinedAt: (d.data().cohortJoinedAt as string | null) ?? null,
    lastActiveAt: (d.data().lastActiveAt as string | null) ?? null,
  }));
}

async function overview(db: Firestore): Promise<void> {
  const cohorts = await db.collection('cohorts').get();
  if (cohorts.empty) {
    process.stdout.write('No cohorts yet.\n');
    return;
  }

  for (const d of cohorts.docs) {
    const c = d.data();
    const count = (await db.collection('users').where('cohort', '==', d.id).count().get()).data().count;
    const licence = c.licensedUntil ? `licensed to ${String(c.licensedUntil).slice(0, 10)}` : 'not licensed';
    process.stdout.write(
      `${d.id}  ${String(count).padStart(3)} members  ${licence.padEnd(24)} ${c.name}${c.institution ? ` — ${c.institution}` : ''}\n`,
    );
  }
  process.stdout.write('\nRun with a cohort id for the full report.\n');
}

async function report(db: Firestore, cohortId: string): Promise<void> {
  const cohortSnap = await db.doc(`cohorts/${cohortId}`).get();
  if (!cohortSnap.exists) throw new Error(`No cohort ${cohortId}.`);
  const cohort = cohortSnap.data() ?? {};

  const roll = await members(db, cohortId);
  const stats = await db.collection(`cohorts/${cohortId}/studentStats`).get();
  const rows = stats.docs.map((d) => d.data()).filter((r) => r.removed !== true);

  const now = Date.now();
  const activeSince = (days: number) =>
    roll.filter((m) => m.lastActiveAt && now - Date.parse(m.lastActiveAt) < days * DAY_MS).length;

  // "Activated" means answered at least one question. Joining a class and
  // never answering anything is the failure mode a pilot has to surface: it
  // is the difference between a tool a year group has and one it uses.
  const started = rows.filter((r) => Number(r.attemptsTotal ?? 0) > 0);
  const graded = rows.map((r) => Number(r.gradedTotal ?? 0)).filter((n) => n > 0);
  const gradedTotal = rows.reduce((sum, r) => sum + Number(r.gradedTotal ?? 0), 0);
  const gradedCorrect = rows.reduce((sum, r) => sum + Number(r.gradedCorrect ?? 0), 0);
  const days = rows.map((r) => (Array.isArray(r.activeDays) ? r.activeDays.length : 0)).filter((n) => n > 0);

  process.stdout.write(`${cohort.name}${cohort.institution ? ` — ${cohort.institution}` : ''}\n`);
  process.stdout.write(`${cohortId}\n\n`);
  process.stdout.write(
    `Licence:        ${cohort.licensedUntil ? `runs to ${String(cohort.licensedUntil).slice(0, 10)}` : 'not licensed'}\n`,
  );
  process.stdout.write(`Created:        ${String(cohort.createdAt ?? '?').slice(0, 10)}\n\n`);

  process.stdout.write('TAKE-UP\n');
  process.stdout.write(`  Joined the class          ${roll.length}\n`);
  process.stdout.write(`  Answered at least once    ${started.length}${roll.length ? ` (${Math.round((started.length / roll.length) * 100)}%)` : ''}\n`);
  process.stdout.write(`  Active in the last 7 days ${activeSince(7)}\n`);
  process.stdout.write(`  Active in the last 28     ${activeSince(28)}\n\n`);

  process.stdout.write('USE\n');
  process.stdout.write(`  Questions answered        ${gradedTotal}\n`);
  process.stdout.write(`  Median per active student ${median(graded)}\n`);
  process.stdout.write(`  Median days used          ${median(days)}\n`);
  process.stdout.write(`  Class accuracy            ${pct(gradedCorrect, gradedTotal)}\n\n`);

  // The diagnostic is the only before-and-after in the product, and the only
  // figure that speaks to whether anybody learned anything. Paired: a student
  // who sat one and not the other tells you nothing about change.
  const sittings = new Map<string, Sitting[]>();
  for (const m of roll) {
    const snap = await db.collection(`users/${m.uid}/diagnostics`).get();
    const theirs = snap.docs
      .map((d) => d.data() as Sitting)
      .filter((s) => (s as unknown as { cohortId?: string }).cohortId === cohortId);
    if (theirs.length) sittings.set(m.uid, theirs);
  }

  const baselines: number[] = [];
  const paired: { before: number; after: number }[] = [];
  for (const theirs of sittings.values()) {
    const base = theirs.find((s) => s.phase === 'baseline');
    const follow = theirs.find((s) => s.phase === 'followUp');
    if (base && base.total > 0) baselines.push((base.correct / base.total) * 100);
    if (base && follow && base.total > 0 && follow.total > 0) {
      paired.push({ before: (base.correct / base.total) * 100, after: (follow.correct / follow.total) * 100 });
    }
  }

  process.stdout.write('DIAGNOSTIC\n');
  if (baselines.length === 0) {
    process.stdout.write('  Nobody has sat one yet.\n');
  } else {
    const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
    process.stdout.write(`  Sat the baseline          ${baselines.length}\n`);
    process.stdout.write(`  Mean baseline score       ${mean(baselines)}%\n`);
    if (paired.length === 0) {
      process.stdout.write('  Follow-ups                none yet — the before-and-after needs both sittings\n');
    } else {
      const before = mean(paired.map((p) => p.before));
      const after = mean(paired.map((p) => p.after));
      const improved = paired.filter((p) => p.after > p.before).length;
      process.stdout.write(`  Sat both                  ${paired.length}\n`);
      process.stdout.write(`  Mean before / after       ${before}% → ${after}%  (${after - before >= 0 ? '+' : ''}${after - before} points)\n`);
      process.stdout.write(`  Improved                  ${improved} of ${paired.length}\n`);
    }
  }

  if (roll.length > 0 && started.length === 0) {
    process.stdout.write('\nNobody has answered anything. Worth asking the course lead whether the\njoin code reached the students, before reading anything into the silence.\n');
  }
}

async function main(): Promise<void> {
  const db = getFirestore(getAdminApp());
  const [cohortId] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  return cohortId ? report(db, cohortId) : overview(db);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
