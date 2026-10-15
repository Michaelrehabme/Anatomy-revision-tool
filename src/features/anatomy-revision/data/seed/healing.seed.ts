/**
 * How a structure heals, and why its blood supply has a say in it: the cards
 * that replaced the unsourced blood supply questions (owner's decision, 15
 * October 2026).
 *
 * EVERY LINE IS SOURCED, AND EVERY SOURCE WAS READ. Thirty claims were
 * gathered with the sentence that supports each, then checked on 15 October:
 * each sentence is on its page, in the paper's abstract or in its full text;
 * every paper is real, peer reviewed and not retracted; every StatPearls page
 * was updated between 2023 and 2026. The owner approved them on that basis.
 * Review page: https://claude.ai/artifact/XqAjW7TCrhwPrtGgmVuxjC
 *
 * NO ELSEVIER, COMPLETE ANATOMY, IMAIOS OR TEACHMEANATOMY SOURCE, by the
 * owner's rule (src/scripts/lib/provenance.ts enforces it for the rest of the
 * content). Some of the best primary studies are in Elsevier journals and were
 * left out on purpose.
 *
 * CONTESTED MEANS TAUGHT AS CONTESTED. Where the literature disagrees the card
 * says so, and says which way. The ACL above all: it does not heal on its own,
 * but "because it has no blood supply" is not what the evidence says.
 *
 * Healing times are given for TISSUES, never for one structure, because the
 * grade of injury matters more than which muscle it is.
 */

export interface HealingSource {
  /** As a student would look it up: the work and its year. */
  label: string;
  url: string;
}

export type HealingTissue = 'muscle' | 'bone' | 'ligament' | 'tendon' | 'fibrocartilage' | 'cartilage';

export interface TissueHealing {
  tissue: HealingTissue;
  /** One or two sentences, ending with what to take away. */
  text: string;
  source: HealingSource;
}

export const TISSUE_HEALING: Record<HealingTissue, TissueHealing> = {
  muscle: {
    tissue: 'muscle',
    text: 'Muscle heals in three phases: inflammation (1 to 3 days), repair (3 to 4 weeks) and remodelling (3 to 6 months). The scar it leaves is weaker than the muscle it replaces.',
    source: { label: 'Baoge et al., ISRN Orthopedics, 2012', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4063193/' },
  },
  bone: {
    tissue: 'bone',
    text: 'An adult fracture usually heals in about 3 to 12 weeks, depending on the bone. Blood supply is the biggest local factor, and a poor supply means delayed union or non-union.',
    source: { label: 'StatPearls, Fracture Healing Overview, 2026', url: 'https://www.ncbi.nlm.nih.gov/books/NBK551678/' },
  },
  ligament: {
    tissue: 'ligament',
    text: 'A ligament needs about 6 to 12 weeks of protection to heal moderately, and more than a year to heal completely. Athletes often return to sport well before that.',
    source: { label: 'International Journal of Sports Physical Therapy, 2019', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6816301/' },
  },
  tendon: {
    tissue: 'tendon',
    text: 'Tendons heal slowly because their blood supply is limited. Remodelling can go on for more than a year, and the repaired tendon is weaker than it was.',
    source: { label: 'StatPearls, Tendinosis, 2025', url: 'https://www.ncbi.nlm.nih.gov/books/NBK448174/' },
  },
  fibrocartilage: {
    tissue: 'fibrocartilage',
    text: 'Fibrocartilage is supplied only at its outer edge, so whether a tear heals depends on where it is: near the edge it can, further in it usually cannot.',
    source: { label: 'StatPearls, Knee Meniscal Tears, 2023', url: 'https://www.ncbi.nlm.nih.gov/books/NBK431067/' },
  },
  cartilage: {
    tissue: 'cartilage',
    text: 'Articular cartilage has no blood vessels and very little capacity to repair itself.',
    source: { label: 'Fox et al., Sports Health, 2009', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3445147/' },
  },
};

export interface StructureHealing {
  /** Card id suffix; one structure may have more than one card. */
  key: string;
  structureId: string;
  tissue: HealingTissue;
  question: string;
  answer: string;
  /** Set where the literature disagrees: what is disputed, and by whom. */
  contested?: string;
  sources: HealingSource[];
}

const SP = (title: string, year: number, nbk: string): HealingSource => ({
  label: `StatPearls, ${title}, ${year}`,
  url: `https://www.ncbi.nlm.nih.gov/books/${nbk}/`,
});
const PAPER = (label: string, url: string): HealingSource => ({ label, url });

export const STRUCTURE_HEALING: StructureHealing[] = [
  {
    key: 'scaphoid', structureId: 'scaphoid', tissue: 'bone',
    question: 'Why can a scaphoid waist fracture leave the proximal pole without a blood supply?',
    answer: 'Blood enters the scaphoid at its distal end and flows backwards (retrograde) to the proximal pole, through branches of the radial artery. A fracture across the waist can cut the proximal pole off, risking avascular necrosis and non-union.',
    sources: [SP('Scaphoid Wrist Fracture', 2023, 'NBK536907')],
  },
  {
    key: 'femoral-head', structureId: 'femoral-head', tissue: 'bone',
    question: 'Which artery does the femoral head depend on, and what threatens it?',
    answer: 'The deep branch of the medial circumflex femoral artery. An intracapsular femoral neck fracture is likely to tear it, which is why avascular necrosis follows 15 to 50% of these fractures. The small artery in the ligament of the head matters only in children.',
    sources: [SP('Anatomy, Bony Pelvis and Lower Limb: Femur', 2023, 'NBK532982')],
  },
  {
    key: 'talus', structureId: 'talus', tissue: 'bone',
    question: 'Why is the talus at risk of avascular necrosis after a neck fracture?',
    answer: 'About two-thirds of its surface is articular cartilage, so blood can only enter through a small area. A displaced neck fracture can cut that supply off; the more displaced, the higher the risk.',
    sources: [SP('Talus Fracture', 2023, 'NBK539687')],
  },
  {
    key: 'lunate', structureId: 'lunate', tissue: 'bone',
    question: 'What part may the lunate\'s blood supply play in Kienböck disease?',
    answer: 'The lunate has few vessels inside the bone, which is one proposed cause of Kienböck disease (osteonecrosis of the lunate).',
    contested: 'There is no agreement on the main cause; mechanical factors such as a short ulna are also proposed.',
    sources: [SP('Kienbock Disease', 2023, 'NBK536991')],
  },
  {
    key: 'navicular', structureId: 'navicular', tissue: 'bone',
    question: 'Why do navicular stress fractures fail to heal?',
    answer: 'The central third of the navicular is poorly supplied, and that is where stress fractures occur, so they carry a high risk of non-union and osteonecrosis.',
    sources: [SP('Tarsal Navicular Fractures', 2023, 'NBK542221')],
  },
  {
    key: 'jones-zone', structureId: 'base-of-fifth-metatarsal', tissue: 'bone',
    question: 'Why do Jones fractures of the fifth metatarsal often fail to unite?',
    answer: 'Zone 2 of the proximal fifth metatarsal is a watershed between two blood supplies. Fractures there fail to unite in as many as 15 to 30% of cases.',
    sources: [SP('5th Metatarsal Fracture', 2023, 'NBK544369')],
  },
  {
    key: 'acl', structureId: 'anterior-cruciate-ligament', tissue: 'ligament',
    question: 'Why does a torn ACL not heal on its own?',
    answer: 'The ACL is supplied by the middle genicular artery. It sits inside the joint, where the torn ends are bathed in synovial fluid, which breaks down the clot a ligament needs to heal. The MCL, outside the joint, heals; the ACL does not.',
    contested: 'Whether a poor blood supply is the reason is disputed: one review describes its supply as rich, and an anatomical study found its vascularity no different from the PCL\'s. Do not learn "the ACL has no blood supply".',
    sources: [
      SP('Knee Anterior Cruciate Ligament', 2023, 'NBK559233'),
      PAPER('Georgiev et al., Journal of Experimental Orthopaedics, 2022', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8758860/'),
      PAPER('Ferretti et al., Journal of Orthopaedics and Traumatology, 2020', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7456428/'),
    ],
  },
  {
    key: 'pcl', structureId: 'posterior-cruciate-ligament', tissue: 'ligament',
    question: 'How does the PCL\'s healing compare with the ACL\'s?',
    answer: 'The middle third of the PCL is relatively poorly supplied, yet the PCL can heal without surgery. It is a reminder that blood supply alone does not decide whether a ligament heals.',
    sources: [SP('Knee Posterior Cruciate Ligament', 2023, 'NBK535416')],
  },
  {
    key: 'mcl', structureId: 'superficial-part-of-tibial-collateral-ligament', tissue: 'ligament',
    question: 'Why do most isolated MCL tears heal without surgery?',
    answer: 'The MCL lies outside the joint and is supplied by branches of the superior and inferior genicular arteries. Most isolated tears respond well to non-operative management.',
    sources: [SP('Knee Medial Collateral Ligament', 2025, 'NBK507780')],
  },
  ...(['medial-meniscus', 'lateral-meniscus'] as const).map((structureId): StructureHealing => ({
    key: 'zones', structureId, tissue: 'fibrocartilage',
    question: 'Which meniscal tears can heal, and why?',
    answer: 'Only the outer rim of the meniscus has blood vessels (the red zone). Tears there can heal; tears in the inner white zone cannot.',
    contested: 'How wide the supplied rim is differs between sources: the outer 10 to 25% in the original injection study, the outer third in a current review.',
    sources: [
      PAPER('Arnoczky & Warren, American Journal of Sports Medicine, 1982', 'https://europepmc.org/abstract/MED/7081532'),
      SP('Knee Meniscal Tears', 2023, 'NBK431067'),
    ],
  })),
  {
    key: 'supply', structureId: 'acetabular-labrum', tissue: 'fibrocartilage',
    question: 'Where does the acetabular labrum get its blood supply?',
    answer: 'From a ring of vessels around the acetabulum, reaching the labrum from its capsular side; the hip capsule and synovium were not found to contribute. Whether a torn labrum can heal is not settled.',
    contested: 'Whether parts of the labrum are poorly supplied is disputed, and whether labral tears heal at all is described as controversial.',
    sources: [
      PAPER('Kalhor et al., Journal of Bone and Joint Surgery (Am), 2010', 'https://europepmc.org/abstract/MED/21048175'),
      PAPER('Groh & Herrera, Current Reviews in Musculoskeletal Medicine, 2009', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2697339/'),
    ],
  },
  {
    key: 'supply', structureId: 'glenoid-labrum', tissue: 'fibrocartilage',
    question: 'Which parts of the glenoid labrum are least well supplied?',
    answer: 'Its vessels reach only the outer edge, and the superior and anterosuperior parts have fewer than the posterosuperior and inferior parts.',
    sources: [PAPER('Cooper et al., Journal of Bone and Joint Surgery (Am), 1992', 'https://europepmc.org/abstract/MED/1734013')],
  },
  {
    key: 'tfcc', structureId: 'triangular-fibrocartilage-complex', tissue: 'fibrocartilage',
    question: 'Which TFCC tears are unlikely to heal?',
    answer: 'Central tears. Only the edge of the TFCC has a blood supply, so lesions of its central portion are unlikely to heal, while peripheral tears can be repaired.',
    sources: [SP('Forearm Triangular Fibrocartilage Complex', 2023, 'NBK554564')],
  },
  {
    key: 'critical-zone', structureId: 'supraspinatus', tissue: 'tendon',
    question: 'What is the supraspinatus "critical zone"?',
    answer: 'A zone of the tendon close to its insertion, long taught as a poorly supplied watershed between the anterior and posterior circumflex humeral, thoracoacromial and suprahumeral arteries.',
    contested: 'Studies in people with impingement found these areas to be well supplied, not poorly supplied.',
    sources: [{ label: 'Radiopaedia, Critical zone in rotator cuff tendons, 2024', url: 'https://radiopaedia.org/articles/critical-zone-in-rotator-cuff-tendons' }],
  },
  {
    key: 'midsection', structureId: 'achilles-tendon', tissue: 'tendon',
    question: 'Which part of the Achilles tendon is least well supplied?',
    answer: 'The midsection, about 2 to 6 cm above the insertion, supplied by the peroneal artery. It is where most ruptures happen, and poor supply has been suggested to slow healing.',
    contested: 'Whether the poor supply causes the ruptures is disputed: one anatomical study found no direct relationship.',
    sources: [
      SP('Achilles Tendon', 2023, 'NBK499917'),
      PAPER('Schmidt-Rohlfing et al., International Orthopaedics, 1992', 'https://europepmc.org/abstract/MED/1572766'),
    ],
  },
  {
    key: 'retromalleolar', structureId: 'tibialis-posterior', tissue: 'tendon',
    question: 'Where is the tibialis posterior tendon poorly supplied?',
    answer: 'Where it turns behind the medial malleolus. This poorly supplied zone may contribute to the tendon failing there.',
    sources: [
      SP('Posterior Tibial Tendon Dysfunction', 2024, 'NBK542160'),
      PAPER('Frey et al., Journal of Bone and Joint Surgery (Am), 1990', 'https://europepmc.org/abstract/MED/2195033'),
    ],
  },
  {
    key: 'no-zone', structureId: 'peroneus-brevis', tissue: 'tendon',
    question: 'Does peroneus brevis have a poorly supplied zone?',
    answer: 'A vascular study found none in peroneus brevis, though most peroneus longus tendons had poorly supplied zones.',
    contested: 'Older work proposed critical avascular zones; others found no evidence for them.',
    sources: [PAPER('van Dijk et al., Knee Surgery, Sports Traumatology, Arthroscopy, 2016', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4823319/')],
  },
  {
    key: 'quadriceps-tendon', structureId: 'rectus-femoris', tissue: 'tendon',
    question: 'Where does the quadriceps tendon tend to rupture, and why there?',
    answer: 'About 1 to 2 cm above the patella, where the tendon has a consistently poorly supplied zone that matches where it ruptures.',
    sources: [PAPER('Yepes et al., Journal of Bone and Joint Surgery (Am), 2008', 'https://europepmc.org/abstract/MED/18829911')],
  },
  {
    key: 'long-head', structureId: 'biceps-brachii', tissue: 'tendon',
    question: 'Where is the long head of biceps tendon poorly supplied?',
    answer: 'In a zone 1.2 to 3 cm from its origin, between two vascular territories, where it usually ruptures. Vascular and mechanical factors together are thought to be responsible.',
    sources: [PAPER('Cheng et al., Clinical Anatomy, 2010', 'https://europepmc.org/abstract/MED/20821403')],
  },
  {
    key: 'distal', structureId: 'biceps-brachii', tissue: 'tendon',
    question: 'What raises the risk of a distal biceps tendon rupture?',
    answer: 'A poorly supplied area between the tendon\'s zones, together with the tendon\'s cross-section narrowing in pronation.',
    sources: [PAPER('Clinics in Orthopedic Surgery, 2025', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11957816/')],
  },
  {
    key: 'nutrition', structureId: 'intervertebral-disc', tissue: 'fibrocartilage',
    question: 'How are the cells of an adult intervertebral disc fed?',
    answer: 'The adult disc has no blood vessels. Its cells depend on diffusion from vessels at the disc\'s margins, which is lowest at the centre of the nucleus pulposus.',
    sources: [PAPER('Urban et al., Spine, 2004', 'https://europepmc.org/abstract/MED/15564919')],
  },
];
