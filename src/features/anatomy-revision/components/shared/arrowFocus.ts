import type { KeyboardEvent } from 'react';

/**
 * Arrow keys move focus between the answer options in a group — the movement
 * people expect from a set of choices — without choosing one. Choosing stays
 * on Enter or Space: on the phone, choosing an option submits it, so an arrow
 * that also selected would answer the question by accident.
 */
export function moveFocusWithArrows(event: KeyboardEvent<HTMLElement>): void {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
  if (!step) return;
  const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const at = options.indexOf(document.activeElement as HTMLButtonElement);
  if (at === -1 || options.length === 0) return;
  event.preventDefault();
  options[(at + step + options.length) % options.length].focus();
}
