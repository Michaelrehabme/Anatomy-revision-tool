import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useCohorts } from '../../hooks/useCohorts';

/** Educator-section counterpart to AdminSidebar/NavSidebar — same brand mark + nav-list treatment, plus a cohort switcher since one educator can hold multiple cohorts. */
export function EducatorSidebar() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { cohorts, loading } = useCohorts();
  const navigate = useNavigate();

  const navItems = cohortId
    ? [
        { path: `/educator/${cohortId}`, label: 'Overview', end: true },
        { path: `/educator/${cohortId}/weakness`, label: 'Structure weakness' },
        { path: `/educator/${cohortId}/confusion`, label: 'Confusion pairs' },
        { path: `/educator/${cohortId}/students`, label: 'Students' },
        { path: `/educator/${cohortId}/assignments`, label: 'Assignments' },
      ]
    : [];

  return (
    <>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 25, letterSpacing: '-0.018em' }}>
        MSK Atlas
      </div>
      <div
        className="mt-1"
        style={{ font: '500 11px/1 var(--font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink3)' }}
      >
        Educator
      </div>

      {!loading && cohorts && cohorts.length > 1 && (
        <select
          value={cohortId ?? ''}
          onChange={(e) => navigate(`/educator/${e.target.value}`)}
          className="mt-4"
          style={{
            font: '500 13px/1 var(--font-ui)',
            color: 'var(--ink)',
            background: 'var(--pg)',
            border: '1.2px solid var(--line)',
            borderRadius: 3,
            padding: '7px 8px',
          }}
        >
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {!loading && cohorts && cohorts.length === 1 && (
        <div className="mt-4 truncate" style={{ font: '500 14px/1 var(--font-ui)', color: 'var(--ink2)' }}>
          {cohorts[0].name}
        </div>
      )}

      <nav className="mt-8 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className="rounded-[3px] px-3.5 py-2.5 text-left transition-colors"
            style={({ isActive }) => ({
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              display: 'block',
              textDecoration: 'none',
              background: isActive ? 'var(--accs)' : 'transparent',
              color: isActive ? 'var(--accd)' : 'var(--ink2)',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1" />
      <Link
        to="/"
        className="mt-6 border-t pt-4"
        style={{ borderColor: 'var(--line)', font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)', textDecoration: 'none' }}
      >
        ← Back to app
      </Link>
    </>
  );
}
