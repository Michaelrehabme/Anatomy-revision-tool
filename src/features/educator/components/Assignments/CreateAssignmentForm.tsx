import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ALL_STRUCTURES } from '../../../anatomy-revision/data/seed';
import { unbuildableSessionReason } from '../../../anatomy-revision/lib/setupCount';
import { AREAS, AREA_LABELS, type Area } from '../../../anatomy-revision/types/region';
import { areasOf, isMuscle, MUSCLE_GROUP_LABELS, type Category } from '../../../anatomy-revision/types/structure';
import type { QuestionType } from '../../../anatomy-revision/types/question';
import {
  ASSIGNMENT_QUESTION_COUNTS,
  ASSIGNMENT_QUESTION_TYPES,
  CATEGORY_LABELS,
  DEFAULT_ASSIGNMENT_QUESTION_COUNT,
  DEFAULT_TARGET_ACCURACY_PCT,
  describeAssignmentScope,
  previewAssignment,
} from '../../lib/assignmentScope';
import {
  BUILT_IN_TEMPLATES,
  matchesTemplate,
  templateFromChoices,
  type AssignmentTemplate,
} from '../../lib/assignmentTemplates';
import { deleteTemplate, listTemplates, saveTemplate } from '../../data/assignmentTemplatesRepository';
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

const linkButton = { font: '500 13px/1 var(--font-ui)', color: 'var(--accd)', background: 'transparent', border: 0, padding: 0 } as const;

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * The create half of the assignments screen.
 *
 * Two ways in. Pick a template — nine ship built in, one per area, and an
 * educator's own saved ones sit beside them — and the only things left to
 * set are a title, a due date and a pass mark. Or open "Customise" and choose
 * the scope, formats and length by hand, exactly as before; those choices
 * can then be saved as a template for next time.
 *
 * The preview under the form runs the real generator over the chosen scope,
 * so an assignment that would build nothing cannot be created — and the same
 * check (previewAssignment) is what the built-in templates are tested
 * against, so a preset can never be one of those.
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

  const [customising, setCustomising] = useState(false);
  const [saved, setSaved] = useState<AssignmentTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateNote, setTemplateNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTemplates(createdBy)
      .then((list) => {
        if (!cancelled) setSaved(list);
      })
      // A failed read looks like no saved templates: the built-in ones still work.
      .catch(() => {
        if (!cancelled) setSaved([]);
      });
    return () => {
      cancelled = true;
    };
  }, [createdBy]);

  // Groups are a muscle property, so they are offered only where muscles can
  // be in scope — and only the groups that have a muscle in the chosen areas,
  // the same rule the study screen applies.
  const groupsApply = category === 'all' || category === 'muscle';
  const availableGroups = useMemo(
    () =>
      Object.keys(MUSCLE_GROUP_LABELS).filter((group) =>
        ALL_STRUCTURES.some((s) => {
          return isMuscle(s) && (s.groups ?? []).includes(group) && areasOf(s).some((a) => areas.includes(a));
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

  const { poolSize, available } = useMemo(() => previewAssignment(scope, types), [scope, types]);

  const targetPct = Number(target);
  const targetValid = Number.isInteger(targetPct) && targetPct >= 1 && targetPct <= 100;
  const unbuildable = areas.length > 0 ? unbuildableSessionReason({ types, poolSize, available }) : null;
  const attemptLength = Math.min(count, available);
  const canCreate =
    !creating && !!title.trim() && !!dueAt && areas.length > 0 && types.length > 0 && available > 0 && targetValid;

  const templates = [...BUILT_IN_TEMPLATES, ...saved];
  const choices = { scope, questionTypes: types, questionCount: count };
  const selectedTemplate = templates.find((t) => matchesTemplate(t, choices)) ?? null;

  const applyTemplateChoices = (t: AssignmentTemplate) => {
    setAreas([...t.scope.areas]);
    setCategory(t.scope.category ?? 'all');
    setGroups([...(t.scope.groups ?? [])]);
    setTypes([...t.questionTypes]);
    setCount(t.questionCount);
    setTarget(String(t.defaultTargetAccuracyPct));
    // A title the educator has not typed yet takes the template's; one they
    // have typed is theirs.
    setTitle((prev) => (prev.trim() ? prev : t.title));
    setCustomising(false);
  };

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

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name || areas.length === 0 || types.length === 0 || !targetValid) return;
    setSavingTemplate(true);
    setTemplateNote(null);
    try {
      const template = await saveTemplate(
        createdBy,
        templateFromChoices(name, { scope, questionTypes: types, questionCount: count, targetAccuracyPct: targetPct }),
      );
      setSaved((prev) => [...prev, template].sort((a, b) => a.title.localeCompare(b.title)));
      setTemplateName('');
      setTemplateNote(`Saved “${template.title}” — it is in the template list above.`);
    } catch {
      setTemplateNote('That template could not be saved. Try again in a moment.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (t: AssignmentTemplate) => {
    setSaved((prev) => prev.filter((s) => s.id !== t.id));
    try {
      await deleteTemplate(createdBy, t.id);
    } catch {
      setSaved((prev) => [...prev, t].sort((a, b) => a.title.localeCompare(b.title)));
      setTemplateNote(`“${t.title}” could not be deleted.`);
    }
  };

  let preview: ReactNode;
  if (areas.length === 0) {
    preview = 'Choose a template, or choose at least one area.';
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

  const formatLabels = types
    .map((t) => ASSIGNMENT_QUESTION_TYPES.find((o) => o.value === t)?.label.replace(/ \(.*\)$/, '') ?? t)
    .join(', ');

  return (
    <section className="flex flex-col gap-5 rounded-[4px] p-4" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Start from a template</span>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => {
            const selected = selectedTemplate?.id === t.id;
            return (
              <span key={t.id} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyTemplateChoices(t)}
                  aria-pressed={selected}
                  title={t.blurb}
                  style={chipStyle(selected)}
                >
                  {t.title}
                </button>
                {!t.builtIn && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteTemplate(t)}
                    aria-label={`Delete template ${t.title}`}
                    title="Delete this template"
                    style={{ ...linkButton, color: 'var(--ink3)', padding: '0 4px' }}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <p className="m-0" style={{ font: '400 12.5px/1.5 var(--font-ui)', color: 'var(--ink3)' }}>
          One per area, every structure and every format, {DEFAULT_ASSIGNMENT_QUESTION_COUNT} questions. Your saved templates
          appear here too.
        </p>
      </div>

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

      {!customising ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
            {areas.length > 0 ? (
              <>
                {describeAssignmentScope(scope)} · {count} questions · {formatLabels || 'no formats'}
              </>
            ) : (
              'No scope chosen yet.'
            )}
          </p>
          <button type="button" onClick={() => setCustomising(true)} style={linkButton}>
            Customise
          </button>
        </div>
      ) : (
        <>
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

          <div className="flex flex-wrap items-end gap-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 220 }}>
              <span style={labelStyle}>Save these choices as a template</span>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Knee ligaments — locate"
                aria-label="Template name"
                style={inputStyle}
              />
            </label>
            <button
              type="button"
              onClick={() => void handleSaveTemplate()}
              disabled={savingTemplate || !templateName.trim() || areas.length === 0 || types.length === 0 || !targetValid}
              className="rounded-[3px] px-4 py-2 disabled:opacity-50"
              style={{ font: '500 13.5px/1 var(--font-ui)', background: 'var(--accs)', color: 'var(--accd)', border: 0 }}
            >
              {savingTemplate ? 'Saving…' : 'Save as template'}
            </button>
            <button type="button" onClick={() => setCustomising(false)} style={{ ...linkButton, color: 'var(--ink3)' }}>
              Done
            </button>
          </div>
        </>
      )}
      {templateNote && (
        <p className="m-0" style={{ font: '400 12.5px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
          {templateNote}
        </p>
      )}

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
