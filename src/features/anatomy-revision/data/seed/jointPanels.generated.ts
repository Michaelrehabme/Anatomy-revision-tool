import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishJointPanels.ts
 *
 * One row per file in public/anatomy/joints/. Dimensions are measured from the
 * images themselves, for the same reason panels.generated.ts measures its own:
 * they become the CSS aspect-ratio of the box the student clicks in, and a box
 * that does not match the image 1:1 normalises every click to the wrong point.
 */
export interface JointPanel {
  structureId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  width: number;
  height: number;
}

export const JOINT_PANELS: JointPanel[] = [
  { structureId: 'acromioclavicular-joint', name: "Acromioclavicular Joint", region: 'shoulder-arm', subregion: 'shoulder', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'acromioclavicular-joint', name: "Acromioclavicular Joint", region: 'shoulder-arm', subregion: 'shoulder', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'atlantoaxial-joint', name: "Atlantoaxial Joint", region: 'back-core', subregion: 'neck', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'atlantoaxial-joint', name: "Atlantoaxial Joint", region: 'back-core', subregion: 'neck', view: 'lateral', width: 1400, height: 1400 },
  { structureId: 'atlantoaxial-joint', name: "Atlantoaxial Joint", region: 'back-core', subregion: 'neck', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'carpometacarpal-joint-thumb', name: "Carpometacarpal Joint of Thumb", region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'carpometacarpal-joint-thumb', name: "Carpometacarpal Joint of Thumb", region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'costovertebral-joint', name: "Costovertebral Joint", region: 'back-core', subregion: 'spine', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'costovertebral-joint', name: "Costovertebral Joint", region: 'back-core', subregion: 'spine', view: 'lateral', width: 1400, height: 1400 },
  { structureId: 'costovertebral-joint', name: "Costovertebral Joint", region: 'back-core', subregion: 'spine', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'distal-radioulnar-joint', name: "Distal Radioulnar Joint", region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'distal-radioulnar-joint', name: "Distal Radioulnar Joint", region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'distal-tibiofibular-joint', name: "Distal Tibiofibular Joint", region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'distal-tibiofibular-joint', name: "Distal Tibiofibular Joint", region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'glenohumeral-joint', name: "Glenohumeral Joint", region: 'shoulder-arm', subregion: 'shoulder', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'glenohumeral-joint', name: "Glenohumeral Joint", region: 'shoulder-arm', subregion: 'shoulder', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'humeroradial-joint', name: "Humeroradial Joint", region: 'shoulder-arm', subregion: 'elbow', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'humeroradial-joint', name: "Humeroradial Joint", region: 'shoulder-arm', subregion: 'elbow', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'humeroulnar-joint', name: "Humeroulnar Joint", region: 'shoulder-arm', subregion: 'elbow', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'humeroulnar-joint', name: "Humeroulnar Joint", region: 'shoulder-arm', subregion: 'elbow', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'metacarpophalangeal-joint', name: "Metacarpophalangeal Joint", region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'metacarpophalangeal-joint', name: "Metacarpophalangeal Joint", region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'metatarsophalangeal-joint', name: "Metatarsophalangeal Joint", region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'metatarsophalangeal-joint', name: "Metatarsophalangeal Joint", region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'patellofemoral-joint', name: "Patellofemoral Joint", region: 'hip-thigh', subregion: 'knee', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'patellofemoral-joint', name: "Patellofemoral Joint", region: 'hip-thigh', subregion: 'knee', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'proximal-radioulnar-joint', name: "Proximal Radioulnar Joint", region: 'shoulder-arm', subregion: 'elbow', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'proximal-radioulnar-joint', name: "Proximal Radioulnar Joint", region: 'shoulder-arm', subregion: 'elbow', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'proximal-tibiofibular-joint', name: "Proximal Tibiofibular Joint", region: 'lower-leg-foot', subregion: 'knee', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'proximal-tibiofibular-joint', name: "Proximal Tibiofibular Joint", region: 'lower-leg-foot', subregion: 'knee', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'radiocarpal-joint', name: "Radiocarpal Joint", region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'radiocarpal-joint', name: "Radiocarpal Joint", region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'subtalar-joint', name: "Subtalar Joint", region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'posterior', width: 1400, height: 1400 },
  { structureId: 'tibiofemoral-joint', name: "Tibiofemoral Joint", region: 'hip-thigh', subregion: 'knee', view: 'anterior', width: 1400, height: 1400 },
  { structureId: 'tibiofemoral-joint', name: "Tibiofemoral Joint", region: 'hip-thigh', subregion: 'knee', view: 'posterior', width: 1400, height: 1400 },
];
