import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useCohorts } from '../CohortsProvider';
import { educatorNavItems } from './educatorNav';

/**
 * The educator section below 1024px.
 *
 * AppShell — which EducatorShell uses on desktop — is a fixed 260px sidebar
 * beside the content and is documented desktop-only. On a 375px phone that
 * sidebar plus EducatorShell's px-16 left almost nothing for the screen
 * itself, so /educator was effectively unusable on the device a course leader
 * is most likely to open an emailed link on.
 *
 * A responsive shell rather than a parallel Mobile* screen tree (the pattern
 * the student side uses): the student screens differ by design between
 * desktop and mobile, whereas every educator screen is a table or a list that
 * reflows on its own once it is given the width. The shell was the whole
 * problem, so the shell is the whole fix.
 *
 * Nav sits in a horizontally scrollable strip rather than a bottom tab bar:
 * there are five sections with long labels ("Structure weakness"), and they
 * are a section index rather than the four top-level destinations MobileTabBar
 * exists for.
 */
export function EducatorMobileShell({ children }: { children: ReactNode }) {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { cohorts, loading } = useCohorts();
  const navigate = useNavigate();
  const navItems = educatorNavItems(cohortId);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      <header className="flex-none px-4 pt-4 pb-2" style={{ background: 'var(--sf)' }}>
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 19, letterSpacing: '-0.018em' }}>
              MSK Atlas
            </span>
            <span
              style={{
                font: '500 10px/1 var(--font-mono)',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--ink3)',
              }}
            >
              Educator
            </span>
          </div>
          <Link to="/" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)', textDecoration: 'none' }}>
            ← App
          </Link>
        </div>

        {/* Only once a class is open: on /educator itself the screen IS the
            class list, and a picker directly above it says the same thing twice. */}
        {!loading && cohortId && cohorts && cohorts.length > 1 && (
          <select
            value={cohortId}
            onChange={(e) => navigate(`/educator/${e.target.value}`)}
            className="mt-3 w-full"
            style={{
              font: '500 14px/1 var(--font-ui)',
              color: 'var(--ink)',
              background: 'var(--pg)',
              border: '1.2px solid var(--line)',
              borderRadius: 3,
              // 44px so the switcher is a comfortable tap target, not a
              // desktop select shrunk onto a phone.
              minHeight: 44,
              padding: '10px 8px',
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
          <div className="mt-2 truncate" style={{ font: '500 15px/1.2 var(--font-ui)', color: 'var(--ink2)' }}>
            {cohorts[0].name}
          </div>
        )}

        {navItems.length > 0 && (
          <nav
            className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-1"
            // The strip scrolls rather than wrapping, so the header keeps a
            // predictable height whatever the labels are.
            style={{ scrollbarWidth: 'none' }}
          >
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className="flex flex-none items-center rounded-[3px] px-3"
                style={({ isActive }) => ({
                  fontFamily: 'var(--font-display)',
                  fontSize: 15,
                  minHeight: 40,
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                  background: isActive ? 'var(--accs)' : 'transparent',
                  color: isActive ? 'var(--accd)' : 'var(--ink2)',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6">{children}</main>

      <div className="flex-none border-t px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--sf)' }}>
        <Link
          to="/educator/new"
          className="flex items-center"
          style={{ fontFamily: 'var(--font-display)', fontSize: 16, minHeight: 44, color: 'var(--accd)', textDecoration: 'none' }}
        >
          + New class
        </Link>
      </div>
    </div>
  );
}
