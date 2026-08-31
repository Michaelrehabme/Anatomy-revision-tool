interface PersistErrorBannerProps {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Inline banner for a failed background save (attempt/mastery/session write) — the answer/session already rendered locally, this just tells the student the write didn't stick and offers a retry. */
export function PersistErrorBanner({ message, onRetry, onDismiss }: PersistErrorBannerProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]"
      style={{ background: 'color-mix(in oklab, var(--acc2d) 10%, transparent)', color: 'var(--acc2d)' }}
    >
      <span>{message}</span>
      <div className="flex shrink-0 items-center gap-3">
        <button type="button" onClick={onRetry} className="font-medium underline">
          Retry
        </button>
        <button type="button" onClick={onDismiss} style={{ color: 'var(--ink3)' }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
