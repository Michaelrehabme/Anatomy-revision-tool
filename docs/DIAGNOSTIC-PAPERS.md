# The diagnostic papers

Version 3. Written by `npm run papers:publish` from
`src/features/anatomy-revision/data/diagnostic/papers.v3.json` and the seed; do not edit by hand.

Ten papers of fifteen questions. A student with every area sits the whole-body paper; a
student on a free account sits the paper for their free area. The questions were chosen for
what a first- or second-year sports therapy or physiotherapy student is commonly taught and
examined on. They are the owner's to change **before the first sitting of that paper**; after
it, only as a new version. How to swap one is at the top of `src/scripts/diagnosticPapers.ts`.

The right answer is printed here as the seed states it. This file is in the repository and
is not part of any build: the papers themselves hold no answers.

Every right answer below is held, by a test, to be word for word what the Atlas shows for
that structure and fact (the Atlas table and the card of the structure), in a bundled build and
in one that fetches its facts: `components/__tests__/diagnosticPapersAtlas.test.tsx`.

## Whole body

Sat by anyone holding every area. Built from all nine areas.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Latissimus Dorsi | muscle | functional (clinical): Latissimus Dorsi is most responsible for which of these? | Powerful shoulder extension and adduction, e.g. a pull-up, swimming's freestyle pull, or climbing. | Pectoralis Major; Deltoid; Infraspinatus |
| 2 | Supraspinatus | muscle | action: What is the action of Supraspinatus? | Starts shoulder abduction, through roughly its first 15 degrees, and holds the humeral head in the glenoid. | Deltoid; Coracobrachialis; Teres Major |
| 3 | Triceps Brachii | muscle | nerve: What nerve innervates Triceps Brachii? | Radial nerve | Biceps Brachii; Median nerve (a nerve name); Ulnar nerve (a nerve name) |
| 4 | Flexor Digitorum Superficialis | muscle | insertion: What is the insertion of Flexor Digitorum Superficialis? | Middle phalanges of digits 2–5 | Flexor Digitorum Profundus; Flexor Pollicis Longus; Palmaris Longus |
| 5 | Carpometacarpal Joint of Thumb | joint | name the picture: Which structure is shown? | Carpometacarpal Joint of Thumb | Metacarpophalangeal Joint; Radiocarpal Joint; Second Carpometacarpal Joint |
| 6 | Gluteus Maximus | muscle | nerve: What nerve innervates Gluteus Maximus? | Inferior gluteal nerve | Gluteus Medius; Iliacus; Gracilis |
| 7 | Sartorius | muscle | origin: What is the origin of Sartorius? | Anterior superior iliac spine (ASIS) | Gracilis; Piriformis; Quadratus Femoris |
| 8 | Anterior cruciate ligament | ligament | name the picture: Which structure is shown? | Anterior cruciate ligament | Posterior cruciate ligament; Transverse ligament of knee; Oblique popliteal ligament |
| 9 | Rectus Femoris | muscle | origin: What is the origin of Rectus Femoris? | Anterior Inferior Iliac Spine (AIIS) | Vastus Lateralis; Semitendinosus; Popliteus |
| 10 | Gastrocnemius | muscle | action: What is the action of Gastrocnemius? | Plantarflexes the ankle — most powerfully with the knee extended — and flexes the knee. | Plantaris; Tibialis Posterior; Flexor Hallucis Longus |
| 11 | Anterior talofibular ligament | ligament | name the picture: Which structure is shown? | Anterior talofibular ligament | Posterior talofibular ligament; Calcaneofibular ligament; Anterior tibiofibular ligament |
| 12 | Atlas (C1) | bone | name the picture: Which structure is shown? | Atlas (C1) | Axis (C2); C7 Vertebra; Occipital Bone |
| 13 | Diaphragm | muscle | nerve: What nerve innervates Diaphragm? | Phrenic nerve | External Intercostals; Longissimus; Long thoracic nerve (a nerve name) |
| 14 | Intervertebral Disc | landmark | name the picture: Which structure is shown? | Intervertebral Disc | Vertebral Body; Intervertebral Foramen; Vertebral Foramen |
| 15 | Quadratus Lumborum | muscle | insertion: What is the insertion of Quadratus Lumborum? | 12th rib; Transverse processes L1–L4 | Rectus Abdominis; Internal Oblique; Spinalis |

## Shoulder

Sat by a free account whose free area is Shoulder. Built from that area alone.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Deltoid | muscle | nerve: What nerve innervates Deltoid? | Axillary nerve | Supraspinatus; Coracobrachialis; Latissimus Dorsi |
| 2 | Supraspinatus | muscle | action: What is the action of Supraspinatus? | Starts shoulder abduction, through roughly its first 15 degrees, and holds the humeral head in the glenoid. | Deltoid; Coracobrachialis; Teres Major |
| 3 | Infraspinatus | muscle | insertion: What is the insertion of Infraspinatus? | Greater tubercle of humerus | Subscapularis; Teres Major; Deltoid |
| 4 | Subscapularis | muscle | action: What is the action of Subscapularis? | Internally rotates and adducts the shoulder; stabilises the glenohumeral joint. | Pectoralis Minor; Coracobrachialis; Deltoid |
| 5 | Trapezius | muscle | name the picture: Which structure is shown? | Trapezius | Latissimus Dorsi; Rhomboid Major; Levator Scapulae |
| 6 | Serratus Anterior | muscle | nerve: What nerve innervates Serratus Anterior? | Long thoracic nerve | Latissimus Dorsi; Rhomboid Minor; Pectoralis Minor |
| 7 | Pectoralis Major | muscle | origin: What is the origin of Pectoralis Major? | Clavicular head: medial clavicle; Sternocostal head: sternum & costal cartilages 1–6 | Pectoralis Minor; Deltoid; Latissimus Dorsi |
| 8 | Latissimus Dorsi | muscle | functional (clinical): Latissimus Dorsi is most responsible for which of these? | Powerful shoulder extension and adduction, e.g. a pull-up, swimming's freestyle pull, or climbing. | Pectoralis Major; Deltoid; Infraspinatus |
| 9 | Rhomboid Major | muscle | origin: What is the origin of Rhomboid Major? | Spinous processes T2–T5 | Levator Scapulae; Trapezius; Serratus Anterior |
| 10 | Acromion | landmark | name the picture: Which structure is shown? | Acromion | Coracoid Process; Spine of Scapula; Superior Angle of Scapula |
| 11 | Coracoid Process | landmark | name the picture: Which structure is shown? | Coracoid Process | Acromion; Glenoid Cavity; Inferior Angle of Scapula |
| 12 | Greater Tubercle of Humerus | landmark | name the picture: Which structure is shown? | Greater Tubercle of Humerus | Lesser Tubercle of Humerus; Deltoid Tuberosity; Surgical Neck of Humerus |
| 13 | Glenohumeral Joint | joint | injury vignette (clinical): Visible deformity (loss of the normal deltoid contour), severe pain, and the arm held in slight abduction and external rotation. Which structure is most likely involved? | Glenohumeral Joint | Acromioclavicular Joint; Sternoclavicular Joint; Pectoralis Major |
| 14 | Acromioclavicular ligament | ligament | name the picture: Which structure is shown? | Acromioclavicular ligament | Coraco-acromial ligament; Conoid ligament; Coracohumeral ligament |
| 15 | Glenoid labrum | ligament | name the picture: Which structure is shown? | Glenoid labrum | Superior glenohumeral ligament; Transverse humeral ligament; Coraco-acromial ligament |

## Elbow

Sat by a free account whose free area is Elbow. Built from that area alone.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Biceps Brachii | muscle | insertion: What is the insertion of Biceps Brachii? | Radial tuberosity; Bicipital aponeurosis | Brachialis; Triceps Brachii; Brachioradialis |
| 2 | Brachialis | muscle | action: What is the action of Brachialis? | The prime mover of elbow flexion, and the one that works in any forearm position. | Biceps Brachii; Triceps Brachii; Brachioradialis |
| 3 | Triceps Brachii | muscle | nerve: What nerve innervates Triceps Brachii? | Radial nerve | Biceps Brachii; Median nerve (a nerve name); Ulnar nerve (a nerve name) |
| 4 | Brachioradialis | muscle | origin: What is the origin of Brachioradialis? | Lateral supracondylar ridge of humerus | Brachialis; Triceps Brachii; Anconeus |
| 5 | Olecranon | landmark | name the picture: Which structure is shown? | Olecranon | Coronoid Process of Ulna; Head of Radius; Trochlear Notch |
| 6 | Medial Epicondyle of Humerus | landmark | name the picture: Which structure is shown? | Medial Epicondyle of Humerus | Lateral Epicondyle of Humerus; Olecranon; Coronoid Process of Ulna |
| 7 | Lateral Epicondyle of Humerus | landmark | name the picture: Which structure is shown? | Lateral Epicondyle of Humerus | Medial Epicondyle of Humerus; Head of Radius; Radial Tuberosity |
| 8 | Head of Radius | landmark | name the picture: Which structure is shown? | Head of Radius | Radial Tuberosity; Olecranon; Coronoid Process of Ulna |
| 9 | Radial Tuberosity | landmark | name the picture: Which structure is shown? | Radial Tuberosity | Head of Radius; Coronoid Process of Ulna; Lateral Epicondyle of Humerus |
| 10 | Coronoid Process of Ulna | landmark | name the picture: Which structure is shown? | Coronoid Process of Ulna | Olecranon; Trochlear Notch; Radial Tuberosity |
| 11 | Humeroulnar Joint | joint | injury vignette (clinical): Visible deformity, severe pain, and inability to move the elbow; check distal pulses and nerve function given the joint's proximity to the brachial artery and major nerves. Which structure is most likely involved? | Humeroulnar Joint | Proximal Radioulnar Joint; Biceps Brachii; Triceps Brachii |
| 12 | Proximal Radioulnar Joint | joint | injury vignette (clinical): Lateral elbow pain and swelling, with pain specifically on pronation/supination rather than flexion/extension. Which structure is most likely involved? | Proximal Radioulnar Joint | Humeroulnar Joint; Biceps Brachii; Triceps Brachii |
| 13 | Ulnar collateral ligament | ligament | name the picture: Which structure is shown? | Ulnar collateral ligament | Radial collateral ligament; Annular ligament of radius; Quadrate ligament |
| 14 | Radial collateral ligament | ligament | name the picture: Which structure is shown? | Radial collateral ligament | Ulnar collateral ligament; Annular ligament of radius; Interosseous membrane of forearm |
| 15 | Annular ligament of radius | ligament | name the picture: Which structure is shown? | Annular ligament of radius | Quadrate ligament; Radial collateral ligament; Interosseous membrane of forearm |

## Wrist & Hand

Sat by a free account whose free area is Wrist & Hand. Built from that area alone.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Flexor Digitorum Superficialis | muscle | insertion: What is the insertion of Flexor Digitorum Superficialis? | Middle phalanges of digits 2–5 | Flexor Digitorum Profundus; Flexor Pollicis Longus; Palmaris Longus |
| 2 | Flexor Digitorum Profundus | muscle | action: What is the action of Flexor Digitorum Profundus? | Flexes the distal interphalangeal joints of digits 2–5 — the only muscle that can — and assists wrist flexion. | Flexor Digitorum Superficialis; Flexor Carpi Ulnaris; Flexor Pollicis Longus |
| 3 | Flexor Carpi Ulnaris | muscle | nerve: What nerve innervates Flexor Carpi Ulnaris? | Ulnar nerve | Flexor Carpi Radialis; Extensor Carpi Ulnaris; Extensor Carpi Radialis Longus |
| 4 | Extensor Digitorum | muscle | origin: What is the origin of Extensor Digitorum? | Lateral epicondyle of humerus | Flexor Carpi Radialis; Extensor Carpi Radialis Longus; Pronator Quadratus |
| 5 | Pronator Teres | muscle | origin: What is the origin of Pronator Teres? | Medial epicondyle of humerus (humeral head); Coronoid process of ulna (ulnar head) | Supinator; Pronator Quadratus; Flexor Pollicis Longus |
| 6 | Abductor Pollicis Brevis | muscle | nerve: What nerve innervates Abductor Pollicis Brevis? | Median nerve | Adductor Pollicis; Abductor Pollicis Longus; Extensor Carpi Radialis Longus |
| 7 | Lumbricals (Hand) | muscle | action: What is the action of Lumbricals (Hand)? | Flexes the metacarpophalangeal joints of digits 2–5 while extending their interphalangeal joints. | Palmar Interossei; Dorsal Interossei (Hand); Opponens Pollicis |
| 8 | Supinator | muscle | name the picture: Which structure is shown? | Supinator | Pronator Teres; Extensor Digitorum; Extensor Carpi Radialis Longus |
| 9 | Flexor Carpi Radialis | muscle | insertion: What is the insertion of Flexor Carpi Radialis? | Base of 2nd and 3rd metacarpals | Flexor Carpi Ulnaris; Extensor Carpi Ulnaris; Palmaris Longus |
| 10 | Metacarpals (grouped) | bone | name the picture: Which structure is shown? | Metacarpals (grouped) | Carpals (grouped); Proximal Phalanges of the Hand (grouped); Distal Phalanges of the Hand (grouped) |
| 11 | Scaphoid | landmark | name the picture: Which structure is shown? | Scaphoid | Lunate; Trapezium; Capitate |
| 12 | Radial Styloid Process | landmark | name the picture: Which structure is shown? | Radial Styloid Process | Ulnar Styloid Process; Pisiform; Scaphoid |
| 13 | Radiocarpal Joint | joint | name the picture: Which structure is shown? | Radiocarpal Joint | Midcarpal Joint; Distal Radioulnar Joint; Carpometacarpal Joint of Thumb |
| 14 | Carpometacarpal Joint of Thumb | joint | name the picture: Which structure is shown? | Carpometacarpal Joint of Thumb | Metacarpophalangeal Joint; Radiocarpal Joint; Second Carpometacarpal Joint |
| 15 | Scapholunate interosseous ligament | ligament | name the picture: Which structure is shown? | Scapholunate interosseous ligament | Lunotriquetral interosseous ligament; Capitohamate interosseous ligament; Dorsal radiocarpal ligament |

## Hip

Sat by a free account whose free area is Hip. Built from that area alone.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Gluteus Maximus | muscle | nerve: What nerve innervates Gluteus Maximus? | Inferior gluteal nerve | Gluteus Medius; Iliacus; Gracilis |
| 2 | Gluteus Medius | muscle | action: What is the action of Gluteus Medius? | Abducts and internally rotates the hip; stabilises the pelvis; arises from the outer surface of the ilium (between the anterior and posterior gluteal lines). | Gluteus Maximus; Adductor Longus; Piriformis |
| 3 | Psoas Major | muscle | insertion: What is the insertion of Psoas Major? | Lesser trochanter of the femur | Gluteus Maximus; Adductor Longus; Piriformis |
| 4 | Sartorius | muscle | origin: What is the origin of Sartorius? | Anterior superior iliac spine (ASIS) | Gracilis; Piriformis; Quadratus Femoris |
| 5 | Adductor Longus | muscle | nerve: What nerve innervates Adductor Longus? | Obturator nerve | Iliacus; Gluteus Minimus; Piriformis |
| 6 | Piriformis | muscle | name the picture: Which structure is shown? | Piriformis | Gluteus Medius; Quadratus Femoris; Obturator Internus |
| 7 | Tensor Fasciae Latae | muscle | action: What is the action of Tensor Fasciae Latae? | Abducts, internally rotates and flexes the hip. | Gluteus Maximus; Pectineus; Obturator Externus |
| 8 | Iliacus | muscle | origin: What is the origin of Iliacus? | Iliac fossa of the pelvis | Psoas Major; Gluteus Maximus; Pectineus |
| 9 | Adductor Magnus | muscle | insertion: What is the insertion of Adductor Magnus? | Linea aspera of the femur; Adductor tubercle of the femur | Pectineus; Gracilis; Obturator Externus |
| 10 | Greater Trochanter | landmark | name the picture: Which structure is shown? | Greater Trochanter | Lesser Trochanter; Femoral Head; Femoral Neck |
| 11 | Anterior Superior Iliac Spine (ASIS) | landmark | name the picture: Which structure is shown? | Anterior Superior Iliac Spine (ASIS) | Anterior Inferior Iliac Spine (AIIS); Posterior Superior Iliac Spine (PSIS); Pubic Tubercle |
| 12 | Ischial Tuberosity | landmark | name the picture: Which structure is shown? | Ischial Tuberosity | Pubic Tubercle; Posterior Superior Iliac Spine (PSIS); Acetabulum |
| 13 | Iliac Crest | landmark | name the picture: Which structure is shown? | Iliac Crest | Ilium; Pubis; Ischium |
| 14 | Ischiofemoral ligament | ligament | name the picture: Which structure is shown? | Ischiofemoral ligament | Pubofemoral ligament; Descending part of iliofemoral ligament; Sacrospinous ligament |
| 15 | Acetabular labrum | ligament | name the picture: Which structure is shown? | Acetabular labrum | Transverse acetabular ligament; Ligament of head of femur; Obturator membrane |

## Knee

Sat by a free account whose free area is Knee. Built from that area alone.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Rectus Femoris | muscle | origin: What is the origin of Rectus Femoris? | Anterior Inferior Iliac Spine (AIIS) | Vastus Lateralis; Semitendinosus; Popliteus |
| 2 | Vastus Lateralis | muscle | name the picture: Which structure is shown? | Vastus Lateralis | Vastus Medialis; Rectus Femoris; Biceps Femoris |
| 3 | Vastus Medialis | muscle | action: What is the action of Vastus Medialis? | Extends the knee; its oblique lower fibres are what hold the patella tracking correctly. | Rectus Femoris; Semimembranosus; Popliteus |
| 4 | Vastus Intermedius | muscle | origin: What is the origin of Vastus Intermedius? | Anterior and lateral surfaces of the femur | Vastus Medialis; Biceps Femoris; Popliteus |
| 5 | Semimembranosus | muscle | nerve: What nerve innervates Semimembranosus? | Tibial nerve | Vastus Lateralis; Obturator nerve (a nerve name); Superior gluteal nerve (a nerve name) |
| 6 | Biceps Femoris | muscle | insertion: What is the insertion of Biceps Femoris? | Head of the fibula | Semimembranosus; Semitendinosus; Rectus Femoris |
| 7 | Semitendinosus | muscle | action: What is the action of Semitendinosus? | Extends the hip; flexes and internally rotates the knee; inserts on the proximal medial surface of the tibia (pes anserinus). | Biceps Femoris; Rectus Femoris; Vastus Lateralis |
| 8 | Popliteus | muscle | insertion: What is the insertion of Popliteus? | Posterior surface of the tibia, above the soleal (popliteal) line | Biceps Femoris; Semimembranosus; Vastus Medialis |
| 9 | Tibial Tuberosity | landmark | name the picture: Which structure is shown? | Tibial Tuberosity | Tibial Plateau; Tibial Crest; Intercondylar Eminence of Tibia |
| 10 | Medial Condyle of Femur | landmark | name the picture: Which structure is shown? | Medial Condyle of Femur | Lateral Condyle of Femur; Medial Epicondyle of Femur; Adductor Tubercle |
| 11 | Head of Fibula | landmark | name the picture: Which structure is shown? | Head of Fibula | Neck of Fibula; Lateral Condyle of Tibia; Tibial Tuberosity |
| 12 | Anterior cruciate ligament | ligament | name the picture: Which structure is shown? | Anterior cruciate ligament | Posterior cruciate ligament; Transverse ligament of knee; Oblique popliteal ligament |
| 13 | Medial meniscus | ligament | name the picture: Which structure is shown? | Medial meniscus | Lateral meniscus; Transverse ligament of knee; Posterior cruciate ligament |
| 14 | Fibular collateral ligament | ligament | name the picture: Which structure is shown? | Fibular collateral ligament | Superficial part of tibial collateral ligament; Popliteofibular ligament; Arcuate popliteal ligament |
| 15 | Superficial part of tibial collateral ligament | ligament | name the picture: Which structure is shown? | Superficial part of tibial collateral ligament | Fibular collateral ligament; Oblique popliteal ligament; Anterior cruciate ligament |

## Ankle & Foot

Sat by a free account whose free area is Ankle & Foot. Built from that area alone.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Tibialis Anterior | muscle | nerve: What nerve innervates Tibialis Anterior? | Deep fibular nerve | Peroneus Brevis; Tibialis Posterior; Flexor Digitorum Brevis |
| 2 | Gastrocnemius | muscle | action: What is the action of Gastrocnemius? | Plantarflexes the ankle — most powerfully with the knee extended — and flexes the knee. | Plantaris; Tibialis Posterior; Flexor Hallucis Longus |
| 3 | Soleus | muscle | origin: What is the origin of Soleus? | Upper posterior fibula & tibia | Gastrocnemius; Plantaris; Flexor Digitorum Longus |
| 4 | Peroneus Longus | muscle | nerve: What nerve innervates Peroneus Longus? | Superficial fibular nerve | Extensor Digitorum Longus; Flexor Digitorum Longus; Abductor Hallucis |
| 5 | Peroneus Brevis | muscle | insertion: What is the insertion of Peroneus Brevis? | Tuberosity of 5th metatarsal | Peroneus Longus; Tibialis Posterior; Extensor Digitorum Longus |
| 6 | Tibialis Posterior | muscle | action: What is the action of Tibialis Posterior? | Inverts the foot and plantarflexes the ankle. | Tibialis Anterior; Peroneus Brevis; Extensor Digitorum Longus |
| 7 | Flexor Hallucis Longus | muscle | origin: What is the origin of Flexor Hallucis Longus? | Posterior fibula | Flexor Digitorum Longus; Tibialis Anterior; Peroneus Brevis |
| 8 | Extensor Hallucis Longus | muscle | name the picture: Which structure is shown? | Extensor Hallucis Longus | Extensor Digitorum Longus; Tibialis Anterior; Peroneus Tertius |
| 9 | Metatarsals (grouped) | bone | name the picture: Which structure is shown? | Metatarsals (grouped) | Tarsals (grouped); Proximal Phalanges of the Foot (grouped); Distal Phalanges of the Foot (grouped) |
| 10 | Lateral Malleolus | landmark | name the picture: Which structure is shown? | Lateral Malleolus | Medial Malleolus; Calcaneus; Cuboid |
| 11 | Talus | landmark | name the picture: Which structure is shown? | Talus | Calcaneus; Navicular; Cuboid |
| 12 | Calcaneus | landmark | name the picture: Which structure is shown? | Calcaneus | Talus; Cuboid; Sustentaculum Tali |
| 13 | Talocrural Joint | joint | name the picture: Which structure is shown? | Talocrural Joint | Subtalar Joint; Distal Tibiofibular Joint; Transverse Tarsal Joint |
| 14 | Anterior talofibular ligament | ligament | name the picture: Which structure is shown? | Anterior talofibular ligament | Posterior talofibular ligament; Calcaneofibular ligament; Anterior tibiofibular ligament |
| 15 | Plantar calcaneonavicular ligament | ligament | name the picture: Which structure is shown? | Plantar calcaneonavicular ligament | Long plantar ligament; Plantar calcaneocuboid ligament; Tibionavicular ligament |

## Cervical Spine

Sat by a free account whose free area is Cervical Spine. Built from that area alone.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Sternocleidomastoid | muscle | nerve: What nerve innervates Sternocleidomastoid? | Spinal accessory nerve (CN XI); C2–C3 (sensory) | Scalene Anterior; Dorsal scapular nerve (a nerve name); Phrenic nerve (a nerve name) |
| 2 | Scalene Anterior | muscle | insertion: What is the insertion of Scalene Anterior? | 1st rib | Scalene Posterior; Sternocleidomastoid; Longus Capitis |
| 3 | Scalene Middle | muscle | origin: What is the origin of Scalene Middle? | Transverse processes C2–C7 | Splenius Capitis; Sternocleidomastoid; Longus Colli |
| 4 | Splenius Capitis | muscle | name the picture: Which structure is shown? | Splenius Capitis | Sternocleidomastoid; Scalene Posterior; Longus Capitis |
| 5 | Longus Colli | muscle | action: What is the action of Longus Colli? | Flexes and rotates the neck. | Splenius Cervicis; Scalene Posterior; Intertransversarii |
| 6 | Semispinalis | muscle | action: What is the action of Semispinalis? | Extends the spine and rotates the trunk. | Longus Capitis; Intertransversarii; Sternocleidomastoid |
| 7 | Atlas (C1) | bone | name the picture: Which structure is shown? | Atlas (C1) | Axis (C2); C7 Vertebra; Occipital Bone |
| 8 | Axis (C2) | bone | name the picture: Which structure is shown? | Axis (C2) | Atlas (C1); C7 Vertebra; Cervical Vertebrae (C3–C6) |
| 9 | Dens (Odontoid Process) | landmark | name the picture: Which structure is shown? | Dens (Odontoid Process) | Anterior Arch of Atlas; Lateral Mass of Atlas; Spinous Process |
| 10 | Spinous Process | landmark | name the picture: Which structure is shown? | Spinous Process | Transverse Process; Lamina; Pedicle |
| 11 | Vertebral Body | landmark | name the picture: Which structure is shown? | Vertebral Body | Intervertebral Disc; Vertebral Foramen; Superior Articular Process |
| 12 | Atlantoaxial Joint | joint | name the picture: Which structure is shown? | Atlantoaxial Joint | Atlanto-occipital Joint; Facet (Zygapophyseal) Joint; Intervertebral Joint |
| 13 | Atlanto-occipital Joint | joint | name the picture: Which structure is shown? | Atlanto-occipital Joint | Atlantoaxial Joint; Facet (Zygapophyseal) Joint; Intervertebral Joint |
| 14 | Nuchal ligament | ligament | name the picture: Which structure is shown? | Nuchal ligament | Supraspinous ligament; Interspinous ligaments; Ligamenta flava |
| 15 | Anterior longitudinal ligament | ligament | name the picture: Which structure is shown? | Anterior longitudinal ligament | Posterior longitudinal ligament; Ligamenta flava; Nuchal ligament |

## Thoracic Spine

Sat by a free account whose free area is Thoracic Spine. Built from that area alone.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Diaphragm | muscle | nerve: What nerve innervates Diaphragm? | Phrenic nerve | External Intercostals; Longissimus; Long thoracic nerve (a nerve name) |
| 2 | External Intercostals | muscle | name the picture: Which structure is shown? | External Intercostals | Diaphragm; Iliocostalis; Longissimus |
| 3 | Internal Intercostals | muscle | action: What is the action of Internal Intercostals? | Drives expiration. | External Intercostals; Diaphragm; Longissimus |
| 4 | Iliocostalis | muscle | insertion: What is the insertion of Iliocostalis? | Angles of ribs; Cervical transverse processes | Diaphragm; Spinalis; Rotatores |
| 5 | Longissimus | muscle | origin: What is the origin of Longissimus? | Sacrum; Iliac crest; Lumbar transverse processes | Diaphragm; Rotatores; External Intercostals |
| 6 | Spinalis | muscle | action: What is the action of Spinalis? | Extends the spine; inserts on the spinous processes of upper thoracic & cervical vertebrae. | Diaphragm; Rotatores; Intertransversarii |
| 7 | Manubrium | landmark | name the picture: Which structure is shown? | Manubrium | Body of Sternum; Xiphoid Process; First Rib |
| 8 | Xiphoid Process | landmark | name the picture: Which structure is shown? | Xiphoid Process | Manubrium; Body of Sternum; Twelfth Rib |
| 9 | Sternal Angle | landmark | name the picture: Which structure is shown? | Sternal Angle | Jugular Notch; Costal Margin; Xiphoid Process |
| 10 | Transverse Process | landmark | name the picture: Which structure is shown? | Transverse Process | Spinous Process; Pedicle; Superior Articular Process |
| 11 | Costovertebral Joint | joint | name the picture: Which structure is shown? | Costovertebral Joint | Sternocostal Joint; Facet (Zygapophyseal) Joint; Intervertebral Joint |
| 12 | Facet (Zygapophyseal) Joint | joint | name the picture: Which structure is shown? | Facet (Zygapophyseal) Joint | Costovertebral Joint; Intervertebral Joint; Sternocostal Joint |
| 13 | Supraspinous ligament | ligament | name the picture: Which structure is shown? | Supraspinous ligament | Interspinous ligaments; Ligamenta flava; Posterior longitudinal ligament |
| 14 | Radiate ligament of head of rib | ligament | name the picture: Which structure is shown? | Radiate ligament of head of rib | Costotransverse ligament; Intra-articular ligament of head of rib; Intertransverse Ligaments |
| 15 | Costotransverse ligament | ligament | name the picture: Which structure is shown? | Costotransverse ligament | Radiate ligament of head of rib; Intertransverse Ligaments; External intercostal membrane |

## Lumbar Spine

Sat by a free account whose free area is Lumbar Spine. Built from that area alone.

| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |
| --- | --- | --- | --- | --- | --- |
| 1 | Internal Oblique | muscle | origin: What is the origin of Internal Oblique? | Thoracolumbar fascia; Iliac crest; Inguinal ligament | Rectus Abdominis; External Oblique; Quadratus Lumborum |
| 2 | Rectus Abdominis | muscle | action: What is the action of Rectus Abdominis? | Flexes the trunk and stabilises the core. | Quadratus Lumborum; Intertransversarii; Semispinalis |
| 3 | Quadratus Lumborum | muscle | insertion: What is the insertion of Quadratus Lumborum? | 12th rib; Transverse processes L1–L4 | Rectus Abdominis; Internal Oblique; Spinalis |
| 4 | External Oblique | muscle | name the picture: Which structure is shown? | External Oblique | Internal Oblique; Rectus Abdominis; Quadratus Lumborum |
| 5 | Multifidus | muscle | action: What is the action of Multifidus? | Stabilises and extends the spine; rotates the trunk. | Quadratus Lumborum; Intertransversarii; External Oblique |
| 6 | Longissimus | muscle | nerve: What nerve innervates Longissimus? | Dorsal rami of spinal nerves | Quadratus Lumborum; Rectus Abdominis; Phrenic nerve (a nerve name) |
| 7 | Pars Interarticularis | landmark | name the picture: Which structure is shown? | Pars Interarticularis | Pedicle; Lamina; Superior Articular Process |
| 8 | Intervertebral Disc | landmark | name the picture: Which structure is shown? | Intervertebral Disc | Vertebral Body; Intervertebral Foramen; Vertebral Foramen |
| 9 | Sacral Promontory | landmark | name the picture: Which structure is shown? | Sacral Promontory | Sacral Ala; Sacral Apex; Sacral Base |
| 10 | Pedicle | landmark | name the picture: Which structure is shown? | Pedicle | Lamina; Transverse Process; Spinous Process |
| 11 | Lamina | landmark | name the picture: Which structure is shown? | Lamina | Pedicle; Pars Interarticularis; Superior Articular Process |
| 12 | Transverse Process | landmark | name the picture: Which structure is shown? | Transverse Process | Spinous Process; Superior Articular Process; Pedicle |
| 13 | Ligamenta flava | ligament | name the picture: Which structure is shown? | Ligamenta flava | Interspinous ligaments; Supraspinous ligament; Posterior longitudinal ligament |
| 14 | Interspinous ligaments | ligament | name the picture: Which structure is shown? | Interspinous ligaments | Supraspinous ligament; Ligamenta flava; Intertransverse Ligaments |
| 15 | Posterior longitudinal ligament | ligament | name the picture: Which structure is shown? | Posterior longitudinal ligament | Anterior longitudinal ligament; Ligamenta flava; Supraspinous ligament |

