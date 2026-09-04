import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCohort } from '../../data/cohortsRepository';
import { useEducatorSession } from '../RequireEducator';
import { useCohorts } from '../CohortsProvider';

/**
 * Create a class and get its join code. No approval step and no admin: the
 * person who creates a class owns it, and owning it is what lets them see the
 * students who join with the code.
 *
 * Institution is optional. It is the field most likely to be wrong or awkward
 * for a private tutor or a placement educator, and nothing depends on it.
 */

const inputStyle = {
  font: '400 14px/1 var(--font-ui)',
  color: 'var(--ink)',
  background: 'var(--pg)',
  border: '1.2px solid var(--line)',
  borderRadius: 3,
  padding: '10px 12px',
} as const;

const labelStyle = {
  font: '500 11px/1 var(--font-mono)',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

export function CreateClassScreen({ firstRun = false }: { firstRun?: boolean }) {
  const { uid } = useEducatorSession();
  const { refresh } = useCohorts();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const cohort = await createCohort({ name: name.trim(), institution: institution.trim(), ownerUid: uid });
      refresh();
      // Straight to the class, where the join code is the first thing on the page.
      navigate(`/educator/${cohort.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that class.');
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 34, letterSpacing: '-.02em', margin: 0 }}>
        {firstRun ? 'Create your first class' : 'New class'}
      </h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink2)' }}>
        You'll get a join code to give your students. Anyone who enters it joins this class, and you'll see how they
        are getting on — their accuracy, their weakest structures, and where the whole group is struggling. Students
        can leave at any time, which removes their data from your screens.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span style={labelStyle}>Class name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Y2 Physiotherapy 2026"
            style={inputStyle}
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span style={labelStyle}>Institution — optional</span>
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Riverside College"
            style={inputStyle}
          />
        </label>

        <div>
          <button
            type="button"
            onClick={create}
            disabled={creating || !name.trim()}
            className="rounded-[3px] px-5 py-2.5 disabled:opacity-50"
            style={{ font: '500 14px/1 var(--font-ui)', background: 'var(--acc)', color: 'var(--onacc)', border: 0 }}
          >
            {creating ? 'Creating…' : 'Create class'}
          </button>
        </div>

        {error && (
          <div className="text-sm" style={{ color: 'var(--acc2d)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
