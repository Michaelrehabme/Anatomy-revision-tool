import { absorbSeenTours, type TourKey } from '../../anatomy-revision/lib/tours';

/**
 * Demo-mode stand-in for anatomy-revision/data/tourRepository.ts.
 *
 * The real module imports firebase/firestore at the top level, and the tour
 * overlay (a shared component on every main screen) and the account screen's
 * "Replay the tours" import it unconditionally, so without this alias the
 * whole Firebase client would land in the public demo bundle.
 *
 * In the demo the record stays on the device, which is what the real module
 * does in local mode anyway.
 */

export function saveSeenTour(key: TourKey): void {
  void key;
}

export function syncSeenTours(stored: unknown): void {
  absorbSeenTours(stored);
}

export function clearSeenTours(): void {}
