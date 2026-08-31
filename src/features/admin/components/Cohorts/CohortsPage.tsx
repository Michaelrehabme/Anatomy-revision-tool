import { useEffect, useState } from 'react';
import { listAllCohorts, createCohort } from '../../../educator/data/cohortsRepository';
import type { Cohort } from '../../../educator/types/cohort';

const inputStyle = {
  font: '400 13.5px/1 var(--font-ui)',
  color: 'var(--ink)',
  background: 'var(--pg)',
  border: '1.2px solid var(--line)',
  borderRadius: 3,
  padding: '8px 10px',
} as const;

/**
 * Admin-only cohort management (CR-012). Creating a cohort here only creates
 * the Firestore doc (name/institution/joinCode) — it does NOT grant anyone
 * educator access to that cohort's student data. That's a separate step: run
 * `npm run educator:set-claim -- <uid> <cohortId>` (shown below once a
 * cohort exists) to actually authorize an educator, since custom claims can
 * only be set with firebase-admin credentials, never from client code.
 */
export function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [ownerUid, setOwnerUid] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    listAllCohorts()
      .then(setCohorts)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load cohorts.'));
  };

  useEffect(refresh, []);

  const handleCreate = async () => {
    if (!name.trim() || !institution.trim() || !ownerUid.trim()) return;
    setCreating(true);
    try {
      await createCohort({ name: name.trim(), institution: institution.trim(), ownerUid: ownerUid.trim() });
      setName('');
      setInstitution('');
      setOwnerUid('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cohort.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-16 pt-16 pb-16">
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 40, lineHeight: 1.05, letterSpacing: '-.02em', margin: 0 }}>
        Cohorts
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--ink2)' }}>
        Creating a cohort here only creates the roster/join-code doc. To actually let an educator see that cohort's
        aggregated performance, run{' '}
        <code style={{ font: '500 12.5px/1 var(--font-mono)', background: 'var(--accs)', padding: '1px 5px', borderRadius: 3 }}>
          npm run educator:set-claim -- &lt;uid&gt; &lt;cohortId&gt;
        </code>{' '}
        — custom claims can only be set from a trusted script, never the app itself.
      </p>

      <div className="mt-8 flex flex-wrap items-end gap-3 rounded-[4px] p-4" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
        <label className="flex flex-col gap-1.5">
          <span style={{ font: '500 11px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            Cohort name
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Y2 Physio 2026" style={{ ...inputStyle, minWidth: 200 }} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span style={{ font: '500 11px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            Institution
          </span>
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Riverside College" style={{ ...inputStyle, minWidth: 200 }} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span style={{ font: '500 11px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            Owner (educator) uid
          </span>
          <input value={ownerUid} onChange={(e) => setOwnerUid(e.target.value)} placeholder="Firebase Auth uid" style={{ ...inputStyle, minWidth: 220 }} />
        </label>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !name.trim() || !institution.trim() || !ownerUid.trim()}
          className="rounded-[3px] px-4 py-2 disabled:opacity-50"
          style={{ font: '500 13.5px/1 var(--font-ui)', background: 'var(--acc)', color: 'var(--onacc)', border: 0 }}
        >
          {creating ? 'Creating…' : 'Create cohort'}
        </button>
      </div>

      {error && (
        <div className="mt-6 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}

      {cohorts === null && !error && (
        <div className="mt-6 text-sm" style={{ color: 'var(--ink3)' }}>
          Loading cohorts…
        </div>
      )}

      {cohorts && cohorts.length > 0 && (
        <table className="mt-8 w-full border-collapse text-left">
          <thead>
            <tr style={{ borderBottom: '1.2px solid var(--line)' }}>
              {['Name', 'Institution', 'Join code', 'Owner uid', 'Cohort id'].map((label) => (
                <th
                  key={label}
                  className="pb-2.5 pr-4 whitespace-nowrap"
                  style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td className="py-3 pr-4" style={{ font: '500 13.5px/1.3 var(--font-ui)', color: 'var(--ink)' }}>{c.name}</td>
                <td className="py-3 pr-4" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink2)' }}>{c.institution}</td>
                <td className="py-3 pr-4" style={{ font: '600 13px/1 var(--font-mono)', color: 'var(--accd)' }}>{c.joinCode}</td>
                <td className="py-3 pr-4" style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>{c.ownerUid}</td>
                <td className="py-3 pr-4" style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>{c.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
