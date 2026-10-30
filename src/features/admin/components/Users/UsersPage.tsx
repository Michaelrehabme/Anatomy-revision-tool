import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsDesktop } from '../../../anatomy-revision/hooks/useIsDesktop';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { formatDateTime } from '../../lib/formatDate';
import { countUsers, matchesFilter, userAccess, type UserAccess, type UsersFilter } from '../../lib/userAccess';
import type { AdminUserRow } from '../../types/adminUser';
import { ADMIN_PAGE_PAD, ADMIN_TITLE_STYLE } from '../shared/AdminMobile';

type SortColumn = 'name' | 'email' | 'access' | 'totalAttempts' | 'accuracyPct' | 'streak' | 'lastActiveAt';

interface SortState {
  column: SortColumn;
  direction: 'asc' | 'desc';
}

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'access', label: 'Access' },
  { key: 'totalAttempts', label: 'Attempts' },
  { key: 'accuracyPct', label: 'Accuracy' },
  { key: 'streak', label: 'Streak' },
  { key: 'lastActiveAt', label: 'Last active' },
];

type Row = AdminUserRow & { access: UserAccess };

const FILTERS: { key: UsersFilter; label: string; count: keyof ReturnType<typeof countUsers> }[] = [
  { key: 'all', label: 'All', count: 'all' },
  { key: 'signed-up', label: 'Signed up', count: 'signedUp' },
  { key: 'full-access', label: 'Full access', count: 'fullAccess' },
  { key: 'redeemed', label: 'Redeemed a code', count: 'redeemed' },
];

function sortValue(row: Row, column: SortColumn): string | number {
  switch (column) {
    case 'name':
      return (row.displayName ?? '').toLowerCase();
    case 'email':
      return (row.email ?? '').toLowerCase();
    case 'access':
      return row.access.label.toLowerCase();
    case 'totalAttempts':
      return row.totalAttempts;
    case 'accuracyPct':
      return row.accuracyPct;
    case 'streak':
      return row.streak;
    case 'lastActiveAt':
      return row.lastActiveAt ?? '';
  }
}

export function UsersPage() {
  const { rows, loading, error } = useAdminUsers();
  const [sort, setSort] = useState<SortState>({ column: 'lastActiveAt', direction: 'desc' });
  const [filter, setFilter] = useState<UsersFilter>('all');
  const isDesktop = useIsDesktop();

  const withAccess = useMemo<Row[]>(() => {
    const now = new Date();
    return rows.map((row) => ({ ...row, access: userAccess(row, now) }));
  }, [rows]);
  const counts = useMemo(() => countUsers(withAccess.map((r) => r.access)), [withAccess]);

  // Signed-up accounts always sit above guests, whatever the column sort.
  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return withAccess.filter((row) => matchesFilter(row.access, filter)).sort((a, b) => {
      if (a.access.signedUp !== b.access.signedUp) return a.access.signedUp ? -1 : 1;
      const av = sortValue(a, sort.column);
      const bv = sortValue(b, sort.column);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [withAccess, filter, sort]);

  const toggleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { column, direction: 'asc' },
    );
  };

  return (
    <div className={ADMIN_PAGE_PAD}>
      <h1 style={ADMIN_TITLE_STYLE}>
        Users
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ink2)' }}>
        {counts.all} user{counts.all === 1 ? '' : 's'} · {counts.signedUp} signed up · {counts.fullAccess} with full access ·{' '}
        {counts.redeemed} redeemed a code
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Show">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              className="rounded-full px-3 py-1.5"
              style={{
                font: '500 12.5px/1 var(--font-ui)',
                border: `1.2px solid ${active ? 'var(--acc)' : 'var(--line)'}`,
                background: active ? 'var(--acc)' : 'transparent',
                color: active ? 'var(--onacc)' : 'var(--ink2)',
                cursor: 'pointer',
              }}
            >
              {f.label} {counts[f.count]}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
          Loading users…
        </div>
      )}
      {error && (
        <div className="mt-10 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}

      {!loading && !error && !isDesktop && (
        <MobileUserList rows={sorted} sort={sort} onSort={setSort} />
      )}

      {!loading && !error && isDesktop && (
        <table className="mt-8 w-full border-collapse text-left">
          <thead>
            <tr style={{ borderBottom: '1.2px solid var(--line)' }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="cursor-pointer pb-2.5 pr-4"
                  onClick={() => toggleSort(col.key)}
                  style={{
                    font: '500 10px/1 var(--font-mono)',
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: sort.column === col.key ? 'var(--accd)' : 'var(--ink3)',
                  }}
                >
                  {col.label}
                  {sort.column === col.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.uid} style={{ borderBottom: '1px solid var(--line)' }}>
                <td className="py-3 pr-4">
                  <Link
                    to={`/admin/users/${row.uid}`}
                    style={{ font: '500 13.5px/1.3 var(--font-ui)', color: 'var(--accd)', textDecoration: 'none' }}
                  >
                    {row.displayName ?? 'Unnamed user'}
                  </Link>
                </td>
                <td className="py-3 pr-4" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink2)' }}>
                  {row.email ?? 'Guest'}
                </td>
                <td
                  className="py-3 pr-4"
                  style={{ font: '500 12.5px/1.3 var(--font-ui)', color: row.access.fullAccess ? 'var(--accd)' : 'var(--ink3)' }}
                >
                  {row.access.label}
                </td>
                <td className="py-3 pr-4" style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                  {row.totalAttempts}
                </td>
                <td
                  className="py-3 pr-4"
                  style={{ font: '500 13px/1 var(--font-mono)', color: row.accuracyPct < 60 ? 'var(--acc2d)' : 'var(--accd)' }}
                >
                  {row.totalAttempts > 0 ? `${row.accuracyPct}%` : '—'}
                </td>
                <td className="py-3 pr-4" style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                  {row.streak}
                </td>
                <td className="py-3 pr-4" style={{ font: '400 12.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                  {formatDateTime(row.lastActiveAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** The phone layout: a sort picker over one folding row per user, since six columns do not fit. */
function MobileUserList({ rows, sort, onSort }: { rows: Row[]; sort: SortState; onSort: (sort: SortState) => void }) {
  const label = { font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' } as const;
  return (
    <>
      <div className="mt-5 flex items-center gap-2">
        <label htmlFor="users-sort" style={label}>
          Sort
        </label>
        <select
          id="users-sort"
          value={sort.column}
          onChange={(e) => onSort({ ...sort, column: e.target.value as SortColumn })}
          className="min-w-0 flex-1 rounded-[3px] px-2 py-2"
          style={{ font: '400 13.5px/1 var(--font-ui)', border: '1px solid var(--line)', background: 'var(--sf)', color: 'var(--ink)' }}
        >
          {COLUMNS.map((col) => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
          aria-label={sort.direction === 'asc' ? 'Ascending; switch to descending' : 'Descending; switch to ascending'}
          className="rounded-[3px] px-3 py-2"
          style={{ font: '500 13.5px/1 var(--font-ui)', border: '1px solid var(--line)', background: 'var(--sf)', color: 'var(--ink2)', cursor: 'pointer' }}
        >
          {sort.direction === 'asc' ? '↑' : '↓'}
        </button>
      </div>
      <ul className="mt-4 flex flex-col gap-1.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((row) => (
          <MobileUserRow key={row.uid} row={row} />
        ))}
      </ul>
    </>
  );
}

/** A name and its access, folded; open, the rest of what the desktop table shows and a link to the user's page. */
function MobileUserRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const detailsId = `user-${row.uid}`;
  return (
    <li className="rounded-[4px]" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-3 text-left"
        style={{ cursor: 'pointer' }}
      >
        <span className="min-w-0 flex-1 truncate" style={{ font: '500 14.5px/1.3 var(--font-ui)', color: 'var(--ink)' }}>
          {row.displayName ?? row.email ?? 'Guest'}
        </span>
        <span
          className="flex-none"
          style={{ font: '500 12px/1.3 var(--font-ui)', color: row.access.fullAccess ? 'var(--accd)' : 'var(--ink3)' }}
        >
          {row.access.label}
        </span>
        <span aria-hidden="true" className="flex-none" style={{ color: 'var(--ink3)', fontSize: 12 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div id={detailsId} className="px-4 pb-3.5">
          <div className="truncate" style={{ font: '400 12.5px/1.3 var(--font-ui)', color: 'var(--ink2)' }}>
            {row.email ?? 'Guest — no email'}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" style={{ font: '400 12px/1.3 var(--font-mono)', color: 'var(--ink3)' }}>
            <span>{row.totalAttempts} attempts</span>
            {row.totalAttempts > 0 && (
              <span style={{ color: row.accuracyPct < 60 ? 'var(--acc2d)' : 'var(--accd)' }}>{row.accuracyPct}%</span>
            )}
            <span>streak {row.streak}</span>
            <span>{formatDateTime(row.lastActiveAt)}</span>
          </div>
          <Link
            to={`/admin/users/${row.uid}`}
            className="mt-3 inline-block"
            style={{ font: '500 13px/1 var(--font-ui)', color: 'var(--accd)', textDecoration: 'none' }}
          >
            Open user →
          </Link>
        </div>
      )}
    </li>
  );
}
