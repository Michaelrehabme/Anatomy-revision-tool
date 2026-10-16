/**
 * THE LIGAMENTS ASKED WITH A PICTURE (owner's decision, 16 October 2026).
 *
 * "Having tap to locate / identify questions for ligaments with high injury
 * rates is very important but not so much for the intricate ones." The small
 * carpal, tarsal and intermetacarpal ligaments were asked as taps on pictures
 * where the target was a few pixels across, and on those the question was
 * really "which joint is this", asked badly. In rehab it is the ligaments that
 * get injured that a student has to find.
 *
 * A ligament on this list is asked with a picture: tap to locate, name the
 * highlighted ligament, describe where it is. Every other ligament keeps its
 * written questions, its flashcards and its picture in the Atlas, and is not
 * asked from a picture. The list is the owner's, approved as proposed; edit it
 * here and nowhere else.
 *
 * Grouped notes: the deltoid ligament is asked as its three parts, which is
 * how the app holds it; the thumb's ulnar collateral ligament (skier's thumb)
 * is inside the grouped collateral metacarpophalangeal ligaments.
 */
export const CLINICAL_LIGAMENTS: ReadonlySet<string> = new Set([
  // Ankle and foot
  'anterior-talofibular-ligament',
  'calcaneofibular-ligament',
  'posterior-talofibular-ligament',
  'tibionavicular-ligament',
  'tibiocalcaneal-ligament',
  'posterior-tibiotalar-ligament',
  'anterior-tibiofibular-ligament',
  'posterior-tibiofibular-ligament',
  'interosseous-membrane-of-leg',
  'plantar-calcaneonavicular-ligament',
  'cuneometatarsal-interosseous-ligaments',
  'plantar-fascia',
  'achilles-tendon',
  // Knee
  'anterior-cruciate-ligament',
  'posterior-cruciate-ligament',
  'superficial-part-of-tibial-collateral-ligament',
  'deep-part-of-tibial-collateral-ligament',
  'fibular-collateral-ligament',
  'medial-meniscus',
  'lateral-meniscus',
  'patellar-ligament',
  'popliteofibular-ligament',
  'iliotibial-band',
  // Hip and groin
  'iliofemoral-ligament',
  'ischiofemoral-ligament',
  'pubofemoral-ligament',
  'acetabular-labrum',
  'inguinal-ligament',
  // Shoulder
  'glenoid-labrum',
  'superior-glenohumeral-ligament',
  'middle-glenohumeral-ligament',
  'inferior-glenohumeral-ligament',
  'coracohumeral-ligament',
  'coraco-acromial-ligament',
  'acromioclavicular-ligament',
  'conoid-ligament',
  'trapezoid-ligament',
  // Elbow
  'ulnar-collateral-ligament',
  'radial-collateral-ligament',
  'annular-ligament-of-radius',
  // Wrist and hand
  'scapholunate-interosseous-ligament',
  'flexor-retinaculum',
  'collateral-metacarpophalangeal-ligaments',
  // Spine and pelvis
  'anterior-longitudinal-ligament',
  'posterior-longitudinal-ligament',
  'ligamenta-flava',
  'supraspinous-ligament',
  'interspinous-ligaments',
  'sacrotuberous-ligament',
  'sacrospinous-ligament',
  'anterior-sacro-iliac-ligament',
  'posterior-sacro-iliac-ligament',
  'interosseous-sacro-iliac-ligament',
]);

/** False for a structure the seed marks as not asked from a picture (see data/seed/index.ts). */
export function askedWithPicture(structure: { eligibility: { picture?: boolean } }): boolean {
  return structure.eligibility.picture !== false;
}
