import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsDesktop } from '../../../anatomy-revision/hooks/useIsDesktop';
import { listRoles } from '../../../roles/rolesRepository';
import { BOOTSTRAP_ADMIN_EMAIL } from '../../../roles/bootstrap';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { useTestAccounts } from '../../hooks/useTestAccounts';
import { formatDateTime, formatRelativeDay, withinDays } from '../../lib/formatDate';
import { levelLabel, questionnaireBreakdown, trainingGroup, COURSE_LABELS, type TrainingGroup } from '../../lib/questionnaire';
import { userAccess, type UserAccess } from '../../lib/userAccess';
import type { AdminUserRow } from '../../types/adminUser';
import { ADMIN_PAGE_PAD } from '../shared/AdminMobile';
import { Chip, EYEBROW, PageHeader, Panel, ShareBar, StatCard, Switch, Tag } from '../shared/AdminUi';

type SortColumn = 'name' | 'access' | 'level' | 'totalAttempts' | 'accuracyPct' | 'lastSessionAt' | 'lastActiveAt';

interface SortState {
  column: SortColumn;
  direction: 'asc' | 'desc';
}

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'access', label: 'Access' },
  { key: 'level', label: 'Level' },
  { key: 'totalAttempts', label: 'Attempts' },
  { key: 'accuracyPct', label: 'Accuracy' },
  { key: 'lastSessionAt', label: 'Last session' },
  { key: 'lastActiveAt', label: 'Last opened app' },
];

type Row = AdminUserRow & { access: UserAccess; group: TrainingGroup; isTest: boolean; isAdmin: boolean };

type Filter = 'all' | 'signed-up' | 'guests' | 'full-access' | 'redeemed' | 'answered' | 'unanswered' | 'qualified' | 'training';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'signed-up', label: 'Signed up' },
  { key: 'guests', label: 'Guests' },
  { key: 'full-access', label: 'Full access' },
  { key: 'redeemed', label: 'Redeemed a code' },
  { key: 'answered', label: 'Answered questionnaire' },
  { key: 'unanswered', label: 'Not answered' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'training', label: 'In training' },
];

function matches(row: Row, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'signed-up':
      return row.access.signedUp;
    case 'guests':
      return !row.access.signedUp;
    case 'full-access':
      return row.access.fullAccess;
    case 'redeemed':
      return row.access.accessCode !== null;
    case 'answered':
      return row.questionnaire?.status === 'answered';
    case 'unanswered':
      return row.questionnaire?.status !== 'answered';
    case 'qualified':
      return row.group === 'qualified';
    case 'training':
      return row.group === 'training';
  }
}

function sortValue(row: Row, column: SortColumn): string | number {
  switch (column) {
    case 'name':
      return (row.displayName ?? row.email ?? '').toLowerCase();
    case 'access':
      return row.access.label.toLowerCase();
    case 'level':
      return row.questionnaire?.level ?? '~';
    case 'totalAttempts':
      return row.totalAttempts;
    case 'accuracyPct':
      return row.totalAttempts > 0 ? row.accuracyPct : -1;
    case 'lastSessionAt':
      return row.lastSessionAt ?? '';
    case 'lastActiveAt':
      return row.lastActiveAt ?? '';
  }
}

/** Admin uids from roles/{uid}, plus the bootstrap owner by email — suggested as test accounts. */
function useAdminUids(): Set<string> {
  const [uids, setUids] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    listRoles()
      .then((roles) => {
        if (!cancelled) setUids(new Set(roles.filter((r) => r.admin).map((r) => r.uid)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return uids;
}

const GROUP_COLORS: Record<TrainingGroup, string> = {
  qualified: 'var(--accd)',
  training: 'var(--acc)',
  other: 'var(--ink3)',
  skipped: 'var(--line)',
  none: 'transparent',
};

export function UsersPage() {
  const { rows, loading, error } = useAdminUsers();
  const { testIds, error: testError, setMarked } = useTestAccounts();
  const adminUids = useAdminUids();
  const [showTest, setShowTest] = useState(false);
  const [sort, setSort] = useState<SortState>({ column: 'lastSessionAt', direction: 'desc' });
  const [filter, setFilter] = useState<Filter>('signed-up');
  const [search, setSearch] = useState('');
  const isDesktop = useIsDesktop();

  const all = useMemo<Row[]>(() => {
    const now = new Date();
    return rows.map((row) => ({
      ...row,
      access: userAccess(row, now),
      group: trainingGroup(row.questionnaire ?? { status: 'none' }),
      isTest: testIds.has(row.uid),
      isAdmin: adminUids.has(row.uid) || row.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL,
    }));
  }, [rows, testIds, adminUids]);

  /** Everyone the numbers are about: test accounts out, unless asked for. */
  const population = useMemo(() => (showTest ? all : all.filter((r) => !r.isTest)), [all, showTest]);
  const signedUp = useMemo(() => population.filter((r) => r.access.signedUp), [population]);
  const testCount = all.filter((r) => r.isTest).length;
  const unmarkedAdmins = all.filter((r) => r.isAdmin && !r.isTest);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      signedUp: signedUp.length,
      guests: population.length - signedUp.length,
      activeWeek: signedUp.filter((r) => withinDays(r.lastSessionAt, 7, now)).length,
      neverSession: signedUp.filter((r) => !r.lastSessionAt).length,
      fullAccess: signedUp.filter((r) => r.access.fullAccess).length,
      answered: signedUp.filter((r) => r.questionnaire?.status === 'answered').length,
    };
  }, [population, signedUp]);

  const breakdown = useMemo(() => questionnaireBreakdown(signedUp.map((r) => r.questionnaire ?? { status: 'none' })), [signedUp]);

  const filterCounts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.key] = population.filter((r) => matches(r, f.key)).length;
    return out;
  }, [population]);

  const visible = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    const needle = search.trim().toLowerCase();
    return population
      .filter((row) => matches(row, filter))
      .filter((row) => !needle || `${row.displayName ?? ''} ${row.email ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (a.access.signedUp !== b.access.signedUp) return a.access.signedUp ? -1 : 1;
        const av = sortValue(a, sort.column);
        const bv = sortValue(b, sort.column);
        if (av < bv) return -1 * factor;
        if (av > bv) return 1 * factor;
        return 0;
      });
  }, [population, filter, search, sort]);

  const toggleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { column, direction: column === 'name' || column === 'level' ? 'asc' : 'desc' },
    );
  };

  const markTest = (row: Row, marked: boolean) => void setMarked(row.uid, marked, { email: row.email, displayName: row.displayName });

  const summary = loading
    ? 'Loading…'
    : `${stats.signedUp} signed-up account${stats.signedUp === 1 ? '' : 's'} · ${stats.guests} guest${stats.guests === 1 ? '' : 's'}${
        testCount ? (showTest ? ` · including ${testCount} test` : ` · ${testCount} test account${testCount === 1 ? '' : 's'} hidden`) : ''
      }`;

  return (
    <div className={`${ADMIN_PAGE_PAD} mx-auto w-full max-w-[1240px]`}>
      <PageHeader
        title="Users"
        summary={summary}
        actions={<Switch checked={showTest} onChange={setShowTest} label="Show test accounts" />}
      />

      {error && (
        <div className="mt-8 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}
      {testError && (
        <div className="mt-4 rounded-[4px] px-3.5 py-2.5 text-sm" style={{ color: 'var(--acc2d)', background: 'var(--acc2s)' }}>
          Test accounts: {testError}
        </div>
      )}

      {!loading && !error && (
        <>
          {unmarkedAdmins.length > 0 && (
            <div
              className="mt-6 flex flex-col gap-3 rounded-[6px] px-4 py-3 sm:flex-row sm:items-center"
              style={{ border: '1px dashed var(--acc)', background: 'var(--accs)' }}
            >
              <span className="flex-1" style={{ font: '400 13.5px/1.4 var(--font-ui)', color: 'var(--ink)' }}>
                {unmarkedAdmins.length} admin account{unmarkedAdmins.length === 1 ? ' is' : 's are'} still counted as{' '}
                {unmarkedAdmins.length === 1 ? 'a real user' : 'real users'}.
              </span>
              <button
                type="button"
                onClick={() => unmarkedAdmins.forEach((r) => markTest(r, true))}
                className="min-h-[36px] rounded-full px-4"
                style={{ font: '500 13px/1 var(--font-ui)', background: 'var(--acc)', color: 'var(--onacc)', border: 0, cursor: 'pointer' }}
              >
                Mark as test
              </button>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            <StatCard label="Signed up" value={stats.signedUp} note={`${stats.guests} guests not counted`} tone="accent" />
            <StatCard label="Did a session this week" value={stats.activeWeek} note={`${stats.neverSession} never done one`} />
            <StatCard label="Full access" value={stats.fullAccess} note={pct(stats.fullAccess, stats.signedUp) + ' of signed up'} />
            <StatCard label="Answered questionnaire" value={stats.answered} note={pct(stats.answered, stats.signedUp) + ' of signed up'} />
          </div>

          <QuestionnairePanel breakdown={breakdown} />

          <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                  {f.label} <span style={{ opacity: 0.7 }}>{filterCounts[f.key]}</span>
                </Chip>
              ))}
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              aria-label="Search users"
              className="min-h-[38px] w-full rounded-[4px] px-3 lg:ml-auto lg:w-[240px]"
              style={{ font: '400 13.5px/1 var(--font-ui)', color: 'var(--ink)', background: 'var(--pg)', border: '1.2px solid var(--line)' }}
            />
          </div>

          {visible.length === 0 && (
            <p className="mt-8 text-sm" style={{ color: 'var(--ink3)' }}>
              No users match.
            </p>
          )}

          {isDesktop ? (
            visible.length > 0 && <UserTable rows={visible} sort={sort} onSort={toggleSort} onMarkTest={markTest} />
          ) : (
            <MobileUserList rows={visible} sort={sort} onSort={setSort} onMarkTest={markTest} />
          )}
        </>
      )}

      {loading && (
        <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
          Loading users…
        </div>
      )}
    </div>
  );
}

function pct(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : '0%';
}

function QuestionnairePanel({ breakdown }: { breakdown: ReturnType<typeof questionnaireBreakdown> }) {
  const { total, groups } = breakdown;
  const answeredLevels = breakdown.levels.filter((l) => l.key !== 'qualified' && l.key !== 'other');
  const courses = breakdown.courses.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  const courseTotal = courses.reduce((n, c) => n + c.count, 0);

  return (
    <Panel className="mt-3" title="Qualified vs in training" aside={`Signed-up accounts · ${total}`}>
      <div className="flex h-3 overflow-hidden rounded-full" style={{ background: 'var(--pg)', border: '1px solid var(--line)' }} aria-hidden="true">
        {groups
          .filter((g) => g.count > 0)
          .map((g) => (
            <div key={g.key} style={{ width: `${(g.count / Math.max(total, 1)) * 100}%`, background: GROUP_COLORS[g.key] }} />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
        {groups.map((g) => (
          <li key={g.key} className="flex items-center gap-2" style={{ font: '400 13px/1.2 var(--font-ui)', color: 'var(--ink2)' }}>
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: GROUP_COLORS[g.key], border: g.key === 'none' ? '1px solid var(--ink3)' : 'none' }}
            />
            {g.label}
            <span style={{ font: '500 13px/1 var(--font-mono)', color: 'var(--ink)' }}>{g.count}</span>
            <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>{pct(g.count, total)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:gap-8">
        <div>
          <div style={EYEBROW}>In training, by level</div>
          <div className="mt-3 flex flex-col gap-3">
            {answeredLevels.map((l) => (
              <ShareBar key={l.key} label={l.label} count={l.count} total={groups.find((g) => g.key === 'training')?.count ?? 0} />
            ))}
          </div>
        </div>
        <div>
          <div style={EYEBROW}>Course</div>
          {courses.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: 'var(--ink3)' }}>
              Nobody has said yet.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {courses.map((c) => (
                <ShareBar key={c.key} label={c.label} count={c.count} total={courseTotal} color="var(--accd)" />
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function NameCell({ row }: { row: Row }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <Link
          to={`/admin/users/${row.uid}`}
          className="truncate"
          style={{ font: '500 14px/1.3 var(--font-ui)', color: 'var(--accd)', textDecoration: 'none' }}
        >
          {row.displayName ?? row.email ?? 'Guest'}
        </Link>
        {row.isTest && <Tag tone="warn">Test</Tag>}
        {row.isAdmin && <Tag>Admin</Tag>}
      </div>
      {row.displayName && (
        <div className="truncate" style={{ font: '400 12.5px/1.3 var(--font-ui)', color: 'var(--ink3)' }}>
          {row.email ?? 'Guest'}
        </div>
      )}
    </div>
  );
}

function UserTable({
  rows,
  sort,
  onSort,
  onMarkTest,
}: {
  rows: Row[];
  sort: SortState;
  onSort: (column: SortColumn) => void;
  onMarkTest: (row: Row, marked: boolean) => void;
}) {
  const head = { ...EYEBROW, letterSpacing: '.12em' };
  return (
    <div className="mt-4 overflow-hidden rounded-[6px]" style={{ border: '1px solid var(--line)' }}>
      <table className="w-full border-collapse text-left" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead style={{ background: 'var(--sf)' }}>
          <tr style={{ borderBottom: '1px solid var(--line)' }}>
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-3 py-3 first:pl-4" aria-sort={sort.column === col.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  className="border-0 bg-transparent p-0 text-left"
                  style={{ ...head, color: sort.column === col.key ? 'var(--accd)' : 'var(--ink3)', cursor: 'pointer' }}
                >
                  {col.label}
                  {sort.column === col.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              </th>
            ))}
            <th className="px-3 py-3 pr-4" style={head}>
              Test
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uid} style={{ borderBottom: '1px solid var(--line)', opacity: row.isTest ? 0.6 : 1 }}>
              <td className="py-2.5 pl-4 pr-3">
                <NameCell row={row} />
              </td>
              <td className="px-3 py-2.5 truncate" style={{ font: '500 12.5px/1.3 var(--font-ui)', color: row.access.fullAccess ? 'var(--accd)' : 'var(--ink3)' }}>
                {row.access.label}
              </td>
              <td className="px-3 py-2.5" style={{ font: '400 12.5px/1.3 var(--font-ui)', color: row.questionnaire?.level ? 'var(--ink2)' : 'var(--ink3)' }}>
                <div className="truncate">{levelLabel(row.questionnaire ?? { status: 'none' })}</div>
                {row.questionnaire?.course && (
                  <div className="truncate" style={{ fontSize: 11.5, color: 'var(--ink3)' }}>
                    {COURSE_LABELS[row.questionnaire.course]}
                  </div>
                )}
              </td>
              <td className="px-3 py-2.5" style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                {row.totalAttempts}
              </td>
              <td className="px-3 py-2.5" style={{ font: '500 13px/1 var(--font-mono)', color: row.accuracyPct < 60 ? 'var(--acc2d)' : 'var(--accd)' }}>
                {row.totalAttempts > 0 ? `${row.accuracyPct}%` : '—'}
              </td>
              <td className="px-3 py-2.5" title={formatDateTime(row.lastSessionAt)} style={{ font: '500 12.5px/1.3 var(--font-ui)', color: row.lastSessionAt ? 'var(--ink)' : 'var(--ink3)' }}>
                {formatRelativeDay(row.lastSessionAt)}
              </td>
              <td className="px-3 py-2.5" title={formatDateTime(row.lastActiveAt)} style={{ font: '400 12.5px/1.3 var(--font-ui)', color: 'var(--ink3)' }}>
                {formatRelativeDay(row.lastActiveAt)}
              </td>
              <td className="px-3 py-1.5 pr-4">
                <TestSwitch row={row} onMarkTest={onMarkTest} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestSwitch({ row, onMarkTest, withLabel = false }: { row: Row; onMarkTest: (row: Row, marked: boolean) => void; withLabel?: boolean }) {
  const name = row.displayName ?? row.email ?? 'this guest';
  return (
    <Switch
      checked={row.isTest}
      onChange={(next) => onMarkTest(row, next)}
      label={withLabel ? 'Test account' : `Test account: ${name}`}
      hideLabel={!withLabel}
    />
  );
}

/** The phone layout: a sort picker over one card per user. */
function MobileUserList({
  rows,
  sort,
  onSort,
  onMarkTest,
}: {
  rows: Row[];
  sort: SortState;
  onSort: (sort: SortState) => void;
  onMarkTest: (row: Row, marked: boolean) => void;
}) {
  return (
    <>
      <div className="mt-4 flex items-center gap-2">
        <label htmlFor="users-sort" style={EYEBROW}>
          Sort
        </label>
        <select
          id="users-sort"
          value={sort.column}
          onChange={(e) => onSort({ ...sort, column: e.target.value as SortColumn })}
          className="min-h-[38px] min-w-0 flex-1 rounded-[4px] px-2"
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
          className="min-h-[38px] rounded-[4px] px-3"
          style={{ font: '500 13.5px/1 var(--font-ui)', border: '1px solid var(--line)', background: 'var(--sf)', color: 'var(--ink2)', cursor: 'pointer' }}
        >
          {sort.direction === 'asc' ? '↑' : '↓'}
        </button>
      </div>
      <ul className="mt-3 flex flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
        {rows.map((row) => (
          <MobileUserCard key={row.uid} row={row} onMarkTest={onMarkTest} />
        ))}
      </ul>
    </>
  );
}

function MobileUserCard({ row, onMarkTest }: { row: Row; onMarkTest: (row: Row, marked: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const detailsId = `user-${row.uid}`;
  const q = row.questionnaire ?? { status: 'none' as const };
  return (
    <li className="rounded-[6px]" style={{ background: 'var(--sf)', border: '1px solid var(--line)', opacity: row.isTest ? 0.7 : 1 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 border-0 bg-transparent px-4 py-3 text-left"
        style={{ cursor: 'pointer' }}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate" style={{ font: '500 15px/1.3 var(--font-ui)', color: 'var(--ink)' }}>
              {row.displayName ?? row.email ?? 'Guest'}
            </span>
            {row.isTest && <Tag tone="warn">Test</Tag>}
            {row.isAdmin && <Tag>Admin</Tag>}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ font: '400 12.5px/1.35 var(--font-ui)', color: 'var(--ink3)' }}>
            <span>{levelLabel(q) === '—' ? 'No level given' : levelLabel(q)}</span>
            <span>
              Session: <span style={{ color: row.lastSessionAt ? 'var(--ink2)' : 'var(--ink3)' }}>{formatRelativeDay(row.lastSessionAt)}</span>
            </span>
          </span>
        </span>
        <span className="flex-none pt-0.5" style={{ font: '500 12px/1.3 var(--font-ui)', color: row.access.fullAccess ? 'var(--accd)' : 'var(--ink3)' }}>
          {row.access.label}
        </span>
        <span aria-hidden="true" className="flex-none pt-0.5" style={{ color: 'var(--ink3)', fontSize: 12 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div id={detailsId} className="px-4 pb-3.5" style={{ borderTop: '1px solid var(--line)' }}>
          <dl className="mt-3 grid gap-x-4 gap-y-2" style={{ gridTemplateColumns: 'max-content 1fr', margin: '12px 0 0' }}>
            {(
              [
                ['Email', row.email ?? 'Guest — no email'],
                ['Course', q.course ? COURSE_LABELS[q.course] : '—'],
                ['Attempts', `${row.totalAttempts}${row.totalAttempts > 0 ? ` · ${row.accuracyPct}% correct` : ''}`],
                ['Streak', String(row.streak)],
                ['Last session', formatDateTime(row.lastSessionAt)],
                ['Opened app', formatDateTime(row.lastActiveAt)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="contents">
                <dt style={{ ...EYEBROW, lineHeight: 1.7 }}>{label}</dt>
                <dd className="min-w-0" style={{ margin: 0, font: '400 13px/1.4 var(--font-ui)', color: 'var(--ink2)', overflowWrap: 'anywhere' }}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex items-center justify-between gap-3">
            <TestSwitch row={row} onMarkTest={onMarkTest} withLabel />
            <Link to={`/admin/users/${row.uid}`} style={{ font: '500 13px/1 var(--font-ui)', color: 'var(--accd)', textDecoration: 'none' }}>
              Open user →
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}
