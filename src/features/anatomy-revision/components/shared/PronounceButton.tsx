import { canPronounce, pronounce, type PronounceableStructure } from '../../lib/pronunciation';

interface PronounceButtonProps {
  structure: PronounceableStructure;
  size?: number;
}

/**
 * Speaker icon that plays a structure's name — Web Speech API by default, a
 * hand-recorded audioUrl when one exists (see lib/pronunciation.ts). Renders
 * nothing when neither is available, per CR-011 ("hide the button rather
 * than erroring") — there is deliberately no disabled/greyed-out state.
 */
export function PronounceButton({ structure, size = 20 }: PronounceButtonProps) {
  if (!canPronounce(structure)) return null;

  return (
    <button
      type="button"
      onClick={() => pronounce(structure)}
      aria-label={`Pronounce ${structure.name}`}
      title="Pronounce"
      className="inline-flex items-center justify-center rounded-full border-0 bg-transparent p-1"
      style={{ color: 'var(--accd)', lineHeight: 0 }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 9v6h4l5 5V4L8 9H4Z"
          fill="currentColor"
        />
        <path
          d="M16.5 8.5a5 5 0 0 1 0 7"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <path
          d="M19 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          opacity={0.6}
        />
      </svg>
    </button>
  );
}
