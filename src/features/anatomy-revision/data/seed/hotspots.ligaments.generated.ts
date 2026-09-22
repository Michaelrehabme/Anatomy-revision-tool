/**
 * GENERATED FILE — do not edit by hand. Every ligament hotspot, for SCRIPTS.
 * The app never imports this: seed/hotspots.ts loads each group as its own
 * chunk, because together they are past the 2 MiB precache limit.
 */
import type { HotspotPolygon } from '../../types/image';
import { LIGAMENT_HOTSPOTS_PART as upper } from './hotspots.ligaments.upper.generated';
import { LIGAMENT_HOTSPOTS_PART as hand } from './hotspots.ligaments.hand.generated';
import { LIGAMENT_HOTSPOTS_PART as hip } from './hotspots.ligaments.hip.generated';
import { LIGAMENT_HOTSPOTS_PART as knee } from './hotspots.ligaments.knee.generated';
import { LIGAMENT_HOTSPOTS_PART as foot } from './hotspots.ligaments.foot.generated';
import { LIGAMENT_HOTSPOTS_PART as footTilt } from './hotspots.ligaments.footTilt.generated';
import { LIGAMENT_HOTSPOTS_PART as axial } from './hotspots.ligaments.axial.generated';

export const LIGAMENT_HOTSPOTS: Record<string, HotspotPolygon[]> = { ...upper, ...hand, ...hip, ...knee, ...foot, ...footTilt, ...axial };
