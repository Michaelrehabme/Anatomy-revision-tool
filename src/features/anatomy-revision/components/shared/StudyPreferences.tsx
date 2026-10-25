import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { useStudyProfile } from '../../hooks/useStudyProfile';
import { getLearnCardAttempts, getPreferredAreas, LEARN_CARD_ATTEMPT_LABELS, LEARN_CARD_ATTEMPT_OPTIONS, setLearnCardAttempts } from '../../lib/preferences';
import {
  COURSE_LABELS,
  currentFocus,
  dailyGoalFor,
  GOAL_FOR_MINUTES,
  MINUTES_OPTIONS,
  parseReminderTime,
  hasAnswers,
  PREFERRED_FORMAT_LABELS,
  STUDY_LENGTH_LABELS,
  STUDY_LEVEL_LABELS,
  weekStartOf,
  type Confidence,
  type NewStructureStart,
  type StudyProfile,
  type WeeklyFocus,
} from '../../lib/studyProfile';
import { AREA_LABELS, type Area } from '../../types/region';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '../../types/structure';
import { LockPill } from './AreaLock';
import { focusLabel } from './WeeklyFocusCard';
import { isNativeShell } from '../../../native/nativeShell';
import { REMINDER_HOUR } from '../../../native/reviewReminderPlan';

const StudyProfileForm = lazy(() => import('./StudyProfileForm'));

/** Null: decided from the questionnaire (lib/studyProfile.ts skipsFlashcard). */
const NEW_STRUCTURE_OPTIONS: { value: NewStructureStart | null; label: string }[] = [
  { value: null, label: 'From my answers' },
  { value: 'show', label: 'Show me first' },
  { value: 'ask', label: 'Ask me first' },
];

const label = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

function chipStyle(on: boolean, compact: boolean) {
  return {
    fontFamily: 'var(--font-display)',
    fontSize: compact ? 14.5 : 15,
    border: on ? '1.4px solid var(--acc)' : '1.2px solid var(--line)',
    background: on ? 'var(--accs)' : 'transparent',
    color: on ? 'var(--accd)' : 'var(--ink2)',
  };
}

function rated(map: Partial<Record<string, Confidence>>, labels: Record<string, string>, want: Confidence): string[] {
  return Object.entries(map).filter(([, c]) => c === want).map(([k]) => labels[k] ?? k);
}

/** The answers in a few plain lines, empty ones left out. */
function summaryLines(profile: StudyProfile): string[] {
  const lines: string[] = [];
  const background = [
    profile.studyLength && `Studying ${STUDY_LENGTH_LABELS[profile.studyLength].toLowerCase()}`,
    profile.level && STUDY_LEVEL_LABELS[profile.level],
    profile.course && COURSE_LABELS[profile.course],
  ].filter(Boolean);
  if (background.length) lines.push(background.join(' · '));
  const labels = { ...AREA_LABELS, ...CATEGORY_LABELS } as Record<string, string>;
  const all = { ...profile.areaConfidence, ...profile.typeConfidence } as Partial<Record<string, Confidence>>;
  const unsure = [...rated(all, labels, 'unsure'), ...rated(all, labels, 'new')];
  const sure = rated(all, labels, 'confident');
  if (unsure.length) lines.push(`Starting with: ${unsure.join(', ')}`);
  if (sure.length) lines.push(`Confident: ${sure.join(', ')}`);
  const time = [
    profile.minutesPerDay && `${profile.minutesPerDay} minutes a day`,
    profile.examDate && `exam ${new Date(`${profile.examDate}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`,
  ].filter(Boolean);
  if (time.length) lines.push(time.join(' · '));
  if (profile.preferredFormats.length) lines.push(`Likes: ${profile.preferredFormats.map((f) => PREFERRED_FORMAT_LABELS[f].toLowerCase()).join(', ')}`);
  return lines;
}

/**
 * Account's "Study preferences" (owner, 19 Oct 2026): the questionnaire's
 * answers and the way to change them, this week's focus, and how often a
 * fact's teaching card comes first — the settings that change what a session
 * asks, together in one place. Appearance keeps the ones that change how a
 * screen looks.
 */
export function StudyPreferences({ access, compact = false }: { access: UseEntitlement; compact?: boolean }) {
  const studyProfile = useStudyProfile();
  const { profile, update } = studyProfile;
  const [editing, setEditing] = useState(false);
  const [learnCards, setLearnCardsState] = useState(getLearnCardAttempts);
  const now = new Date();
  const free = access.tier === 'free';
  const focus = currentFocus(profile, now, access.areas);

  if (editing) {
    return (
      <Suspense fallback={<p role="status" style={{ font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>One moment…</p>}>
        <StudyProfileForm
          initial={profile}
          areas={getPreferredAreas().filter((a) => access.areas.includes(a))}
          onSave={(draft) => {
            update((current) => ({ ...draft, weeklyFocus: current.weeklyFocus }));
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          compact={compact}
        />
      </Suspense>
    );
  }

  const answered = hasAnswers(profile);
  const lines = answered ? summaryLines(profile) : [];
  const focusOptions: WeeklyFocus[] = free
    ? CATEGORIES.map((category: Category) => ({ category, weekStart: weekStartOf(now) }))
    : access.areas.map((area: Area) => ({ area, weekStart: weekStartOf(now) }));
  const isFocus = (o: WeeklyFocus) => !!focus && focus.area === o.area && focus.category === o.category;

  return (
    <div>
      <div style={label}>Where you are starting</div>
      {answered ? (
        <ul className="mt-2.5 flex flex-col gap-1" style={{ font: `400 ${compact ? 14 : 14.5}px/1.5 var(--font-ui)`, color: 'var(--ink2)' }}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5" style={{ font: `400 ${compact ? 14 : 14.5}px/1.5 var(--font-ui)`, color: 'var(--ink2)' }}>
          Seven quick questions decide which new structures come first, how long your daily review is, and which formats it leans on.
        </p>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`mt-3.5 rounded-[3px] px-5 ${compact ? 'w-full' : ''}`}
        style={{ minHeight: 46, font: '500 15px/1 var(--font-ui)', background: 'transparent', color: 'var(--ink)', border: '1.3px solid var(--line)' }}
      >
        {answered ? 'Edit your answers' : 'Answer the questions'}
      </button>

      {(free || access.areas.length > 1) && (
        <>
          <div className="mt-7" style={label}>
            This week’s focus
          </div>
          <p className="mt-2" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink3)' }}>
            {focus
              ? `${focusLabel(focus, free ? access.areas[0] : undefined)} until Sunday. Its own session is on Today.`
              : 'None this week. Pick one here or on Today.'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label="This week’s focus">
            {focusOptions.map((o) => {
              const on = isFocus(o);
              return (
                <button
                  key={o.area ?? o.category}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update((current) => ({ ...current, weeklyFocus: on ? undefined : o }))}
                  className="inline-flex min-h-[40px] items-center rounded-full px-3.5"
                  style={chipStyle(on, compact)}
                >
                  {o.category ? CATEGORY_LABELS[o.category] : AREA_LABELS[o.area!]}
                </button>
              );
            })}
          </div>
          {free && (
            <p className="mt-3 flex flex-wrap items-center gap-2" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink3)' }}>
              <LockPill compact /> A whole area each week comes with a subscription.{' '}
              <Link to="/pricing" style={{ color: 'var(--accd)' }}>
                See the plans
              </Link>
            </p>
          )}
        </>
      )}

      {/* The daily goal is the minutes answer under another name (owner, 19
          Oct 2026): one setting, read as "how much a day", that sizes both the
          review and the ring on Today. Setting it here counts as answering. */}
      <div className="mt-7" style={label}>
        Daily goal
      </div>
      <p className="mt-2" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink3)' }}>
        Questions a day. It sets the length of your daily review and fills the ring on Today.
      </p>
      <div className="mt-2.5 flex gap-2" role="radiogroup" aria-label="Daily goal">
        {MINUTES_OPTIONS.map((m) => {
          const goal = GOAL_FOR_MINUTES[m];
          const on = dailyGoalFor(profile) === goal && (answered || goal === 20);
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => update((current) => ({ ...current, skipped: undefined, minutesPerDay: m }))}
              className="inline-flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-[3px] px-2"
              style={chipStyle(on, compact)}
            >
              {goal}
              <span style={{ font: '400 10.5px/1.2 var(--font-mono)', color: 'inherit', opacity: 0.8 }}>~{m} min</span>
            </button>
          );
        })}
      </div>

      {/* Only where there is a notification to time: the installed app
          (native/nativeShell.ts). A browser has no reminder, and a setting
          that does nothing is worse than none. */}
      {isNativeShell() && (
        <>
          <div className="mt-7" style={label}>
            Reminder
          </div>
          <label className="mt-2 flex items-center gap-3" style={{ fontSize: 13.5, color: 'var(--ink2)' }}>
            When your reviews are due, remind me at
            <input
              id="study-reminder-time"
              type="time"
              value={profile?.reminderTime ?? `${String(REMINDER_HOUR).padStart(2, '0')}:00`}
              onChange={(e) => {
                const value = e.target.value;
                if (parseReminderTime(value)) update((current) => ({ ...current, reminderTime: value }));
              }}
              className="rounded-[3px] px-2.5"
              style={{ minHeight: 42, border: '1.2px solid var(--line)', background: 'var(--sf)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 15 }}
            />
          </label>
        </>
      )}

      <div className="mt-7" style={label}>
        Teaching cards
      </div>
      <p className="mt-2" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink3)' }}>
        How many times an origin, insertion, nerve or action is shown before you are asked it.
      </p>
      <div className="mt-2.5 flex gap-2" role="radiogroup" aria-label="Teaching cards before a fact">
        {LEARN_CARD_ATTEMPT_OPTIONS.map((n) => {
          const on = learnCards === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setLearnCardAttempts(n);
                setLearnCardsState(n);
              }}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[3px] px-2"
              style={chipStyle(on, compact)}
            >
              {LEARN_CARD_ATTEMPT_LABELS[n]}
            </button>
          );
        })}
      </div>

      {/* Learn first or test first (owner, 19 Oct 2026), here rather than a
          setting of its own: it is the same question as the row above —
          shown before asked — for a structure met for the first time. */}
      <p className="mt-5" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink3)' }}>
        A structure you have never met: see it first, or try it straight away on multiple choice.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label="New structures">
        {NEW_STRUCTURE_OPTIONS.map(({ value, label: text }) => {
          const on = (profile?.newStructures ?? null) === value;
          return (
            <button
              key={text}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => update((current) => ({ ...current, newStructures: value ?? undefined }))}
              className={`inline-flex min-h-[44px] items-center justify-center rounded-[3px] px-3 ${compact ? 'flex-1' : ''}`}
              style={chipStyle(on, compact)}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
