import { useState } from 'react';
import {
  checklistProgress,
  isChecklistItemDone,
  orphanedChecklistTicks,
  sortChecklist,
  walkthroughSteps,
} from '../../lib/checklist';
import { formatDate } from '../../lib/formatDate';
import type { ChecklistItem } from '../../types/changeRequest';

interface ChangeRequestChecklistProps {
  items: ChecklistItem[];
  done: Record<string, string> | undefined;
  onToggle: (itemId: string) => void;
}

const labelStyle = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.14em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

/**
 * The ranked, tickable task list on a change request.
 *
 * Two deliberate choices, both of which this very checklist is partly about
 * (see its accessibility step):
 *
 * - A real <input type="checkbox"> inside a <label>, not a styled div with a
 *   click handler. It is focusable, space-toggles, and announces its own
 *   checked state without an aria-checked we would have to keep in sync.
 * - The walkthrough is a <button aria-expanded> disclosure rather than a
 *   hover-reveal, so it is reachable without a pointer.
 *
 * Unticking asks for a second click because toggling discards the completion
 * timestamp — see lib/checklist.ts. Ticking is immediate; only undo is guarded.
 */
export function ChangeRequestChecklist({ items, done, onToggle }: ChangeRequestChecklistProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmingUntick, setConfirmingUntick] = useState<string | null>(null);

  const ordered = sortChecklist(items);
  const progress = checklistProgress(ordered, done);
  const orphans = orphanedChecklistTicks(ordered, done);

  const handleToggle = (item: ChecklistItem) => {
    if (!isChecklistItemDone(done, item.id)) {
      onToggle(item.id);
      setConfirmingUntick(null);
      return;
    }
    if (confirmingUntick === item.id) {
      onToggle(item.id);
      setConfirmingUntick(null);
    } else {
      setConfirmingUntick(item.id);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <div style={labelStyle}>Checklist</div>
        <div style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--ink2)' }}>
          {progress.completed}/{progress.total} done
        </div>
      </div>

      <div
        className="mt-2.5 h-[3px] w-full overflow-hidden"
        style={{ background: 'var(--line)', borderRadius: 2 }}
        role="progressbar"
        aria-valuenow={progress.completed}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-label="Checklist progress"
      >
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress.fraction * 100}%`, background: 'var(--accd)' }}
        />
      </div>

      {progress.nextUp && (
        <p className="mt-2.5 text-sm" style={{ color: 'var(--ink2)' }}>
          Next up: <strong style={{ color: 'var(--ink)' }}>{progress.nextUp.label}</strong>
        </p>
      )}
      {!progress.nextUp && progress.total > 0 && (
        <p className="mt-2.5 text-sm" style={{ color: 'var(--accd)' }}>
          Everything on this list is ticked.
        </p>
      )}

      {orphans.length > 0 && (
        <p className="mt-2.5 text-xs" style={{ color: 'var(--acc2d)' }}>
          {orphans.length} stored tick{orphans.length === 1 ? '' : 's'} ({orphans.join(', ')}) no longer match a step —
          an id was renamed in the seed. The tick is kept but not counted.
        </p>
      )}

      <ol className="mt-4 flex list-none flex-col gap-0 p-0">
        {ordered.map((item) => {
          const isDone = isChecklistItemDone(done, item.id);
          const isOpen = expanded === item.id;
          const steps = walkthroughSteps(item.walkthrough);
          const confirming = confirmingUntick === item.id;

          return (
            <li key={item.id} style={{ borderTop: '1px solid var(--line)' }}>
              <div className="flex items-start gap-3 py-3.5">
                <label className="flex cursor-pointer items-start gap-3 pt-[1px]">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => handleToggle(item)}
                    className="mt-[3px] h-4 w-4 flex-none cursor-pointer"
                    style={{ accentColor: 'var(--accd)' }}
                  />
                  <span className="sr-only">
                    {isDone ? 'Mark incomplete' : 'Mark complete'}: {item.label}
                  </span>
                </label>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span style={{ font: '500 12px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>{item.rank}.</span>
                    <span
                      style={{
                        font: '400 14.5px/1.4 var(--font-ui)',
                        color: isDone ? 'var(--ink3)' : 'var(--ink)',
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>{item.effort}</span>
                    {isDone && (
                      <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--accd)' }}>
                        ticked {formatDate(done?.[item.id] ?? null)}
                      </span>
                    )}
                    {steps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : item.id)}
                        aria-expanded={isOpen}
                        style={{
                          font: '500 11.5px/1 var(--font-ui)',
                          color: 'var(--accd)',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      >
                        {isOpen ? 'Hide walkthrough' : `Walkthrough (${steps.length} steps)`}
                      </button>
                    )}
                  </div>

                  {confirming && (
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--acc2d)' }}>
                      Click again to untick — this discards the date it was completed.
                    </p>
                  )}

                  {isOpen && (
                    <div
                      className="mt-3 rounded-[3px] p-3.5"
                      style={{ background: 'var(--pg)', border: '1px solid var(--line)' }}
                    >
                      {item.why && (
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink2)' }}>
                          <strong style={{ color: 'var(--ink)' }}>Why this rank. </strong>
                          {item.why}
                        </p>
                      )}
                      <ol className="mt-2.5 flex list-none flex-col gap-1.5 p-0">
                        {steps.map((step, index) => (
                          <li key={index} style={{ font: '400 12.5px/1.65 var(--font-mono)', color: 'var(--ink)' }}>
                            {step}
                          </li>
                        ))}
                      </ol>

                      {item.links && item.links.length > 0 && (
                        <div className="mt-3.5 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
                          <div style={labelStyle}>Links</div>
                          <ul className="mt-1.5 flex list-none flex-col gap-1 p-0">
                            {item.links.map((link) => (
                              <li key={link.url}>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  style={{ font: '400 12.5px/1.5 var(--font-ui)', color: 'var(--accd)' }}
                                >
                                  {link.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
