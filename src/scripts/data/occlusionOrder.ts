/**
 * Per-view muscle lists for each Z-Anatomy regional render, ordered
 * superficial -> deep.
 *
 * Two jobs, and both matter:
 *
 * 1. WHICH muscles are candidates for this view at all. The Blender masks are
 *    solo silhouettes — each muscle is rendered alone — so a muscle facing away
 *    from the camera still produces a full silhouette rather than an empty one.
 *    Listing infraspinatus under an anterior view would put a hotspot over
 *    pectoralis major. Only list muscles genuinely visible from that direction.
 *
 *    Masks ARE bone-occluded (renderRegionsWithBones.py renders the skeleton as
 *    a holdout), so anything hidden behind the tibia, scapula or ribcage is
 *    already gone from the silhouette. Bone is the only non-muscle occluder
 *    modelled; other soft tissue is not, so this list still carries the
 *    judgement about what actually faces the camera.
 *
 * 2. WHAT ORDER they layer in. Overlapping polygons resolve smallest-area-wins
 *    in hitTest, so without subtraction a correct tap on a superficial muscle
 *    gets attributed to a smaller deep one the student cannot see — measured at
 *    56% correct for trapezius before this was applied. masksToHotspots.ts
 *    walks each list in order and subtracts everything already claimed.
 *
 * This is anatomical judgement, not generated data. It is the only hand-authored
 * input to the pipeline. Check it by running the converter and reading the
 * kept/dropped table, then visually in /dev/hotspots.
 *
 * OCCLUSION IS DELIBERATELY PER-REGION. Do not "fix" a list by borrowing a
 * muscle from another region's mask directory. Two independent reasons:
 *
 *   1. Every region has its OWN camera, framed and zoomed to that body part —
 *      back-core fills the frame with the torso, lower-leg-foot with the
 *      calves. A mask rendered under one region's camera is in a different
 *      projection entirely, so subtracting it would carve a wrong-shaped hole.
 *   2. Each region's render contains only its own muscles. Verified by
 *      unioning every frame-12 mask in a region and comparing with that
 *      region's base render: IoU 1.0000 (shoulder-arm, hip-thigh) and 0.9998
 *      (back-core), with under 60 of ~320k base pixels unexplained.
 *
 * So latissimus dorsi genuinely does not cover anything in a back-core view —
 * it is not drawn there. Subtracting it would delete area the student can see.
 */

/** Turntable frame index per view — see region-meta-data in the prototype viewer. */
export const VIEW_FRAMES = {
  anterior: 0,
  lateral: 6,
  posterior: 12,
} as const;

export type ViewName = keyof typeof VIEW_FRAMES;

export const OCCLUSION_ORDER: Record<string, string[]> = {
  // ---------------------------------------------------------------- shoulder
  'region-shoulder-arm-anterior': [
    'pectoralis-major',
    'deltoid',
    'biceps-brachii',
    'triceps-brachii',
    'brachialis',
    'coracobrachialis',
    'serratus-anterior',
    'pectoralis-minor',
    'subscapularis',
  ],
  'region-shoulder-arm-lateral': [
    'deltoid',
    'trapezius',
    'pectoralis-major',
    'latissimus-dorsi',
    'triceps-brachii',
    'biceps-brachii',
    'brachialis',
    'infraspinatus',
    'teres-major',
    'teres-minor',
    'serratus-anterior',
  ],
  'region-shoulder-arm-posterior': [
    'trapezius',
    'latissimus-dorsi',
    'deltoid',
    'triceps-brachii',
    'anconeus',
    'teres-major',
    'teres-minor',
    'infraspinatus',
    'supraspinatus',
    'levator-scapulae',
    'rhomboid-major',
    'rhomboid-minor',
  ],

  // --------------------------------------------------------------- back-core
  'region-back-core-anterior': [
    'rectus-abdominis',
    'external-oblique',
    'sternocleidomastoid',
    'internal-oblique',
    'scalene-anterior',
    'scalene-middle',
    'transversus-abdominis',
    'external-intercostals',
    'internal-intercostals',
  ],
  'region-back-core-lateral': [
    'external-oblique',
    'sternocleidomastoid',
    'rectus-abdominis',
    'internal-oblique',
    'external-intercostals',
    'scalene-posterior',
    'scalene-middle',
    'transversus-abdominis',
  ],
  'region-back-core-posterior': [
    'splenius-capitis',
    'splenius-cervicis',
    'iliocostalis',
    'longissimus',
    'spinalis',
    'semispinalis',
    'quadratus-lumborum',
    'multifidus',
    'rotatores',
    'intertransversarii',
    'interspinales',
  ],

  // --------------------------------------------------------------- hip-thigh
  'region-hip-thigh-anterior': [
    'rectus-femoris',
    'sartorius',
    'tensor-fasciae-latae',
    'vastus-lateralis',
    'vastus-medialis',
    'adductor-longus',
    'gracilis',
    'pectineus',
    'adductor-brevis',
    'iliacus',
    'psoas-major',
    'vastus-intermedius',
  ],
  'region-hip-thigh-lateral': [
    'tensor-fasciae-latae',
    'gluteus-maximus',
    'vastus-lateralis',
    'biceps-femoris',
    'rectus-femoris',
    'gluteus-medius',
    'semitendinosus',
    'vastus-intermedius',
  ],
  'region-hip-thigh-posterior': [
    'gluteus-maximus',
    'biceps-femoris',
    'semitendinosus',
    'semimembranosus',
    'gluteus-medius',
    'adductor-magnus',
    'gracilis',
    'gluteus-minimus',
    'piriformis',
    'gemelli',
    'obturator-internus',
    'quadratus-femoris',
    'obturator-externus',
  ],

  // ---------------------------------------------------------- lower-leg-foot
  'region-lower-leg-foot-anterior': [
    'tibialis-anterior',
    'extensor-digitorum-longus',
    'peroneus-longus',
    'extensor-hallucis-longus',
    'peroneus-brevis',
    'peroneus-tertius',
    'extensor-digitorum-brevis',
    'extensor-hallucis-brevis',
  ],
  'region-lower-leg-foot-lateral': [
    'gastrocnemius',
    'peroneus-longus',
    'soleus',
    'tibialis-anterior',
    'extensor-digitorum-longus',
    'peroneus-brevis',
    'abductor-digiti-minimi-foot',
  ],
  'region-lower-leg-foot-posterior': [
    'gastrocnemius',
    'soleus',
    'plantaris',
    'peroneus-longus',
    'peroneus-brevis',
    'popliteus',
    'flexor-hallucis-longus',
    'flexor-digitorum-longus',
    'tibialis-posterior',
  ],

  // ------------------------------------------------------------ forearm-hand
  'region-forearm-hand-anterior': [
    'brachioradialis',
    'pronator-teres',
    'flexor-carpi-radialis',
    'palmaris-longus',
    'flexor-carpi-ulnaris',
    'flexor-digitorum-superficialis',
    'abductor-pollicis-brevis',
    'flexor-pollicis-brevis',
    'abductor-digiti-minimi-hand',
    'flexor-digitorum-profundus',
    'flexor-pollicis-longus',
    'pronator-quadratus',
    'adductor-pollicis',
    'opponens-pollicis',
    'lumbricals-hand',
  ],
  'region-forearm-hand-lateral': [
    'brachioradialis',
    'extensor-carpi-radialis-longus',
    'extensor-carpi-radialis-brevis',
    'abductor-pollicis-longus',
    'extensor-pollicis-brevis',
    'extensor-digitorum',
    'flexor-carpi-radialis',
    'pronator-teres',
    'extensor-pollicis-longus',
    'supinator',
  ],
  'region-forearm-hand-posterior': [
    'brachioradialis',
    'extensor-carpi-radialis-longus',
    'extensor-carpi-radialis-brevis',
    'extensor-digitorum',
    'extensor-digiti-minimi',
    'extensor-carpi-ulnaris',
    'dorsal-interossei-hand',
    'abductor-pollicis-longus',
    'extensor-pollicis-brevis',
    'extensor-pollicis-longus',
    'extensor-indicis',
    'supinator',
  ],
};

export function regionImageId(region: string, view: ViewName): string {
  return `region-${region}-${view}`;
}
