import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AREAS, AREA_LABELS, type Area } from '../../types/region';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '../../types/structure';
import {
  CONFIDENCE_LABELS,
  COURSE_LABELS,
  MINUTES_OPTIONS,
  PREFERRED_FORMAT_LABELS,
  STUDY_LENGTH_LABELS,
  STUDY_LEVEL_LABELS,
  emptyStudyProfile,
  type Confidence,
  type Course,
  type MinutesPerDay,
  type PreferredFormat,
  type StudyLength,
  type StudyLevel,
  type StudyProfile,
} from '../../lib/studyProfile';

const eyebrow = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

function chipStyle(on: boolean) {
  return {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    border: on ? '1.2px solid var(--acc)' : '1.2px solid var(--line)',
    background: on ? 'var(--accs)' : 'transparent',
    color: on ? 'var(--accd)' : 'var(--ink2)',
  };
}

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className="inline-flex min-h-[40px] items-center justify-center rounded-full px-3.5 text-left"
      style={chipStyle(on)}
    >
      {children}
    </button>
  );
}

/** One row of the confidence grid: a name, then Confident / Unsure / New to me. */
function ConfidenceRow({ name, value, onChange }: { name: string; value: Confidence | undefined; onChange: (c: Confidence | undefined) => void }) {
  return (
    <div role="group" aria-label={name} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
      <span className="min-w-[128px] flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>
        {name}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {(['confident', 'unsure', 'new'] as const).map((c) => (
          <Chip key={c} on={value === c} onClick={() => onChange(value === c ? undefined : c)} label={`${name}: ${CONFIDENCE_LABELS[c]}`}>
            {CONFIDENCE_LABELS[c]}
          </Chip>
        ))}
      </span>
    </div>
  );
}

type Draft = Omit<StudyProfile, 'updatedAt'>;

interface Question {
  id: string;
  title: string;
  hint: string;
  render: () => ReactNode;
}

interface StudyProfileFormProps {
  /** The answers so far, when editing. */
  initial: StudyProfile | null;
  /** The areas the student chose, rated first. The rest are one tap away. */
  areas: readonly Area[];
  /** Called with the finished answers. */
  onSave: (profile: Draft) => void;
  /** "Skip": saves nothing but that it was skipped. Absent where skipping makes no sense (editing). */
  onSkip?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  /** Mobile: full-width buttons. */
  compact?: boolean;
}

/**
 * The questionnaire (lib/studyProfile.ts): one question a screen, every one
 * optional, chips rather than typing so it is quick on a phone. Used by
 * onboarding and, to change the answers, by Account.
 *
 * Each screen's title takes focus as it arrives, as onboarding's own steps
 * do, so a screen reader starts from the new question rather than from a
 * button that has moved.
 */
export default function StudyProfileForm({ initial, areas, onSave, onSkip, onCancel, saveLabel = 'Save', compact = false }: StudyProfileFormProps) {
  const [draft, setDraft] = useState<Draft>(() => {
    const { updatedAt: _updatedAt, ...rest } = initial ?? emptyStudyProfile();
    return { ...rest, skipped: undefined };
  });
  const [index, setIndex] = useState(0);
  const [showAllAreas, setShowAllAreas] = useState(() => areas.length === 0);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const chosen = areas.length ? areas : AREAS;
  const otherAreas = AREAS.filter((a) => !chosen.includes(a));

  const single = <T extends string>(labels: Record<T, string>, value: T | undefined, onPick: (v: T | undefined) => void) => (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(labels) as T[]).map((key) => (
        <Chip key={key} on={value === key} onClick={() => onPick(value === key ? undefined : key)}>
          {labels[key]}
        </Chip>
      ))}
    </div>
  );

  const questions: Question[] = [
    {
      id: 'length',
      title: 'How long have you been studying anatomy?',
      hint: 'Counting any course, not only this one.',
      render: () => single<StudyLength>(STUDY_LENGTH_LABELS, draft.studyLength, (v) => set('studyLength', v)),
    },
    {
      id: 'level',
      title: 'At what level?',
      hint: 'Where you are studying it now.',
      render: () => single<StudyLevel>(STUDY_LEVEL_LABELS, draft.level, (v) => set('level', v)),
    },
    {
      id: 'course',
      title: 'What is your course?',
      hint: 'Optional. It helps us see who the app is working for.',
      render: () => single<Course>(COURSE_LABELS, draft.course, (v) => set('course', v)),
    },
    {
      id: 'areas',
      title: 'How sure are you of each area?',
      hint: 'New structures from the areas you are unsure of come up first. Confident areas still come up, just more slowly.',
      render: () => (
        <div>
          {chosen.map((a) => (
            <ConfidenceRow
              key={a}
              name={AREA_LABELS[a]}
              value={draft.areaConfidence[a]}
              onChange={(c) => set('areaConfidence', { ...draft.areaConfidence, [a]: c })}
            />
          ))}
          {otherAreas.length > 0 && !showAllAreas && (
            <button
              type="button"
              onClick={() => setShowAllAreas(true)}
              className="mt-3 min-h-[40px]"
              style={{ font: '500 14px/1 var(--font-ui)', color: 'var(--accd)', textDecoration: 'underline' }}
            >
              Rate the other areas too
            </button>
          )}
          {showAllAreas &&
            otherAreas.map((a) => (
              <ConfidenceRow
                key={a}
                name={AREA_LABELS[a]}
                value={draft.areaConfidence[a]}
                onChange={(c) => set('areaConfidence', { ...draft.areaConfidence, [a]: c })}
              />
            ))}
        </div>
      ),
    },
    {
      id: 'types',
      title: 'And each kind of structure?',
      hint: 'If you are confident with a kind, its new structures start on multiple choice rather than a flashcard.',
      render: () => (
        <div>
          {CATEGORIES.map((c: Category) => (
            <ConfidenceRow
              key={c}
              name={CATEGORY_LABELS[c]}
              value={draft.typeConfidence[c]}
              onChange={(v) => set('typeConfidence', { ...draft.typeConfidence, [c]: v })}
            />
          ))}
        </div>
      ),
    },
    {
      id: 'time',
      title: 'How long do you have most days?',
      hint: 'This sets how long the daily review is. With an exam date, new structures are paced so you have met them all a week before it.',
      render: () => (
        <div>
          <div className="flex flex-wrap gap-2">
            {MINUTES_OPTIONS.map((m: MinutesPerDay) => (
              <Chip key={m} on={draft.minutesPerDay === m} onClick={() => set('minutesPerDay', draft.minutesPerDay === m ? undefined : m)}>
                {m} minutes
              </Chip>
            ))}
          </div>
          <label className="mt-7 block">
            <span style={eyebrow}>Next exam (optional)</span>
            <input
              type="date"
              value={draft.examDate ?? ''}
              onChange={(e) => set('examDate', e.target.value || undefined)}
              className="mt-2.5 block rounded-[3px] px-3"
              style={{ minHeight: 44, border: '1.2px solid var(--line)', background: 'var(--sf)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 15 }}
            />
          </label>
        </div>
      ),
    },
    {
      id: 'formats',
      title: 'How do you like to practise?',
      hint: 'Pick any. Sessions lean towards them, and every kind of question still comes up, because the mix is what makes it stick.',
      render: () => (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PREFERRED_FORMAT_LABELS) as PreferredFormat[]).map((f) => {
            const on = draft.preferredFormats.includes(f);
            return (
              <Chip
                key={f}
                on={on}
                onClick={() => set('preferredFormats', on ? draft.preferredFormats.filter((x) => x !== f) : [...draft.preferredFormats, f])}
              >
                {PREFERRED_FORMAT_LABELS[f]}
              </Chip>
            );
          })}
        </div>
      ),
    },
  ];

  const question = questions[index];
  const last = index === questions.length - 1;
  const title = useRef<HTMLHeadingElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) { opened.current = true; return; }
    title.current?.focus();
  }, [index]);

  const finish = () => {
    // Clear empty ratings so "unset" is never stored as a value.
    const clean = <K extends string>(m: Partial<Record<K, Confidence | undefined>>) =>
      Object.fromEntries(Object.entries(m).filter(([, v]) => v)) as Partial<Record<K, Confidence>>;
    const { skipped: _skipped, ...rest } = draft;
    onSave({ ...rest, areaConfidence: clean(draft.areaConfidence), typeConfidence: clean(draft.typeConfidence) });
  };

  const button = (primary: boolean) => ({
    minHeight: compact ? 50 : 52,
    font: `500 ${compact ? 16 : 15.5}px/1 var(--font-ui)`,
    ...(primary
      ? { background: 'var(--acc-fill)', color: 'var(--onacc)', border: 0 }
      : { background: 'transparent', color: 'var(--ink2)', border: '1.2px solid var(--line)' }),
  });

  return (
    <section aria-labelledby="study-profile-question">
      <div style={eyebrow}>
        Question {index + 1} of {questions.length}
      </div>
      <h2
        id="study-profile-question"
        ref={title}
        tabIndex={-1}
        className="mt-3 outline-none"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: compact ? 24 : 28, lineHeight: 1.12, letterSpacing: '-.012em', color: 'var(--ink)' }}
      >
        {question.title}
      </h2>
      <p className="mt-2 mb-5" style={{ font: '400 14.5px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
        {question.hint}
      </p>

      {question.render()}

      <div className="mt-6 flex gap-1.5" aria-hidden="true">
        {questions.map((q, i) => (
          <span key={q.id} className="h-0.5 w-5 rounded-full" style={{ background: i === index ? 'var(--ink)' : 'var(--line)' }} />
        ))}
      </div>

      <div className={`mt-5 flex items-center gap-3 ${compact ? '' : 'flex-wrap'}`}>
        {index > 0 && (
          <button type="button" onClick={() => setIndex((i) => i - 1)} className={`rounded-[3px] px-5 ${compact ? 'flex-none' : ''}`} style={button(false)}>
            Back
          </button>
        )}
        <button
          type="button"
          onClick={last ? finish : () => setIndex((i) => i + 1)}
          className={`rounded-[3px] px-6 ${compact ? 'flex-1' : 'min-w-[160px]'}`}
          style={button(true)}
        >
          {last ? saveLabel : 'Next'}
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="min-h-[44px] px-1.5" style={{ fontSize: 15, color: 'var(--ink3)' }}>
            Skip questions
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-[44px] px-1.5" style={{ fontSize: 15, color: 'var(--ink3)' }}>
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}
