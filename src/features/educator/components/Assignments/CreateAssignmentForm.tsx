import { useMemo, useState, type ReactNode } from 'react';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../../anatomy-revision/data/seed';
import { generateRevisionSet } from '../../../anatomy-revision/lib/questionGenerators/generateSet';
import { filterStructures } from '../../../anatomy-revision/lib/indexes';
import { unbuildableSessionReason } from '../../../anatomy-revision/lib/setupCount';
import { AREAS, AREA_LABELS, type Area } from '../../../anatomy-revision/types/region';
import { areaOf, isMuscle, MUSCLE_GROUP_LABELS, type Category } from '../../../anatomy-revision/types/structure';
import type { QuestionType } from '../../../anatomy-revision/types/question';
import {
  ASSIGNMENT_QUESTION_COUNTS,
  ASSIGNMENT_QUESTION_TYPES,
  CATEGORY_LABELS,
  DEFAULT_ASSIGNMENT_QUESTION_COUNT,
  DEFAULT_TARGET_ACCURACY_PCT,
  describeAssignmentScope,
} from '../../lib/assignmentScope';
import type { AssignmentScope, NewAssignment } from '../../types/cohort';

const inputStyle = {
  font: '400 13.5px/1 var(--font-ui)',
  color: 'var(--ink)',
  background: 'var(--pg)',
  border: '1.2px solid var(--line)',
  borderRadius: 3,
  padding: '8px 10px',
} as const;

const labelStyle = { font: '500 11px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' } as const;

function chipStyle(selected: boolean) {
  return {
    font: '400 13px/1 var(--font-ui)',
    padding: '7px 12px',
    borderRadius: 999,
    ...(selected
      ? { border: '1.2px solid var(--acc)', background: 'var(--accs)', color: 'var(--accd)' }
      : { border: '1.2px solid var(--line)', background: 'transparent', color: 'var(--ink2)' }),
  };
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} style={chipStyle(selected)}>
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * The create half of the assignments screen. Everything a student's attempt
 * is built from is chosen here, and the preview line under it is computed by
 * the same generator the student's device runs — so "20 questions from 6
 * muscles" is what they will actually get, and a scope that builds nothing
 * (Locate over bones, OINA over landmarks) cannot be set at all.
 *
 * Reads the bundled seed rather than the repository's content: the educator
 * bundle has no content loader of its own, and cohortAnalytics already
 * resolves structures from the same seed.
 */
export function CreateAssignmentForm({
  cohortId,
  createdBy,
  onCreate,
}: {
  cohortId: string;
  createdBy: string;
  /** Resolves false when the write failed — the parent reports the error, and the form keeps what was typed. */
  onCreate: (input: NewAssignment) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [areas, setAreas] = useState<Area[]>([]);
  const [category, setCategory] = useState<Category | 'all'>('muscle');
  const [groups, setGroups] = useState<string[]>([]);
  const [types, setTypes] = useState<QuestionType[]>(['mcq']);
  const [count, setCount] = useState(DEFAULT_ASSIGNMENT_QUESTION_COUNT);
  const [target, setTarget] = useState(String(DEFAULT_TARGET_ACCURACY_PCT));
  const [creating, setCreating] = useState(false);

  // Groups are a muscle property, so they are offered only where muscles can
  // be in scope — and only the groups that have a muscle in the chosen areas,
  // the same rule the study screen applies.
  const groupsApply = category === 'all' || category === 'muscle';
  const availableGroups = useMemo(
    () =>
      Object.keys(MUSCLE_GROUP_LABELS).filter((group) =>
        ALL_STRUCTURES.some((s) => {
          const area = areaOf(s);
          return isMuscle(s) && (s.groups ?? []).includes(group) && !!area && areas.includes(area);
        }),
      ),
    [areas],
  );
  // A group chosen under one area set can fall out of the list when an area is
  // deselected; it must fall out of the scope with it, not linger invisibly.
  const activeGroups = useMemo(
    () => (groupsApply ? groups.filter((g) => availableGroups.includes(g)) : []),
    [groupsApply, groups, availableGroups],
  );

  const scope: AssignmentScope = useMemo(
    () => ({
      areas,
      category: category === 'all' ? undefined : category,
      groups: activeGroups.length ? activeGroups : undefined,
    }),
    [areas, category, activeGroups],
  );

  const { poolSize, available } = useMemo(() => {
    if (scope.areas.length === 0) return { poolSize: 0, available: 0 };
    return {
      poolSize: filterStructures(ALL_STRUCTURES, scope).length,
      // Practice with learn cards off counts every question the scope can
      // build, which is the ceiling on an attempt's length.
      available: generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
        ...scope,
        types,
        mode: 'practice',
        learnCardAttempts: 0,
        seed: 1,
      }).length,
    };
  }, [scope, types]);

  const targetPct = Number(target);
  const targetValid = Number.isInteger(targetPct) && targetPct >= 1 && targetPct <= 100;
  const unbuildable = areas.length > 0 ? unbuildableSessionReason({ types, poolSize, available }) : null;
  const attemptLength = Math.min(count, available);
  const canCreate =
    !creating && !!title.trim() && !!dueAt && areas.length > 0 && types.length > 0 && available > 0 && targetValid;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const created = await onCreate({
        cohortId,
        title: title.trim(),
        // Due at the END of the chosen day: a bare date parses as midnight
        // UTC, which made an assignment set "due Thursday" overdue for the
        // whole of Thursday.
        dueAt: new Date(`${dueAt}T23:59:59`).toISOString(),
        createdBy,
        scope,
        questionTypes: types,
        questionCount: attemptLength,
        targetAccuracyPct: targetPct,
      });
      // Scope choices are kept: the next assignment is usually the same
      // class's next topic, set the same way.
      if (created) {
        setTitle('');
        setDueAt('');
      }
    } finally {
      setCreating(false);
    }
  };

  let preview: ReactNode;
  if (areas.length === 0) {
    preview = 'Choose at least one area.';
  } else if (types.length === 0) {
    preview = 'Choose at least one question format.';
  } else if (unbuildable) {
    preview = <span style={{ color: 'var(--acc2d)' }}>{unbuildable}</span>;
  } else if (poolSize === 0) {
    preview = <span style={{ color: 'var(--acc2d)' }}>Nothing matches this scope — widen the category or drop a group.</span>;
  } else {
    const noun = scope.groups || category === 'muscle' ? 'muscle' : 'structure';
    preview = (
      <>
        {describeAssignmentScope(scope)} — each attempt is {attemptLength} question{attemptLength === 1 ? '' : 's'} from{' '}
        {poolSize} {noun}
        {poolSize === 1 ? '' : 's'}
        {available < count && `, all this scope can build`}. Exam style: no feedback until the end
        {targetValid && `, pass at ${targetPct}%`}.
      </>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-[4px] p-4" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 220 }}>
          <span style={labelStyle}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hip flexors — before Thursday's practical" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span style={labelStyle}>Due date</span>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span style={labelStyle}>Pass mark</span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={100}
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-invalid={!targetValid}
              style={{ ...inputStyle, width: 72, borderColor: targetValid ? 'var(--line)' : 'var(--acc2)' }}
            />
            <span style={{ font: '400 13.5px/1 var(--font-ui)', color: 'var(--ink2)' }}>%</span>
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Areas</span>
        <div className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <Chip key={a} selected={areas.includes(a)} onClick={() => setAreas((prev) => toggle(prev, a))}>
              {AREA_LABELS[a]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Category</span>
        <div className="flex flex-wrap gap-2">
          <Chip selected={category === 'all'} onClick={() => setCategory('all')}>
            Everything
          </Chip>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
      </div>

      {groupsApply && availableGroups.length > 0 && (
        <div className="flex flex-col gap-2">
          <span style={labelStyle}>
            Muscle groups <span style={{ textTransform: 'none', letterSpacing: 0 }}>· optional</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {availableGroups.map((g) => (
              <Chip key={g} selected={activeGroups.includes(g)} onClick={() => setGroups((prev) => toggle(prev, g))}>
                {MUSCLE_GROUP_LABELS[g]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-10 gap-y-5">
        <div className="flex flex-col gap-2">
          <span style={labelStyle}>Question formats</span>
          <div className="flex flex-wrap gap-2">
            {ASSIGNMENT_QUESTION_TYPES.map((t) => (
              <Chip key={t.value} selected={types.includes(t.value)} onClick={() => setTypes((prev) => toggle(prev, t.value))}>
                {t.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span style={labelStyle}>Questions per attempt</span>
          <div className="flex flex-wrap gap-2">
            {ASSIGNMENT_QUESTION_COUNTS.map((n) => (
              <Chip key={n} selected={count === n} onClick={() => setCount(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
        <p className="m-0 max-w-[70ch]" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
          {preview}
        </p>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          className="rounded-[3px] px-4 py-2 disabled:opacity-50"
          style={{ font: '500 13.5px/1 var(--font-ui)', background: 'var(--acc)', color: 'var(--onacc)', border: 0 }}
        >
          {creating ? 'Creating…' : 'Create assignment'}
        </button>
      </div>
    </section>
  );
}
