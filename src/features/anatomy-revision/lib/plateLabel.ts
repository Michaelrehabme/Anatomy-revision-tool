import type { AnatomyImageAsset } from '../types/image';
import { rotationAngle } from './rotationFrames';

/**
 * Which half of a picture is the answer to the question it is shown with:
 * 'name' on an identify question, 'place' on a locate question. Absent once
 * the question has been answered, and anywhere the picture is not a question.
 */
export type PlateConceal = 'name' | 'place';

/**
 * The short accessible name of an anatomy picture.
 *
 * A plate's `slideTitle` begins with its subject — "Deltoid — Anterolateral
 * View (highlighted)" — and that was the viewer's accessible name on every
 * screen, including the two that ask "Which structure is shown?". A screen
 * reader read the answer out before the question (found by the keyboard and
 * names pass of 4 October 2026). So the name of a picture whose subject is the
 * answer is built from the view alone.
 *
 * A locate picture keeps its title: the prompt has already named the
 * structure, and it is where it is, not what it is called, that is asked.
 *
 * This is deliberately separate from lib/plateDescription.ts, which is loaded
 * on demand. The name is needed on first paint, and is a few lines.
 */
export function plateLabel(image: AnatomyImageAsset, conceal?: PlateConceal): string {
  if (conceal !== 'name') return image.slideTitle ?? 'Anatomy image';
  // A card panel's `view` is nominal (several views sit side by side), so it is not quoted.
  if (image.id.startsWith('panel-')) return 'Anatomy image';
  const angle = rotationAngle(image.id);
  return `Anatomy image — ${image.view} view${angle ? `, ${angle}°` : ''}`;
}
