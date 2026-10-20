import { useStudyProfile } from '../../hooks/useStudyProfile';
import { emptyStudyProfile, isStarred, toggleStar } from '../../lib/studyProfile';

/**
 * Stars a structure for the student's own list (owner, 19 Oct 2026: "My
 * list"). The list lives on the study profile, so it follows the account to
 * another device, and the Atlas filters by it — "Quiz these" then drills
 * exactly the starred structures, with no screen of its own.
 */
export function StarButton({ structureId, name, size = 22 }: { structureId: string; name: string; size?: number }) {
  const { profile, update } = useStudyProfile();
  const on = isStarred(profile, structureId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from your list` : `Add ${name} to your list`}
      title={on ? 'On your list' : 'Add to your list'}
      onClick={() => update((current) => toggleStar(current ?? emptyStudyProfile(), structureId))}
      className="inline-flex flex-none items-center justify-center rounded-full"
      style={{ width: size + 22, height: size + 22, color: on ? 'var(--acc2d)' : 'var(--ink3)', transition: 'color 150ms' }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"
          fill={on ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
