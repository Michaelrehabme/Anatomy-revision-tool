import { LocalNotifications } from '@capacitor/local-notifications';
import { planReviewReminder } from './reviewReminderPlan';
import type { ReviewReminderInput } from './nativeShell';

/**
 * The native half of the review reminder. Loaded only inside the Capacitor
 * shell — see nativeShell.ts, which is the only importer.
 *
 * ONE NOTIFICATION, ONE ID. Every sync cancels it and sets it again from the
 * queue as it now stands, so finishing today's reviews moves the reminder to
 * the next day that has any, and there is never a second one to chase.
 *
 * PERMISSION IS ASKED ONLY WHEN THERE IS SOMETHING TO REMIND ABOUT. Android 13
 * and later show a system prompt, and a prompt on first launch — before the
 * student has answered a question — is refused by reflex and cannot be asked
 * again. A denial is respected: nothing is scheduled and nothing is shown.
 *
 * INEXACT ON PURPOSE. The plugin's manifest asks for SCHEDULE_EXACT_ALARM and
 * the app's manifest removes it again (android/app/src/main/AndroidManifest.xml),
 * so Android may deliver this some minutes late. For "your reviews are due"
 * that is fine, and exact alarms are a permission Play restricts.
 */
export const REVIEW_REMINDER_ID = 1001;

export type ReminderOutcome = 'scheduled' | 'cleared' | 'denied';

export async function scheduleReviewReminder(input: ReviewReminderInput, now: Date = new Date()): Promise<ReminderOutcome> {
  const plan = planReviewReminder(input.mastery, input.facts, input.eligible, now);

  await LocalNotifications.cancel({ notifications: [{ id: REVIEW_REMINDER_ID }] });
  if (!plan) return 'cleared';

  let { display } = await LocalNotifications.checkPermissions();
  if (display === 'prompt' || display === 'prompt-with-rationale') {
    ({ display } = await LocalNotifications.requestPermissions());
  }
  if (display !== 'granted') return 'denied';

  await LocalNotifications.schedule({
    notifications: [
      {
        id: REVIEW_REMINDER_ID,
        title: plan.title,
        body: plan.body,
        schedule: { at: plan.at, allowWhileIdle: true },
      },
    ],
  });
  return 'scheduled';
}
