import type { AnatomyImageAsset } from '../../types/image';
import { ImageViewer } from './ImageViewer';
import type { PlateConceal } from '../../lib/plateLabel';
import { LigamentPictureNote, isLigamentPlate } from './LigamentPictureNote';
import { PromptHighlightOverlay } from './PromptHighlightOverlay';
import { promptHighlightFrames } from '../../lib/promptHighlight';

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
export function AnatomyImageFigure({ image, alt, frames, subjectId, conceal }: {
  image: AnatomyImageAsset;
  alt: string;
  frames?: AnatomyImageAsset[];
  /** Passed to the viewer: the structure shown, and whether its name is still the answer. */
  subjectId?: string;
  conceal?: PlateConceal;
}) {
  // A landmark or joint panel is a plain skeleton with its target stored
  // beside it, so the target is drawn here as the quiz and the Atlas draw it.
  // Without it the obturator foramen's card showed an unmarked pelvis (student
  // report, 16 Oct 2026). Pictures with the target already coloured in carry
  // no hotspot and are untouched.
  const overlay = subjectId ? (current: AnatomyImageAsset) => <PromptHighlightOverlay image={current} structureId={subjectId} /> : undefined;
  // Only the angles where the target is traced, as MCQ and identify offer them.
  const turnable = subjectId && frames ? promptHighlightFrames(frames, subjectId) : frames;
  const viewer = (
    <ImageViewer image={image} frames={turnable} resetKey={`${image.id}|${alt}`} subjectId={subjectId} conceal={conceal} overlay={overlay} />
  );
  // The note says "ligament", so not while the name is still the answer.
  if (!isLigamentPlate(image) || conceal === 'name') return viewer;
  return (
    <div>
      {viewer}
      <LigamentPictureNote />
    </div>
  );
}
