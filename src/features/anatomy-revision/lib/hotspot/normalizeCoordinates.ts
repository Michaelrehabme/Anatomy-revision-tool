/**
 * Maps a pointer/click event to normalized [0,1] coordinates against the
 * *rendered* box of the element it fired on.
 *
 * IMPORTANT: this is only correct if the image element fills its box 1:1
 * (no letterboxing). HotspotImage.tsx enforces this by sizing the wrapper
 * via CSS `aspect-ratio` derived from AnatomyImageAsset.width/height, rather
 * than trying to correct for `object-fit: contain` letterboxing here — that
 * correction is easy to get subtly wrong, whereas guaranteeing a 1:1 box is
 * simple and robust.
 */
export function normalizePointerEvent(
  event: { clientX: number; clientY: number },
  element: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } },
): [number, number] {
  const rect = element.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  return [clamp01(x), clamp01(y)];
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
