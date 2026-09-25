/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with publishMusclePlates.ts.
 *
 * One lazily loaded chunk per part, keyed the way seed/hotspots.ts wants them.
 * Generated rather than typed because how many parts an area needs depends on
 * how much traces, which changes with every render.
 */
import type { HotspotPolygon } from '../../types/image';

export const MUSCLE_HOTSPOT_SETS: Record<string, () => Promise<Record<string, HotspotPolygon[]>>> = {
  musclesShoulder1: () => import('./hotspots.muscles.shoulder-1.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesShoulder2: () => import('./hotspots.muscles.shoulder-2.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesElbow: () => import('./hotspots.muscles.elbow.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesWristHand1: () => import('./hotspots.muscles.wrist-hand-1.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesWristHand2: () => import('./hotspots.muscles.wrist-hand-2.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesHip1: () => import('./hotspots.muscles.hip-1.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesHip2: () => import('./hotspots.muscles.hip-2.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesKnee: () => import('./hotspots.muscles.knee.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesAnkleFoot1: () => import('./hotspots.muscles.ankle-foot-1.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesAnkleFoot2: () => import('./hotspots.muscles.ankle-foot-2.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesSpine1: () => import('./hotspots.muscles.spine-1.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesSpine2: () => import('./hotspots.muscles.spine-2.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesTorso: () => import('./hotspots.muscles.torso.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
  musclesNeck: () => import('./hotspots.muscles.neck.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),
};
