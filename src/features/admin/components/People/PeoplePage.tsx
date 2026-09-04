import { useEffect, useMemo, useState } from 'react';
import { listUserProfiles } from '../../data/usersRepository';
import { listRoles, setRole } from '../../../roles/rolesRepository';
import { useCurrentRole } from '../../../roles/useCurrentRole';
import { BOOTSTRAP_ADMIN_EMAIL } from '../../../roles/bootstrap';
import type { AdminUserProfile } from '../../types/adminUser';
import type { RoleGrant, UserRole } from '../../../roles/types';

/**
 * Grant and revoke ADMIN access. Writes go to roles/{uid}, which
 * firestore.rules lets only an admin write — the reason this screen can exist
 * at all is that roles moved out of custom claims, which need service-account
 * credentials to mint and so made every change a terminal command.
 *
 * There is deliberately nothing here about educators. Teaching is
 * self-service: anyone creates a class from /educator and owns it, so an
 * "educator" checkbox on this screen would grant nothing and imply a gate
 * that does not exist.
 *
 * Rows come from users/{uid} — a person must have signed in at least once
 * before they can be granted anything, because there is no uid to grant to
 * until they do. That is a real constraint of the model, so the empty state
 * says so rather than leaving an admin hunting for a "create user" button.
 */

const inputStyle = {
  font: '400 13.5px/1 var(--font-ui)',
  color: 'var(--ink)',
  background: 'var(--pg)',
  border: '1.2px solid var(--line)',
  borderRadius: 3,
  padding: '8px 10px',
} as const;

const cellHead = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

interface Row {
  profile: AdminUserProfile;
  role: UserRole | null;
  /** Unsaved edits, or null when the row matches what's stored. */
  draft: RoleGrant | null;
}

function toGrant(profile: AdminUserProfile, role: UserRole | null): RoleGrant {
  return { admin: role?.admin ?? false, email: profile.email, displayName: profile.displayName };
}

export function PeoplePage() {
  const { uid: actorUid } = useCurrentRole();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([listUserProfiles(), listRoles()])
      .then(([profiles, roles]) => {
        if (cancelled) return;
        const byUid = new Map(roles.map((r) => [r.uid, r]));
        setRows(profiles.map((profile) => ({ profile, role: byUid.get(profile.uid) ?? null, draft: null })));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load people.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    const matching = needle
      ? rows.filter(
          (row) =>
            (row.profile.displayName ?? '').toLowerCase().includes(needle) ||
            (row.profile.email ?? '').toLowerCase().includes(needle),
        )
      : rows;
    // Anyone holding or being given a role first — an access screen is read far more often than it is edited.
    return [...matching].sort((a, b) => {
      const rank = (row: Row) =>
        row.profile.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ? 0 : row.draft?.admin || row.role?.admin ? 1 : 2;
      return rank(a) - rank(b) || (a.profile.displayName ?? '').localeCompare(b.profile.displayName ?? '');
    });
  }, [rows, search]);

  const edit = (uid: string, change: Partial<RoleGrant>) => {
    setRows(
      (prev) =>
        prev?.map((row) => {
          if (row.profile.uid !== uid) return row;
          const base = row.draft ?? toGrant(row.profile, row.role);
          const draft = { ...base, ...change };
          return { ...row, draft: draft.admin === toGrant(row.profile, row.role).admin ? null : draft };
        }) ?? null,
    );
  };

  const save = async (row: Row) => {
    if (!row.draft || !actorUid) return;
    setSaving(row.profile.uid);
    setError(null);
    try {
      const saved = await setRole(row.profile.uid, row.draft, actorUid);
      setRows((prev) => prev?.map((r) => (r.profile.uid === row.profile.uid ? { ...r, role: saved, draft: null } : r)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save that role.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="px-16 pt-16 pb-16">
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 40, lineHeight: 1.05, letterSpacing: '-.02em', margin: 0 }}>
        People
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--ink2)' }}>
        Grant admin access — every user's data, the Change Register and platform analytics. Changes take effect on
        that person's next page load, with no sign-out and no script. Teaching needs nothing from this screen: anyone
        can create a class from /educator and owns it, seeing only the students who joined with its code.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or email"
        className="mt-6"
        style={{ ...inputStyle, minWidth: 280 }}
      />

      {error && (
        <div className="mt-6 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}

      {rows === null && !error && (
        <div className="mt-6 text-sm" style={{ color: 'var(--ink3)' }}>
          Loading people…
        </div>
      )}

      {rows !== null && visible.length === 0 && (
        <div className="mt-6 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--ink3)' }}>
          {rows.length === 0
            ? 'Nobody has signed in yet. A person needs an account before a role can be attached to it — ask them to sign in once, then grant access here.'
            : 'No one matches that search.'}
        </div>
      )}

      {visible.length > 0 && (
        <table className="mt-8 w-full border-collapse text-left">
          <thead>
            <tr style={{ borderBottom: '1.2px solid var(--line)' }}>
              {['Person', 'Admin', ''].map((label) => (
                <th key={label} className="pb-2.5 pr-4 whitespace-nowrap" style={cellHead}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const grant = row.draft ?? toGrant(row.profile, row.role);
              const isOwner = row.profile.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

              return (
                <tr key={row.profile.uid} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td className="py-3 pr-4 align-top">
                    <div style={{ font: '400 14px/1.3 var(--font-ui)', color: 'var(--ink)' }}>
                      {row.profile.displayName ?? '—'}
                      {isOwner && (
                        <span className="ml-2" style={{ font: '500 10px/1 var(--font-mono)', color: 'var(--accd)' }}>
                          OWNER
                        </span>
                      )}
                    </div>
                    <div style={{ font: '400 12px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>{row.profile.email ?? row.profile.uid}</div>
                  </td>

                  <td className="py-3 pr-4 align-top">
                    <label className="flex items-center gap-2" style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--ink2)' }}>
                      <input
                        type="checkbox"
                        checked={grant.admin || isOwner}
                        disabled={isOwner}
                        onChange={(e) => edit(row.profile.uid, { admin: e.target.checked })}
                      />
                      {/* The owner's access comes from firestore.rules, not from this document — unticking it here would change nothing, so it can't be unticked. */}
                      {isOwner ? 'Always admin' : 'Admin'}
                    </label>
                  </td>

                  <td className="py-3 align-top text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => save(row)}
                      disabled={!row.draft || saving === row.profile.uid}
                      className="rounded-[3px] px-3.5 py-2 disabled:opacity-40"
                      style={{ font: '500 12.5px/1 var(--font-ui)', background: 'var(--acc)', color: 'var(--onacc)', border: 0 }}
                    >
                      {saving === row.profile.uid ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
