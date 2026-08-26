import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { formatDateTime } from '../../lib/formatDate';
import type { AdminUserRow } from '../../types/adminUser';

type SortColumn = 'name' | 'email' | 'totalAttempts' | 'accuracyPct' | 'streak' | 'lastActiveAt';

interface SortState {
  column: SortColumn;
  direction: 'asc' | 'desc';
}

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'totalAttempts', label: 'Attempts' },
  { key: 'accuracyPct', label: 'Accuracy' },
  { key: 'streak', label: 'Streak' },
  { key: 'lastActiveAt', label: 'Last active' },
];

function sortValue(row: AdminUserRow, column: SortColumn): string | number {
  switch (column) {
    case 'name':
      return (row.displayName ?? '').toLowerCase();
    case 'email':
      return (row.email ?? '').toLowerCase();
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

  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.column);
      const bv = sortValue(b, sort.column);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [rows, sort]);

  const toggleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { column, direction: 'asc' },
    );
  };

  return (
    <div className="px-16 pt-16 pb-16">
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 40,
          lineHeight: 1.05,
          letterSpacing: '-.02em',
          margin: 0,
        }}
      >
        Users
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ink2)' }}>
        {rows.length} user{rows.length === 1 ? '' : 's'}
      </p>

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

      {!loading && !error && (
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
                  {row.email ?? '—'}
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
