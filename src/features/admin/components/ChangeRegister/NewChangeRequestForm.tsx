import { useState, type FormEvent } from 'react';
import {
  CHANGE_CATEGORIES,
  CHANGE_CATEGORY_LABELS,
  CHANGE_EFFORTS,
  CHANGE_EFFORT_LABELS,
  CHANGE_PRIORITIES,
  CHANGE_PRIORITY_LABELS,
  type ChangeCategory,
  type ChangeEffort,
  type ChangePriority,
  type NewChangeRequestInput,
} from '../../types/changeRequest';
import { Button } from '../../../anatomy-revision/components/shared/Button';

interface NewChangeRequestFormProps {
  onSubmit: (input: NewChangeRequestInput) => Promise<void>;
  onCancel: () => void;
}

const fieldLabelStyle = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.14em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

const inputStyle = {
  font: '400 13.5px/1.4 var(--font-ui)',
  color: 'var(--ink)',
  background: 'var(--pg)',
  border: '1.2px solid var(--line)',
  borderRadius: 3,
  padding: '9px 11px',
  width: '100%',
  boxSizing: 'border-box' as const,
};

const monoInputStyle = { ...inputStyle, font: '400 12.5px/1.5 var(--font-mono)' };

export function NewChangeRequestForm({ onSubmit, onCancel }: NewChangeRequestFormProps) {
  const [ref, setRef] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ChangeCategory>('content');
  const [priority, setPriority] = useState<ChangePriority>('p1');
  const [effort, setEffort] = useState<ChangeEffort>('m');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [dependsOn, setDependsOn] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ref.trim() || !title.trim() || !description.trim() || !prompt.trim()) {
      setError('Ref, title, description and prompt are all required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        ref: ref.trim(),
        title: title.trim(),
        category,
        priority,
        effort,
        description: description.trim(),
        prompt,
        dependsOn: dependsOn
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        notes: notes.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create change request.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" role="dialog" aria-label="New change request">
      <div className="absolute inset-0" style={{ background: 'rgba(32, 30, 29, 0.4)' }} onClick={onCancel} />
      <form
        onSubmit={handleSubmit}
        className="relative flex max-h-[88vh] w-[640px] flex-col overflow-y-auto rounded-[4px] px-8 py-8"
        style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, margin: 0 }}>New change request</h2>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <label>
            <div style={fieldLabelStyle}>Ref</div>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="CR-006"
              className="mt-1.5"
              style={inputStyle}
            />
          </label>
          <label>
            <div style={fieldLabelStyle}>Title</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" style={inputStyle} />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <label>
            <div style={fieldLabelStyle}>Category</div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ChangeCategory)}
              className="mt-1.5"
              style={inputStyle}
            >
              {CHANGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CHANGE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={fieldLabelStyle}>Priority</div>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ChangePriority)}
              className="mt-1.5"
              style={inputStyle}
            >
              {CHANGE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {CHANGE_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={fieldLabelStyle}>Effort</div>
            <select
              value={effort}
              onChange={(e) => setEffort(e.target.value as ChangeEffort)}
              className="mt-1.5"
              style={inputStyle}
            >
              {CHANGE_EFFORTS.map((ef) => (
                <option key={ef} value={ef}>
                  {CHANGE_EFFORT_LABELS[ef]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <div style={fieldLabelStyle}>Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1.5"
            style={inputStyle}
          />
        </label>

        <label className="mt-4 block">
          <div style={fieldLabelStyle}>Prompt (verbatim)</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="mt-1.5"
            style={monoInputStyle}
          />
        </label>

        <label className="mt-4 block">
          <div style={fieldLabelStyle}>Depends on (comma-separated refs)</div>
          <input
            value={dependsOn}
            onChange={(e) => setDependsOn(e.target.value)}
            placeholder="CR-001, CR-003"
            className="mt-1.5"
            style={monoInputStyle}
          />
        </label>

        <label className="mt-4 block">
          <div style={fieldLabelStyle}>Notes</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5" style={inputStyle} />
        </label>

        {error && (
          <p className="mt-4 text-sm" style={{ color: 'var(--acc2d)' }}>
            {error}
          </p>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create change request'}
          </Button>
        </div>
      </form>
    </div>
  );
}
