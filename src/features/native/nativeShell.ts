import type { FactMastery, StructureMastery } from '../anatomy-revision/types/attempt';

/**
 * The only native-wrapper code the web build carries (trial: see
 * docs/native-wrapper-trial.md).
 *
 * THE CAPABILITY CHECK IS A GLOBAL, NOT AN IMPORT. Inside a Capacitor shell
 * the native side injects `window.Capacitor` before any page script runs; in a
 * browser, an installed PWA or a test it is simply absent. Reading it costs
 * nothing, where `import { Capacitor } from '@capacitor/core'` would put the
 * Capacitor runtime in the chunk every student downloads — and that chunk has
 * a 2 MiB ceiling it already sits just under.
 *
 * Everything else — the plugin, and the decision about when to remind — is
 * behind the dynamic import below, so on the web it is never fetched at all.
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export function isNativeShell(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

export interface ReviewReminderInput {
  mastery: readonly StructureMastery[];
  facts: readonly FactMastery[];
  /** Structures this account may reach. A locked muscle is never "due". */
  eligible: ReadonlySet<string>;
}

/**
 * Brings the one pending "reviews are due" notification into line with the
 * review queue. A no-op on the web. Never throws: a reminder that cannot be
 * scheduled must not break the Today screen that asked for it.
 */
export async function syncReviewReminder(input: ReviewReminderInput): Promise<void> {
  if (!isNativeShell()) return;
  try {
    const { scheduleReviewReminder } = await import('./reviewReminder');
    await scheduleReviewReminder(input);
  } catch {
    // Denied permission, a missing plugin, a WebView without the bridge: all
    // of them mean "no reminder", none of them is the student's problem.
  }
}
