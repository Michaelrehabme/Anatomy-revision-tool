import type { AnatomyImageAsset } from '../../types/image';

/** A ligament plate, by where it is published: renderLigamentPlates.py writes them all there. */
export function isLigamentPlate(image: Pick<AnatomyImageAsset, 'filePath'>): boolean {
  return image.filePath.startsWith('/anatomy/ligaments/');
}

/**
 * Said under a ligament's picture wherever one is still shown, the Atlas and
 * the back of a flashcard (owner, 18 Oct 2026: keep them, "but make a note of
 * them not being good quality images"). They were taken out of the questions
 * on 17 Oct for the same reason. Never on a picture whose name is still the
 * answer: it would say what kind of thing to look for.
 */
export function LigamentPictureNote({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`mt-1.5 ${compact ? 'text-[12.5px]' : 'text-[13px]'} leading-snug`} style={{ color: 'var(--ink3)' }}>
      Rough picture: our ligament models are not yet detailed enough to rely on. Learn it from its attachments.
    </p>
  );
}
