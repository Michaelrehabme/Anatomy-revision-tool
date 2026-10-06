import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { focusHeadingIfLost } from '../../anatomy-revision/components/shared/useRouteFocus';

interface TeachingAccessPanelProps {
  /** The classes this account already owns, by name. Empty for someone who has never made one. */
  classNames?: readonly string[];
  /** The visitor has no account yet (a guest): the plans page will ask for one first. */
  guest?: boolean;
  /** Inside the account screen's Teaching block: smaller, and no page heading to steal focus. */
  compact?: boolean;
  /** The check could not be made. Says so instead of "you need full access". */
  failed?: boolean;
}

/**
 * "Teaching tools need full access" — shown in place of the class form and
 * the educator screens to an account that may not teach
 * (lib/teachingAccess.ts).
 *
 * CALM ON PURPOSE. The person most likely to read this is an educator whose
 * subscription lapsed over the summer and who has thirty students in a class.
 * The first thing they need to know is that nothing has been taken: the
 * classes are theirs, the students are still in them, and it all opens again
 * with full access. So that is said before the way to the plans, and there is
 * no lock, no warning colour and no count of what they cannot see.
 *
 * It promises nothing the rules do not keep: an owner whose access has lapsed
 * can still read every document of their classes (firestore.rules), so "kept"
 * is a fact about the database, not a hope.
 */
export function TeachingAccessPanel({ classNames = [], guest = false, compact = false, failed = false }: TeachingAccessPanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!compact) focusHeadingIfLost(heading.current);
  }, [compact]);

  const size = compact ? 13.5 : 15;
  const text = { font: `400 ${size}px/1.6 var(--font-ui)`, color: 'var(--ink2)' } as const;
  const kept =
    classNames.length === 0
      ? null
      : classNames.length === 1
        ? `Your class, ${classNames[0]}, is kept exactly as it is, and your students are still in it.`
        : `Your ${classNames.length} classes are kept exactly as they are, and your students are still in them.`;

  if (failed) {
    return (
      <div role="status" style={{ maxWidth: 520 }}>
        <p style={text}>
          We could not check this account&apos;s access just now. Nothing has changed: check your connection and
          open this page again.
        </p>
      </div>
    );
  }

  const Title = compact ? 'div' : 'h1';

  return (
    <div style={{ maxWidth: 520 }}>
      <Title
        ref={heading as never}
        tabIndex={compact ? undefined : -1}
        className="outline-none"
        style={
          compact
            ? { font: `600 ${size + 1}px/1.35 var(--font-ui)`, color: 'var(--ink)', margin: 0 }
            : { fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 34, lineHeight: 1.12, letterSpacing: '-.02em', margin: 0, color: 'var(--ink)' }
        }
      >
        Teaching tools need full access
      </Title>

      {kept && (
        <p className={compact ? 'mt-1.5' : 'mt-4'} style={text}>
          {kept} They open again as soon as this account has full access.
        </p>
      )}
      <p className={compact ? 'mt-1.5' : 'mt-3'} style={text}>
        Creating a class, setting work and the class screens come with full access: a subscription, or a licence
        or complimentary account arranged with LocusMSK.
        {guest && ' You will be asked to create a free account first.'}
      </p>

      <div className={`${compact ? 'mt-3' : 'mt-6'} flex flex-wrap items-center gap-4`}>
        <Link
          to="/pricing"
          className="inline-flex items-center rounded-[3px] px-4"
          style={{
            minHeight: 44,
            font: `500 ${compact ? 13.5 : 14.5}px/1 var(--font-ui)`,
            background: compact ? 'var(--accs)' : 'var(--acc-fill)',
            color: compact ? 'var(--accd)' : 'var(--onacc)',
            textDecoration: 'none',
          }}
        >
          See the plans
        </Link>
        {!compact && (
          <Link to="/account" className="inline-flex items-center" style={{ minHeight: 44, font: '400 14px/1 var(--font-ui)', color: 'var(--ink3)' }}>
            Back to your account
          </Link>
        )}
      </div>
    </div>
  );
}
