import { useEffect, useId, useState } from 'react';
import { STUDY_REMINDER_FIELD, type StudyReminderChoice } from './studyReminder';

/**
 * "Email me once a week with what is due", on the Account screen.
 *
 * OFF UNTIL THE STUDENT TICKS IT, and unticking it is as easy (studyReminder.ts
 * says why). It reads and writes the student's own profile document; Firebase
 * is imported only when the box is used, so a build without accounts never
 * loads it, and the screen does not show the box at all there.
 */

const ENABLED = (import.meta.env.VITE_PERSISTENCE ?? 'local') === 'firestore' && import.meta.env.VITE_PUBLIC_DEMO !== '1';

async function profileRef(uid: string) {
  const [{ getDb }, sdk] = await Promise.all([import('../anatomy-revision/data/firebase'), import('firebase/firestore')]);
  return { ref: sdk.doc(getDb(), 'users', uid), sdk };
}

export async function readWeeklyReminder(uid: string): Promise<boolean> {
  const { ref, sdk } = await profileRef(uid);
  const snap = await sdk.getDoc(ref);
  const choice = snap.exists() ? (snap.data()[STUDY_REMINDER_FIELD] as StudyReminderChoice | undefined) : undefined;
  return choice?.weekly === true;
}

export async function saveWeeklyReminder(uid: string, weekly: boolean): Promise<void> {
  const { ref, sdk } = await profileRef(uid);
  const now = new Date().toISOString();
  await sdk.setDoc(ref, { [STUDY_REMINDER_FIELD]: weekly ? { weekly, optedInAt: now } : { weekly, optedOutAt: now } }, { merge: true });
}

export const WEEKLY_REMINDER_LABEL = 'Email me once a week with what is due for review';

export function WeeklyReminderSetting({ uid, email }: { uid: string; email: string | null }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    if (!ENABLED) return;
    let cancelled = false;
    readWeeklyReminder(uid).then(
      (value) => !cancelled && setOn(value),
      () => !cancelled && setOn(false),
    );
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (!ENABLED || !email) return null;

  const toggle = async (next: boolean) => {
    setError(null);
    const before = on;
    setOn(next);
    try {
      await saveWeeklyReminder(uid, next);
    } catch {
      setOn(before);
      setError('That could not be saved. Check your connection and try again.');
    }
  };

  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink)' }}>
        <input
          id={id}
          type="checkbox"
          checked={on === true}
          disabled={on === null}
          onChange={(event) => void toggle(event.target.checked)}
          className="mt-0.5 min-h-[18px] min-w-[18px]"
        />
        <span>{WEEKLY_REMINDER_LABEL}</span>
      </label>
      <p className="mt-1.5" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink2)', margin: '6px 0 0 28px' }}>
        On Monday mornings, to {email}, and only when something is due. Every email has a link to stop them.
      </p>
      {error && (
        <p role="alert" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--acc2d)', margin: '6px 0 0 28px' }}>
          {error}
        </p>
      )}
    </div>
  );
}
