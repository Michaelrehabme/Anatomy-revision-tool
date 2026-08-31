import musclesRaw from '../source/muscles.raw.json';
import ta2Raw from '../source/ta2-mapping.raw.json';
import type { MuscleStructure, NerveRef } from '../../types/structure';
import type { Region, SubRegion } from '../../types/region';

/**
 * All 122 muscles, generated from Downloads/muscles.json + ta2-mapping.json
 * (copied verbatim into data/source/*.raw.json) rather than hand-typed —
 * this is a transform, not a seed literal, specifically to eliminate
 * transcription risk at this volume and stay in sync if the source files
 * are ever regenerated. See README "Adding a new structure" for the
 * update workflow.
 *
 * Fields with no equivalent in the source data (imageIds, eligibility,
 * difficulty, tags) are derived below rather than hand-maintained:
 * - imageIds: left empty here, populated by lib/linkImages.ts in index.ts
 *   by matching this muscle's name/aliases against every image's
 *   panelStructureNames.
 * - difficulty: no principled per-muscle signal exists in the source data,
 *   so every generated muscle defaults to 'medium' — adjust individual
 *   entries by hand later if you want finer-grained difficulty tiers.
 * - tags: reuses the source `groups` array.
 */

interface RawMuscleEntry {
  id: string;
  name: string;
  latin: string | null;
  region: string;
  groups: string[];
  partOf: string | null;
  origin: string[];
  insertion: string[];
  nerve: NerveRef[];
  actions: string[];
  actionText: string;
  clinical: string | null;
  notes: string | null;
  needsReview: boolean;
  nerveInferred: boolean;
  source: { deck?: string; author?: string; slides?: number[] } | null;
}

interface RawTa2Entry {
  id: string;
  ta2_english?: string;
  ta2_latin?: string;
}

const RAW_MUSCLES = (musclesRaw as unknown as { muscles: RawMuscleEntry[] }).muscles;
const TA2_BY_ID = new Map(
  (ta2Raw as unknown as { mapping: RawTa2Entry[] }).mapping.map((entry) => [entry.id, entry]),
);

/**
 * Best-effort region -> subregion heuristic from the muscle's `groups`
 * keywords. Not authoritative — the source data has no explicit subregion
 * field, so this is a reasonable default, not a guarantee. Override
 * individual entries by hand if one lands wrong.
 */
function inferSubregion(region: string, groups: string[]): SubRegion | undefined {
  const g = groups.join(' ').toLowerCase();

  switch (region) {
    case 'shoulder-arm':
      return /elbow/.test(g) ? 'elbow' : 'shoulder';
    case 'forearm-hand':
      return /elbow/.test(g) ? 'elbow' : 'wrist-hand';
    case 'hip-thigh':
      return /knee|quad|hamstring/.test(g) ? 'knee' : 'hip';
    case 'lower-leg-foot':
      return /knee|popliteus/.test(g) ? 'knee' : 'ankle-foot';
    case 'back-core':
      if (/neck|cervical/.test(g)) return 'neck';
      if (/abdom|core|pelvic-floor|pelvic/.test(g)) return 'torso';
      return 'spine';
    default:
      return undefined;
  }
}

/**
 * Handful of known aliases the source data can't derive on its own —
 * mostly cases where an atlas image splits/labels a muscle more finely
 * than muscles.json does. Found by cross-checking every atlas
 * panelStructureNames entry against the generated structures (see the
 * project's content-expansion review); NOT a general-purpose mechanism,
 * just a short, documented list. Muscles referenced by an atlas panel but
 * absent from muscles.json entirely (e.g. gemelli, psoas minor,
 * subclavius, coccygeus, levator ani, articularis genus, "Iliopsoas" as a
 * combined entity) are NOT patched here — that's a real content gap in the
 * source dataset, not a naming mismatch, and adding invented muscle data
 * to satisfy a panel label would be worse than leaving it unlinked.
 */
const EXTRA_ALIASES: Record<string, string[]> = {
  // muscles.json has one combined "Semispinalis" entry; the neck/back atlas
  // slide splits it into three regionally-highlighted panels.
  semispinalis: ['Semispinalis capitis', 'Semispinalis cervicis', 'Semispinalis thoracis'],
};

/**
 * These 9 muscles end up with imageIds.length === 0 after linkImages() —
 * verified (CR-013) not to be a naming mismatch, since no atlas slide's
 * panelStructureNames cover them at all. Two new slides would close the gap:
 * - Deep neck muscles: sternocleidomastoid, scalene-anterior, scalene-middle,
 *   scalene-posterior, longus-colli, longus-capitis
 * - Respiratory / thoracic wall muscles: diaphragm, external-intercostals,
 *   internal-intercostals
 * Once produced, add matching panelStructureNames to images.seed.ts and
 * these link automatically — no changes needed here or in linkImages.ts.
 */

function buildAliases(id: string): string[] {
  const ta2 = TA2_BY_ID.get(id);
  const ta2Aliases = ta2 ? [ta2.ta2_english, ta2.ta2_latin].filter((v): v is string => !!v) : [];
  return [...ta2Aliases, ...(EXTRA_ALIASES[id] ?? [])];
}

/**
 * Readable respellings for all 122 muscles (CR-011) — same pattern as
 * EXTRA_ALIASES above: hand-authored in the transform, not the raw JSON,
 * since muscles.raw.json is a verbatim copy kept in sync with its source
 * (see this file's header comment) and has no equivalent field. Caps mark
 * the stressed syllable, matching the CR's own example
 * ("flexor hallucis longus" -> "FLEK-sor ha-LOO-sis LONG-us").
 */
const PHONETIC_SPELLINGS: Record<string, string> = {
  iliacus: 'il-ee-AK-us',
  'psoas-major': 'SO-as MAY-jor',
  'rectus-femoris': 'REK-tus FEM-or-is',
  sartorius: 'sar-TOR-ee-us',
  'gluteus-maximus': 'GLOO-tee-us MAK-sim-us',
  semitendinosus: 'sem-ee-ten-din-OH-sus',
  semimembranosus: 'sem-ee-mem-bran-OH-sus',
  'biceps-femoris': 'BY-seps FEM-or-is',
  'gluteus-medius': 'GLOO-tee-us MEE-dee-us',
  'gluteus-minimus': 'GLOO-tee-us MIN-im-us',
  'tensor-fasciae-latae': 'TEN-sor FASH-ee-ee LAY-tee',
  'adductor-magnus': 'a-DUK-tor MAG-nus',
  'adductor-longus': 'a-DUK-tor LONG-us',
  'adductor-brevis': 'a-DUK-tor BREV-is',
  pectineus: 'pek-TIN-ee-us',
  gracilis: 'GRAS-il-is',
  piriformis: 'pir-i-FOR-mis',
  gemelli: 'jem-EL-eye',
  'obturator-internus': 'OB-tyoo-ray-tor in-TER-nus',
  'obturator-externus': 'OB-tyoo-ray-tor eks-TER-nus',
  'quadratus-femoris': 'kwod-RAY-tus FEM-or-is',
  'vastus-lateralis': 'VAS-tus lat-er-AH-lis',
  'vastus-medialis': 'VAS-tus mee-dee-AH-lis',
  'vastus-intermedius': 'VAS-tus in-ter-MEE-dee-us',
  popliteus: 'pop-LIT-ee-us',
  supraspinatus: 'soo-pra-spy-NAY-tus',
  infraspinatus: 'in-fra-spy-NAY-tus',
  'teres-minor': 'TER-eez MY-nor',
  subscapularis: 'sub-skap-yoo-LAIR-is',
  deltoid: 'DEL-toyd',
  trapezius: 'tra-PEE-zee-us',
  'levator-scapulae': 'lev-AY-tor SKAP-yoo-lee',
  'rhomboid-minor': 'ROM-boyd MY-nor',
  'rhomboid-major': 'ROM-boyd MAY-jor',
  'serratus-anterior': 'ser-AY-tus an-TEER-ee-or',
  'pectoralis-major': 'pek-tor-AH-lis MAY-jor',
  'pectoralis-minor': 'pek-tor-AH-lis MY-nor',
  'biceps-brachii': 'BY-seps BRAY-kee-eye',
  brachialis: 'bray-kee-AH-lis',
  coracobrachialis: 'kor-a-koh-bray-kee-AH-lis',
  'triceps-brachii': 'TRY-seps BRAY-kee-eye',
  anconeus: 'an-KOH-nee-us',
  'teres-major': 'TER-eez MAY-jor',
  'latissimus-dorsi': 'la-TISS-im-us DOR-sye',
  diaphragm: 'DY-a-fram',
  'external-intercostals': 'eks-TER-nal in-ter-KOS-talz',
  'internal-intercostals': 'in-TER-nal in-ter-KOS-talz',
  sternocleidomastoid: 'ster-noh-kly-doh-MAS-toyd',
  'scalene-anterior': 'SKAY-leen an-TEER-ee-or',
  'scalene-middle': 'SKAY-leen MID-ul',
  'scalene-posterior': 'SKAY-leen pos-TEER-ee-or',
  'splenius-capitis': 'SPLEE-nee-us KAP-it-is',
  'splenius-cervicis': 'SPLEE-nee-us SER-vis-is',
  iliocostalis: 'il-ee-oh-kos-TAH-lis',
  longissimus: 'lon-JISS-im-us',
  spinalis: 'spy-NAH-lis',
  semispinalis: 'sem-ee-spy-NAH-lis',
  multifidus: 'mul-TIF-id-us',
  rotatores: 'roh-ta-TOR-eez',
  interspinales: 'in-ter-spy-NAY-leez',
  intertransversarii: 'in-ter-trans-ver-SAIR-ee-eye',
  'longus-colli': 'LONG-us KOL-eye',
  'longus-capitis': 'LONG-us KAP-it-is',
  'rectus-abdominis': 'REK-tus ab-DOM-in-is',
  'external-oblique': 'eks-TER-nal oh-BLEEK',
  'internal-oblique': 'in-TER-nal oh-BLEEK',
  'transversus-abdominis': 'trans-VER-sus ab-DOM-in-is',
  'quadratus-lumborum': 'kwod-RAY-tus lum-BOR-um',
  'tibialis-anterior': 'tib-ee-AH-lis an-TEER-ee-or',
  'extensor-hallucis-longus': 'eks-TEN-sor ha-LOO-sis LONG-us',
  'extensor-digitorum-longus': 'eks-TEN-sor dij-it-OR-um LONG-us',
  'peroneus-tertius': 'per-oh-NEE-us TER-shus',
  'peroneus-longus': 'per-oh-NEE-us LONG-us',
  'peroneus-brevis': 'per-oh-NEE-us BREV-is',
  gastrocnemius: 'gas-trok-NEE-mee-us',
  soleus: 'SOH-lee-us',
  plantaris: 'plan-TAIR-is',
  'tibialis-posterior': 'tib-ee-AH-lis pos-TEER-ee-or',
  'flexor-digitorum-longus': 'FLEK-sor dij-it-OR-um LONG-us',
  'flexor-hallucis-longus': 'FLEK-sor ha-LOO-sis LONG-us',
  'extensor-digitorum-brevis': 'eks-TEN-sor dij-it-OR-um BREV-is',
  'extensor-hallucis-brevis': 'eks-TEN-sor ha-LOO-sis BREV-is',
  'flexor-digitorum-brevis': 'FLEK-sor dij-it-OR-um BREV-is',
  'abductor-hallucis': 'ab-DUK-tor ha-LOO-sis',
  'abductor-digiti-minimi-foot': 'ab-DUK-tor DIJ-it-eye MIN-im-eye',
  'quadratus-plantae': 'kwod-RAY-tus PLAN-tee',
  'lumbricals-foot': 'LUM-brik-alz',
  'flexor-hallucis-brevis': 'FLEK-sor ha-LOO-sis BREV-is',
  'adductor-hallucis': 'a-DUK-tor ha-LOO-sis',
  'flexor-digiti-minimi-brevis-foot': 'FLEK-sor DIJ-it-eye MIN-im-eye BREV-is',
  'opponens-digiti-minimi-foot': 'oh-POH-nenz DIJ-it-eye MIN-im-eye',
  'dorsal-interossei-foot': 'DOR-sal in-ter-OSS-ee-eye',
  'plantar-interossei': 'PLAN-tar in-ter-OSS-ee-eye',
  'pronator-teres': 'proh-NAY-tor TER-eez',
  'flexor-carpi-radialis': 'FLEK-sor KAR-pye ray-dee-AH-lis',
  'palmaris-longus': 'pal-MAIR-is LONG-us',
  'flexor-carpi-ulnaris': 'FLEK-sor KAR-pye ul-NAIR-is',
  'flexor-digitorum-superficialis': 'FLEK-sor dij-it-OR-um soo-per-fish-ee-AH-lis',
  'flexor-digitorum-profundus': 'FLEK-sor dij-it-OR-um proh-FUN-dus',
  'flexor-pollicis-longus': 'FLEK-sor POL-is-is LONG-us',
  'pronator-quadratus': 'proh-NAY-tor kwod-RAY-tus',
  brachioradialis: 'bray-kee-oh-ray-dee-AH-lis',
  'extensor-carpi-radialis-longus': 'eks-TEN-sor KAR-pye ray-dee-AH-lis LONG-us',
  'extensor-carpi-radialis-brevis': 'eks-TEN-sor KAR-pye ray-dee-AH-lis BREV-is',
  'extensor-digitorum': 'eks-TEN-sor dij-it-OR-um',
  'extensor-digiti-minimi': 'eks-TEN-sor DIJ-it-eye MIN-im-eye',
  'extensor-carpi-ulnaris': 'eks-TEN-sor KAR-pye ul-NAIR-is',
  supinator: 'SOO-pin-ay-tor',
  'abductor-pollicis-longus': 'ab-DUK-tor POL-is-is LONG-us',
  'extensor-pollicis-brevis': 'eks-TEN-sor POL-is-is BREV-is',
  'extensor-pollicis-longus': 'eks-TEN-sor POL-is-is LONG-us',
  'extensor-indicis': 'eks-TEN-sor IN-dis-is',
  'abductor-pollicis-brevis': 'ab-DUK-tor POL-is-is BREV-is',
  'flexor-pollicis-brevis': 'FLEK-sor POL-is-is BREV-is',
  'opponens-pollicis': 'oh-POH-nenz POL-is-is',
  'adductor-pollicis': 'a-DUK-tor POL-is-is',
  'abductor-digiti-minimi-hand': 'ab-DUK-tor DIJ-it-eye MIN-im-eye',
  'flexor-digiti-minimi-brevis-hand': 'FLEK-sor DIJ-it-eye MIN-im-eye BREV-is',
  'opponens-digiti-minimi-hand': 'oh-POH-nenz DIJ-it-eye MIN-im-eye',
  'lumbricals-hand': 'LUM-brik-alz',
  'dorsal-interossei-hand': 'DOR-sal in-ter-OSS-ee-eye',
  'palmar-interossei': 'PAHL-mar in-ter-OSS-ee-eye',
};

/**
 * Clinical layer (CR-010) — same pattern as EXTRA_ALIASES/PHONETIC_SPELLINGS
 * above: hand-authored in the transform, not the raw JSON. Deliberately
 * scoped to a shoulder-arm vertical slice rather than all 122 muscles, and
 * within that slice, only to muscles/fields with genuinely well-established,
 * textbook-accurate content — no invented specifics to fill every field.
 *
 * `myotome` in particular is restricted to muscles actually used in the
 * standard bedside myotome screening exam (C5=deltoid/biceps,
 * C6=biceps/wrist extensors, C7=triceps/wrist flexors, C8=finger flexors,
 * T1=hand intrinsics) — the rotator cuff muscles below have real C5-C6 nerve
 * root contributions but are NOT part of that specific clinical exam
 * convention, so they intentionally have no `myotome` entry here.
 */
type ClinicalContent = Pick<
  MuscleStructure,
  'myotome' | 'dermatomeRelation' | 'palpationNotes' | 'commonInjuries' | 'specialTests' | 'referredPainPattern' | 'functionalContext'
>;

const CLINICAL_CONTENT: Record<string, Partial<ClinicalContent>> = {
  deltoid: {
    myotome: ['C5'],
    dermatomeRelation: 'C5 (lateral upper arm, the "regimental badge" area)',
    palpationNotes: 'Palpate the rounded contour over the lateral shoulder, immediately distal to the acromion; anterior, middle, and posterior fibres are distinguishable with the arm at 90° abduction.',
    commonInjuries: [
      {
        name: 'Axillary nerve injury',
        mechanism: 'Anterior shoulder dislocation or a proximal humeral neck fracture stretching or compressing the axillary nerve.',
        presentation: 'Weak shoulder abduction with sensory loss over the lateral shoulder ("regimental badge" area).',
      },
    ],
    functionalContext: 'Abducting the arm beyond the first ~15°, e.g. reaching overhead or out to the side.',
  },
  supraspinatus: {
    palpationNotes: 'Palpate in the supraspinous fossa, superior to the scapular spine, deep to the upper trapezius.',
    specialTests: [
      {
        name: "Jobe's Test (Empty Can)",
        description: 'Resisted abduction at 90° in the scapular plane with the arm internally rotated (thumbs pointing down).',
        positiveFinding: 'Pain or weakness suggests supraspinatus tendinopathy or tear.',
      },
      {
        name: 'Drop Arm Test',
        description: 'Passively abduct the arm to 90° and ask the patient to slowly lower it under control.',
        positiveFinding: 'Inability to control the descent (the arm drops) suggests a full-thickness supraspinatus tear.',
      },
    ],
    commonInjuries: [
      {
        name: 'Rotator cuff tear',
        mechanism: 'Degenerative tearing from chronic subacromial impingement, or an acute traumatic tear from a fall on an outstretched arm.',
        presentation: 'Painful arc of abduction (roughly 60-120°) and weak initiation of abduction; a full-thickness tear may prevent initiating abduction at all.',
      },
      {
        name: 'Subacromial impingement',
        mechanism: 'Repetitive overhead activity narrowing the subacromial space.',
        presentation: 'Pain with overhead reaching, worse through the painful arc.',
      },
    ],
    referredPainPattern: 'Classically refers pain to the lateral deltoid region and down the lateral arm (Travell & Simons trigger-point pattern).',
    functionalContext: 'Initiating the first ~15° of shoulder abduction before deltoid takes over.',
  },
  infraspinatus: {
    palpationNotes: 'Palpate in the infraspinous fossa, inferior to the scapular spine.',
    specialTests: [
      {
        name: 'Resisted External Rotation Test',
        description: 'With the elbow at the side flexed to 90°, resist the patient externally rotating the forearm.',
        positiveFinding: 'Pain or weakness suggests infraspinatus (or teres minor) pathology.',
      },
    ],
    commonInjuries: [
      {
        name: 'Rotator cuff tear (infraspinatus)',
        mechanism: 'Degenerative tearing or traumatic injury, often alongside supraspinatus.',
        presentation: 'Weak, painful resisted external rotation; a large tear may show a positive external rotation lag sign.',
      },
    ],
    referredPainPattern: 'Classically refers pain to the anterior shoulder and down the lateral arm (Travell & Simons trigger-point pattern).',
    functionalContext: "Externally rotating the shoulder, e.g. reaching behind to fasten a seatbelt or a throw's cocking phase.",
  },
  'teres-minor': {
    palpationNotes: 'Palpate along the lateral border of the scapula, just superior to teres major.',
    specialTests: [
      {
        name: "Hornblower's Sign",
        description: 'Ask the patient to hold the arm at 90° abduction and externally rotate it, bringing the hand toward the mouth.',
        positiveFinding: 'Inability to maintain external rotation (the arm drifts into internal rotation) suggests a significant teres minor/infraspinatus tear.',
      },
    ],
    commonInjuries: [
      {
        name: 'Rotator cuff tear (teres minor)',
        mechanism: 'Usually involved in massive posterosuperior cuff tears alongside infraspinatus, rather than in isolation.',
        presentation: "Weak external rotation, with a positive Hornblower's sign in severe cases.",
      },
    ],
    functionalContext: 'Assists infraspinatus in externally rotating the shoulder and stabilising the humeral head posteriorly.',
  },
  subscapularis: {
    palpationNotes: 'Difficult to palpate directly; approached along the anterior scapular surface within the axilla with the muscle relaxed.',
    specialTests: [
      {
        name: "Lift-Off Test (Gerber's)",
        description: 'With the hand placed on the lower back, ask the patient to lift the hand off the back against resistance.',
        positiveFinding: 'Inability to lift the hand off the back suggests a subscapularis tear.',
      },
      {
        name: 'Belly-Press Test',
        description: 'With the hand pressed flat on the abdomen and the elbow held forward, used when Lift-Off is not possible due to restricted internal rotation range.',
        positiveFinding: 'The elbow drops back or the wrist flexes to compensate, suggesting subscapularis weakness.',
      },
    ],
    commonInjuries: [
      {
        name: 'Subscapularis tear',
        mechanism: 'Traumatic anterior shoulder dislocation or degenerative tearing, often accompanied by biceps tendon subluxation.',
        presentation: 'Weak internal rotation and increased passive external rotation range.',
      },
    ],
    functionalContext: "Internally rotating the shoulder, e.g. tucking in a shirt or a throw's follow-through.",
  },
  'biceps-brachii': {
    myotome: ['C5', 'C6'],
    dermatomeRelation: 'C6 (lateral forearm and thumb)',
    palpationNotes: 'Palpate the anterior arm; the tendon is felt in the cubital fossa, just medial to brachioradialis, with the elbow flexed against resistance.',
    specialTests: [
      {
        name: "Speed's Test",
        description: 'Resisted shoulder flexion with the elbow extended and the forearm supinated.',
        positiveFinding: 'Pain in the bicipital groove suggests biceps tendinopathy.',
      },
      {
        name: "Yergason's Test",
        description: 'With the elbow flexed to 90° and the forearm pronated, resist the patient supinating and externally rotating against resistance.',
        positiveFinding: 'Pain in the bicipital groove suggests biceps tendon pathology or instability.',
      },
    ],
    commonInjuries: [
      {
        name: 'Proximal biceps tendinopathy/tear',
        mechanism: 'Repetitive overhead loading or a sudden eccentric overload.',
        presentation: 'Anterior shoulder pain, sometimes with a "Popeye" deformity if the long head ruptures.',
      },
    ],
    functionalContext: 'Supinating the forearm and flexing the elbow, e.g. turning a key or a screwdriver.',
  },
  'triceps-brachii': {
    myotome: ['C7'],
    dermatomeRelation: 'C7 (middle finger)',
    palpationNotes: 'Palpate the posterior arm; the tendon is easily felt proximal to the olecranon with the elbow extended against resistance.',
    commonInjuries: [
      {
        name: 'Distal triceps tendon rupture',
        mechanism: 'Uncommon; usually a fall onto an outstretched, flexed elbow, or forced flexion against a contracting triceps.',
        presentation: 'Sudden posterior elbow pain, a palpable gap proximal to the olecranon, and weak elbow extension.',
      },
    ],
    functionalContext: 'Extending the elbow, e.g. pushing up from a chair or a press-up.',
  },
  'latissimus-dorsi': {
    palpationNotes: 'Palpate the posterior axillary fold; the muscle bulks noticeably with resisted shoulder extension/adduction, e.g. a pull-down motion.',
    commonInjuries: [
      {
        name: 'Lat strain',
        mechanism: 'Sudden eccentric loading, common in throwing and racquet sports or heavy pulling exercises (e.g. pull-ups).',
        presentation: 'Posterior axillary or lateral chest wall pain, worsened by overhead reaching or resisted adduction/extension.',
      },
    ],
    functionalContext: "Powerful shoulder extension and adduction, e.g. a pull-up, swimming's freestyle pull, or climbing.",
  },
  'pectoralis-major': {
    palpationNotes: 'Palpate the anterior chest wall forming the anterior axillary fold; the clavicular and sternocostal heads are distinguishable by their differing fibre direction.',
    specialTests: [
      {
        name: 'Resisted Horizontal Adduction Test',
        description: 'From 90° shoulder abduction, resist the patient adducting the arm horizontally across the body.',
        positiveFinding: 'Pain or weakness suggests pectoralis major strain or tendon injury.',
      },
    ],
    commonInjuries: [
      {
        name: 'Pectoralis major rupture',
        mechanism: 'Eccentric overload during a bench press, most commonly near full stretch at the bottom of the lift.',
        presentation: 'A sudden tearing sensation, bruising, and a visible/palpable defect in the anterior axillary fold, with weak horizontal adduction.',
      },
    ],
    functionalContext: 'Adducting and internally rotating the arm across the body, e.g. a bench press or a hugging motion.',
  },
};

export const MUSCLE_STRUCTURES: MuscleStructure[] = RAW_MUSCLES.map((m): MuscleStructure => {
  const region = m.region as Region;
  return {
    id: m.id,
    name: m.name,
    category: 'muscle',
    latin: m.latin,
    region,
    subregion: inferSubregion(m.region, m.groups),
    groups: m.groups,
    partOf: m.partOf,
    origin: m.origin,
    insertion: m.insertion,
    nerve: m.nerve,
    actions: m.actions,
    actionText: m.actionText,
    description: m.actionText,
    aliases: buildAliases(m.id),
    imageIds: [],
    // locate: true matches structures.bones.seed.ts's existing convention — eligibility
    // means "this structure type can be located visually", not "hotspot data exists for
    // it yet". locate.ts already skips per-image when hotspots are empty (see CR-007), so
    // this is safe ahead of any single muscle actually having an authored polygon.
    eligibility: { flashcard: true, mcq: true, locate: true },
    difficulty: 'medium',
    tags: m.groups,
    clinical: m.clinical,
    notes: m.notes,
    needsReview: m.needsReview,
    source: m.source,
    phoneticSpelling: PHONETIC_SPELLINGS[m.id],
    ...CLINICAL_CONTENT[m.id],
  };
});
