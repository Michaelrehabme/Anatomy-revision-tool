import type { AnatomyImageAsset } from '../../types/image';
import { ImageViewer } from './ImageViewer';

/**
 * A prompt picture the student can turn and zoom but not answer on.
 *
 * It used to be a flat <img>, deliberately — "non-interactive image display for
 * flashcards/MCQ prompts". That was the wrong distinction. Not being able to
 * ANSWER on a picture is not a reason not to be able to LOOK at it properly,
 * and a flashcard showing a plate from one fixed angle is asking the student to
 * recognise a structure from whichever side the renderer happened to pick.
 *
 * `frames` is what makes it turnable; without it the viewer draws no turn
 * controls and this is the flat picture it always was.
 */
export function AnatomyImageFigure({ image, alt, frames }: {
  image: AnatomyImageAsset;
  alt: string;
  frames?: AnatomyImageAsset[];
}) {
  return <ImageViewer image={image} frames={frames} resetKey={`${image.id}|${alt}`} />;
}
