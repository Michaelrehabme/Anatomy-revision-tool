/**
 * GENERATED FILE — do not edit by hand. Every muscle hotspot, for SCRIPTS.
 * The app never imports this: seed/hotspots.ts loads each part as its own
 * chunk, because together they are far past the 2 MiB precache limit.
 */
import type { HotspotPolygon } from '../../types/image';
import { MUSCLE_HOTSPOTS_PART as shoulder1 } from './hotspots.muscles.shoulder-1.generated';
import { MUSCLE_HOTSPOTS_PART as shoulder2 } from './hotspots.muscles.shoulder-2.generated';
import { MUSCLE_HOTSPOTS_PART as elbow } from './hotspots.muscles.elbow.generated';
import { MUSCLE_HOTSPOTS_PART as wristHand1 } from './hotspots.muscles.wrist-hand-1.generated';
import { MUSCLE_HOTSPOTS_PART as wristHand2 } from './hotspots.muscles.wrist-hand-2.generated';
import { MUSCLE_HOTSPOTS_PART as hip1 } from './hotspots.muscles.hip-1.generated';
import { MUSCLE_HOTSPOTS_PART as hip2 } from './hotspots.muscles.hip-2.generated';
import { MUSCLE_HOTSPOTS_PART as knee } from './hotspots.muscles.knee.generated';
import { MUSCLE_HOTSPOTS_PART as ankleFoot1 } from './hotspots.muscles.ankle-foot-1.generated';
import { MUSCLE_HOTSPOTS_PART as ankleFoot2 } from './hotspots.muscles.ankle-foot-2.generated';
import { MUSCLE_HOTSPOTS_PART as spine1 } from './hotspots.muscles.spine-1.generated';
import { MUSCLE_HOTSPOTS_PART as spine2 } from './hotspots.muscles.spine-2.generated';
import { MUSCLE_HOTSPOTS_PART as torso } from './hotspots.muscles.torso.generated';
import { MUSCLE_HOTSPOTS_PART as neck } from './hotspots.muscles.neck.generated';

export const MUSCLE_HOTSPOTS: Record<string, HotspotPolygon[]> = { ...shoulder1, ...shoulder2, ...elbow, ...wristHand1, ...wristHand2, ...hip1, ...hip2, ...knee, ...ankleFoot1, ...ankleFoot2, ...spine1, ...spine2, ...torso, ...neck };
