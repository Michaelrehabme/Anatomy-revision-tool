/**
 * Demo-mode stand-in for anatomy-revision/data/accountLifecycle.ts.
 *
 * The real module imports firebase/auth and firebase/firestore at the top
 * level, and the account screen imports it unconditionally — so without this
 * alias the whole Firebase client lands in the demo bundle, which
 * vite.config.demo.ts pins persistence to 'local' specifically to prevent.
 *
 * DELETION IS REFUSED RATHER THAN SIMULATED. A course leader clicking through
 * a demo must not be shown a convincing "account deleted" flow: either they
 * believe it did something, or they learn the destructive control in this
 * product is a prop. Saying plainly that it is disabled here is the only
 * honest option, and it still demonstrates that the control exists — which is
 * the part a data protection officer is looking for.
 */

export interface AccountExport {
  exportedAt: string;
  uid: string;
  profile: Record<string, unknown> | null;
  attemptEvents: Record<string, unknown>[];
  cohortSummary: Record<string, unknown> | null;
  collections: Record<string, Record<string, unknown>[]>;
}

export interface DeletionProgress {
  step: string;
}

/** Shape-accurate and obviously fake, so a downloaded file cannot be mistaken for real student data. */
export async function exportAccountData(uid: string): Promise<AccountExport> {
  return {
    exportedAt: new Date().toISOString(),
    uid,
    profile: {
      note: 'Demo mode — this file is generated in the browser and contains no real data.',
      displayName: 'Demo user',
      email: 'demo@example.ac.uk',
    },
    attemptEvents: [],
    cohortSummary: null,
    collections: {
      mastery: [],
      factMastery: [],
      sessions: [],
      achievements: [],
      gamification: [],
      questionExposure: [],
    },
  };
}

export async function deleteAccountData(): Promise<void> {
  throw new Error('Account deletion is disabled in the demo. In the real app this removes everything immediately.');
}
