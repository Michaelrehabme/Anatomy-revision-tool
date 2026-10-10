# The fifty action sentences, for rewording

Written 10 October 2026 from the seed as it stands on that day. Nothing here changes the seed. The same content is laid out as a page for reading: `action-text-review/index.html` (built by the session that wrote this file; not in the repository).

Every muscle has one sentence saying what it does. For most it is built by a script (`scripts/deriveActionText.mjs`) from the muscle’s action tags: the tags “hip abduction, hip internal rotation, pelvic stabilisation” become “Abducts and internally rotates the hip; stabilises the pelvis.”

Where two or more muscles carry exactly the same tags, that sentence comes out word for word the same for each, and a question asking “What is the action of…?” would offer the same answer on several buttons. So the script adds a clause to tell them apart: “; inserts on …” or “; arises from …”, followed by the first insertion or first origin the data lists for that muscle, copied as written. It uses the insertion if every muscle in the group has a different one, otherwise the origin.

That clause is on 50 of the 122 muscles. It was never written as a sentence, and it shows: labels dropped into prose, missing articles, and clauses longer than the action they follow. A 51st muscle in these groups, vastus lateralis, has a hand-written sentence and is shown beside its group for comparison.

The same sentence appears in three places: on the muscle’s card in the Atlas, as the right answer (and as wrong answers) in action questions, and in the diagnostic papers.

**Counts.** 50 sentences carry an added clause. 28 groups of muscles share identical action tags; 23 of them contain at least one added clause and are set out below, and 5 were settled entirely by hand-written sentences. 37 of the 50 read badly as they stand and are flagged. 14 of the 50 are on a live diagnostic paper.

## What is wanted

For each group, a better phrase that tells its muscles apart. Each table sets out what the seed holds for the muscles side by side: the tags, the origins and the insertions, exactly as stored. Where a sentence only needs its grammar mending, a repair is offered as **Grammar only**: an article, "of" or "and" added or dropped, and no other word changed. No new anatomy is proposed.

To apply a reworded sentence: add it to `OVERRIDES` in `scripts/deriveActionText.mjs` (so a re-run does not undo it) and to the muscle in `src/features/anatomy-revision/data/source/muscles.raw.json`.

## The ones on a live diagnostic paper

Version 3 of the papers went live on 8 October 2026 and a follow-up must ask exactly what its baseline asked (`docs/DIAGNOSTIC-PAPERS.md`, `npm run papers:check`). Rewording any of these changes a paper question, as its right answer or as a wrong answer, so the paper must be republished (only if nobody has sat it) or the papers cut as a new version. The other 36 can be reworded freely.

- **Semitendinosus**: Knee 7: the right answer
- **Semimembranosus**: Knee 3: a wrong answer (question on Vastus Medialis)
- **Gluteus Medius**: Hip 2: the right answer
- **Adductor Longus**: Hip 2: a wrong answer (question on Gluteus Medius)
- **Piriformis**: Hip 2: a wrong answer (question on Gluteus Medius)
- **Teres Major**: Whole body 2: a wrong answer (question on Supraspinatus); Shoulder 2: a wrong answer (question on Supraspinatus)
- **Scalene Posterior**: Cervical spine 5: a wrong answer (question on Longus Colli)
- **Splenius Cervicis**: Cervical spine 5: a wrong answer (question on Longus Colli)
- **Longissimus**: Thoracic spine 3: a wrong answer (question on Internal Intercostals)
- **Spinalis**: Thoracic spine 6: the right answer
- **External Oblique**: Lumbar spine 5: a wrong answer (question on Multifidus)
- **Extensor Digitorum Longus**: Ankle & foot 6: a wrong answer (question on Tibialis Posterior)
- **Flexor Pollicis Longus**: Wrist & hand 2: a wrong answer (question on Flexor Digitorum Profundus)
- **Dorsal Interossei (Hand)**: Wrist & hand 7: a wrong answer (question on Lumbricals (Hand))

Vastus lateralis (hand-written, shown with its group) is also on one: Knee 7: a wrong answer (question on Semitendinosus).

## The 23 groups

### 1. Hip extension, knee flexion, knee internal rotation

2 muscles share these tags: Semitendinosus, Semimembranosus.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Semitendinosus — LIVE PAPER: Knee 7: the right answer | Extends the hip; flexes and internally rotates the knee; inserts on the proximal medial surface of the tibia (pes anserinus). | Extends the hip; flexes and internally rotates the knee. | inserts on the proximal medial surface of the tibia (pes anserinus) | hip-extension, knee-flexion, knee-internal-rotation | Ischial tuberosity | Proximal medial surface of the tibia (pes anserinus) | Reads as a sentence. |
| Semimembranosus — LIVE PAPER: Knee 3: a wrong answer (question on Vastus Medialis) | Extends the hip; flexes and internally rotates the knee; inserts on the medial condyle of the tibia. | Extends the hip; flexes and internally rotates the knee. | inserts on the medial condyle of the tibia | hip-extension, knee-flexion, knee-internal-rotation | Ischial tuberosity | Medial condyle of the tibia | Reads as a sentence. |

### 2. Hip abduction, hip internal rotation, pelvic stabilisation

2 muscles share these tags: Gluteus Medius, Gluteus Minimus.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gluteus Medius — LIVE PAPER: Hip 2: the right answer | Abducts and internally rotates the hip; stabilises the pelvis; arises from the outer surface of the ilium (between the anterior and posterior gluteal lines). | Abducts and internally rotates the hip; stabilises the pelvis. | arises from the outer surface of the ilium (between the anterior and posterior gluteal lines) | hip-abduction, hip-internal-rotation, pelvic-stabilisation | Outer surface of the ilium (between the anterior and posterior gluteal lines) | Greater trochanter of the femur | Mostly attachment: 15 words of clause after 9 of action Reads the same as gluteus minimus as far as “ilium”; the difference is inside the brackets. |
| Gluteus Minimus | Abducts and internally rotates the hip; stabilises the pelvis; arises from the outer surface of the ilium, just below the gluteus medius. | Abducts and internally rotates the hip; stabilises the pelvis. | arises from the outer surface of the ilium, just below the gluteus medius | hip-abduction, hip-internal-rotation, pelvic-stabilisation | Outer surface of the ilium, just below the gluteus medius | Greater trochanter of the femur | Mostly attachment: 13 words of clause after 9 of action Names another muscle to place this one, and reads the same as gluteus medius until its last five words. |

### 3. Hip adduction, hip flexion

2 muscles share these tags: Adductor Longus, Adductor Brevis.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Adductor Longus — LIVE PAPER: Hip 2: a wrong answer (question on Gluteus Medius) | Adducts and flexes the hip; arises from the pubis near the symphysis. | Adducts and flexes the hip. | arises from the pubis near the symphysis | hip-adduction, hip-flexion | Pubis near the symphysis | Linea aspera of the femur | Both muscles in the group arise “from … the pubis”; the clauses differ by a few words. |
| Adductor Brevis | Adducts and flexes the hip; arises from the body of the pubis. | Adducts and flexes the hip. | arises from the body of the pubis | hip-adduction, hip-flexion | Body of the pubis | Linea aspera of the femur | Both muscles in the group arise “from … the pubis”; the clauses differ by a few words. |

### 4. Hip external rotation, hip stabilisation

4 muscles share these tags: Piriformis, Gemelli (Superior & Inferior), Obturator Internus, Quadratus Femoris.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Piriformis — LIVE PAPER: Hip 2: a wrong answer (question on Gluteus Medius) | Externally rotates and stabilises the hip; arises from the sacrum. | Externally rotates and stabilises the hip. | arises from the sacrum | hip-external-rotation, hip-stabilisation | Sacrum | Greater trochanter of the femur | Reads as a sentence. |
| Gemelli (Superior & Inferior) | Externally rotates and stabilises the hip; arises from the superior: ischial spine. | Externally rotates and stabilises the hip. | arises from the superior: ischial spine | hip-external-rotation, hip-stabilisation | Superior: ischial spine; Inferior: ischial tuberosity | Greater trochanter of the femur | Stray colon The clause copied the label of a two-part origin. The seed lists a second origin, labelled “Inferior”, which the sentence leaves out: the script only ever takes the first item. **Grammar only** (label turned into a subject; the seed’s second origin is still not in the sentence): Externally rotates and stabilises the hip; the superior arises from the ischial spine. |
| Obturator Internus | Externally rotates and stabilises the hip; arises from the obturator membrane. | Externally rotates and stabilises the hip. | arises from the obturator membrane | hip-external-rotation, hip-stabilisation | Obturator membrane | Greater trochanter of the femur | Reads as a sentence. |
| Quadratus Femoris | Externally rotates and stabilises the hip; arises from the ischial tuberosity. | Externally rotates and stabilises the hip. | arises from the ischial tuberosity | hip-external-rotation, hip-stabilisation | Ischial tuberosity | Intertrochanteric crest of the femur | The seed gives the ischial tuberosity as an origin of the gemelli too (the one labelled “Inferior”); the gemelli sentence happens not to say so. |

### 5. Knee extension

3 muscles share these tags: Vastus Lateralis, Vastus Medialis, Vastus Intermedius.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Vastus Lateralis — LIVE PAPER: Knee 7: a wrong answer (question on Semitendinosus) | Extends the knee; the largest of the quadriceps, arising from the lateral femur. | n/a (hand-written) | none | knee-extension | Greater trochanter of the femur; Linea aspera of the femur | Tibial tuberosity via the patellar tendon | Hand-written, for comparison. |
| Vastus Medialis — LIVE PAPER: Knee 3: the right answer | Extends the knee; its oblique lower fibres are what hold the patella tracking correctly. | n/a (hand-written) | none | knee-extension | Medial side of the femur | Tibial tuberosity via the patellar tendon | Hand-written, for comparison. |
| Vastus Intermedius | Extends the knee; arises from the anterior and lateral surfaces of the femur. | Extends the knee. | arises from the anterior and lateral surfaces of the femur | knee-extension | Anterior and lateral surfaces of the femur | Tibial tuberosity via the patellar tendon | Mostly attachment: 10 words of clause after 3 of action |

### 6. Glenohumeral stabilisation, shoulder external rotation

2 muscles share these tags: Infraspinatus, Teres Minor.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Infraspinatus | Externally rotates the shoulder and stabilises the glenohumeral joint; arises from the infraspinous fossa of scapula. | Externally rotates the shoulder and stabilises the glenohumeral joint. | arises from the infraspinous fossa of scapula | shoulder-external-rotation, glenohumeral-stabilisation | Infraspinous fossa of scapula | Greater tubercle of humerus | Missing articles (label wording inside a sentence) **Grammar only** (articles added): Externally rotates the shoulder and stabilises the glenohumeral joint; arises from the infraspinous fossa of the scapula. |
| Teres Minor | Externally rotates the shoulder and stabilises the glenohumeral joint; arises from the lateral border of scapula. | Externally rotates the shoulder and stabilises the glenohumeral joint. | arises from the lateral border of scapula | shoulder-external-rotation, glenohumeral-stabilisation | Lateral border of scapula | Greater tubercle of humerus | Missing articles (label wording inside a sentence) **Grammar only** (articles added): Externally rotates the shoulder and stabilises the glenohumeral joint; arises from the lateral border of the scapula. |

### 7. Scapular downward rotation, scapular retraction

2 muscles share these tags: Rhomboid Minor, Rhomboid Major.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rhomboid Minor | Retracts and downwardly rotates the scapula; inserts on the medial border of scapula (at level of the spine). | Retracts and downwardly rotates the scapula. | inserts on the medial border of scapula (at level of the spine) | scapular-retraction, scapular-downward-rotation | Spinous processes C7–T1; Nuchal ligament | Medial border of scapula (at level of the spine) | Missing articles (label wording inside a sentence) Mostly attachment: 12 words of clause after 6 of action The sentence does not say which spine “the spine” is. **Grammar only** (articles added): Retracts and downwardly rotates the scapula; inserts on the medial border of the scapula (at the level of the spine). |
| Rhomboid Major | Retracts and downwardly rotates the scapula; inserts on the medial border of scapula, below the spine. | Retracts and downwardly rotates the scapula. | inserts on the medial border of scapula, below the spine | scapular-retraction, scapular-downward-rotation | Spinous processes T2–T5 | Medial border of scapula, below the spine | Missing articles (label wording inside a sentence) The sentence does not say which spine “the spine” is. **Grammar only** (articles added): Retracts and downwardly rotates the scapula; inserts on the medial border of the scapula, below the spine. |

### 8. Shoulder adduction, shoulder extension, shoulder internal rotation

2 muscles share these tags: Teres Major, Latissimus Dorsi.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Teres Major — LIVE PAPER: Whole body 2: a wrong answer (question on Supraspinatus); Shoulder 2: a wrong answer (question on Supraspinatus) | Adducts, internally rotates and extends the shoulder; inserts on the medial lip of intertubercular sulcus of humerus. | Adducts, internally rotates and extends the shoulder. | inserts on the medial lip of intertubercular sulcus of humerus | shoulder-adduction, shoulder-internal-rotation, shoulder-extension | Inferior angle of scapula | Medial lip of intertubercular sulcus of humerus | Missing articles (label wording inside a sentence) The action part lists the same three movements as latissimus dorsi in a different order (the seed lists the tags in a different order), so the two sentences look less alike than they are. **Grammar only** (articles added): Adducts, internally rotates and extends the shoulder; inserts on the medial lip of the intertubercular sulcus of the humerus. |
| Latissimus Dorsi | Extends, adducts and internally rotates the shoulder; inserts on the floor of intertubercular sulcus of humerus. | Extends, adducts and internally rotates the shoulder. | inserts on the floor of intertubercular sulcus of humerus | shoulder-extension, shoulder-adduction, shoulder-internal-rotation | Spinous processes T7–L5; Iliac crest; Thoracolumbar fascia | Floor of intertubercular sulcus of humerus | Missing articles (label wording inside a sentence) The action part lists the same three movements as teres major in a different order (the seed lists the tags in a different order). **Grammar only** (articles added): Extends, adducts and internally rotates the shoulder; inserts on the floor of the intertubercular sulcus of the humerus. |

### 9. Accessory inspiration, neck lateral flexion

3 muscles share these tags: Scalene Anterior, Scalene Middle, Scalene Posterior.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Scalene Anterior | Laterally flexes the neck and assists inspiration; arises from the transverse processes C3–C6. | Laterally flexes the neck and assists inspiration. | arises from the transverse processes C3–C6 | neck-lateral-flexion, accessory-inspiration | Transverse processes C3–C6 | 1st rib | Missing “of” before the vertebral levels **Grammar only** (“of” added): Laterally flexes the neck and assists inspiration; arises from the transverse processes of C3–C6. |
| Scalene Middle | Laterally flexes the neck and assists inspiration; arises from the transverse processes C2–C7. | Laterally flexes the neck and assists inspiration. | arises from the transverse processes C2–C7 | neck-lateral-flexion, accessory-inspiration | Transverse processes C2–C7 | 1st rib | Missing “of” before the vertebral levels **Grammar only** (“of” added): Laterally flexes the neck and assists inspiration; arises from the transverse processes of C2–C7. |
| Scalene Posterior — LIVE PAPER: Cervical spine 5: a wrong answer (question on Longus Colli) | Laterally flexes the neck and assists inspiration; arises from the transverse processes C4–C6. | Laterally flexes the neck and assists inspiration. | arises from the transverse processes C4–C6 | neck-lateral-flexion, accessory-inspiration | Transverse processes C4–C6 | 2nd rib | Missing “of” before the vertebral levels **Grammar only** (“of” added): Laterally flexes the neck and assists inspiration; arises from the transverse processes of C4–C6. |

### 10. Neck extension, neck lateral flexion, neck rotation

2 muscles share these tags: Splenius Capitis, Splenius Cervicis.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Splenius Capitis | Extends, rotates and laterally flexes the neck; inserts on the mastoid process. | Extends, rotates and laterally flexes the neck. | inserts on the mastoid process | neck-extension, neck-rotation, neck-lateral-flexion | Ligamentum nuchae; Spinous processes C7–T3 | Mastoid process; Lateral superior nuchal line | Reads as a sentence. |
| Splenius Cervicis — LIVE PAPER: Cervical spine 5: a wrong answer (question on Longus Colli) | Extends, rotates and laterally flexes the neck; inserts on the transverse processes C1–C3. | Extends, rotates and laterally flexes the neck. | inserts on the transverse processes C1–C3 | neck-extension, neck-rotation, neck-lateral-flexion | Spinous processes T3–T6 | Transverse processes C1–C3 | Missing “of” before the vertebral levels **Grammar only** (“of” added): Extends, rotates and laterally flexes the neck; inserts on the transverse processes of C1–C3. |

### 11. Spinal extension, trunk lateral flexion

2 muscles share these tags: Iliocostalis, Longissimus.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Iliocostalis | Extends the spine and laterally flexes the trunk; inserts on the angles of ribs. | Extends the spine and laterally flexes the trunk. | inserts on the angles of ribs | spinal-extension, trunk-lateral-flexion | Iliac crest; Sacrum; Lumbar spinous processes | Angles of ribs; Cervical transverse processes | Missing articles (label wording inside a sentence) Its partner longissimus reads “inserts on the ribs”, so the two clauses differ by “angles of”. **Grammar only** (articles added): Extends the spine and laterally flexes the trunk; inserts on the angles of the ribs. |
| Longissimus — LIVE PAPER: Thoracic spine 3: a wrong answer (question on Internal Intercostals) | Extends the spine and laterally flexes the trunk; inserts on the ribs. | Extends the spine and laterally flexes the trunk. | inserts on the ribs | spinal-extension, trunk-lateral-flexion | Sacrum; Iliac crest; Lumbar transverse processes | Ribs; Thoracic & cervical transverse processes; Mastoid process | Too thin to tell it apart Three words, and only the first of the three insertions the seed lists. Iliocostalis, the other muscle in the group, reads “inserts on the angles of ribs”, so the clause barely separates them. |

### 12. Spinal extension

2 muscles share these tags: Spinalis, Interspinales.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Spinalis — LIVE PAPER: Thoracic spine 6: the right answer | Extends the spine; inserts on the spinous processes of upper thoracic & cervical vertebrae. | Extends the spine. | inserts on the spinous processes of upper thoracic & cervical vertebrae | spinal-extension | Spinous processes of upper lumbar & lower thoracic vertebrae | Spinous processes of upper thoracic & cervical vertebrae | Ampersand in a sentence Mostly attachment: 11 words of clause after 3 of action **Grammar only** (“&” written as “and”): Extends the spine; inserts on the spinous processes of upper thoracic and cervical vertebrae. |
| Interspinales | Extends the spine; inserts on the adjacent spinous processes. | Extends the spine. | inserts on the adjacent spinous processes | spinal-extension | Spinous processes of the cervical and lumbar vertebrae | Adjacent spinous processes | Reads as a sentence. |

### 13. Core stabilisation, trunk lateral flexion, trunk rotation

2 muscles share these tags: External Oblique, Internal Oblique.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| External Oblique — LIVE PAPER: Lumbar spine 5: a wrong answer (question on Multifidus) | Rotates and laterally flexes the trunk; stabilises the core; inserts on the linea alba. | Rotates and laterally flexes the trunk; stabilises the core. | inserts on the linea alba | trunk-rotation, trunk-lateral-flexion, core-stabilisation | Ribs 5–12 | Linea alba; Pubic tubercle; Iliac crest | Reads as a sentence. |
| Internal Oblique | Rotates and laterally flexes the trunk; stabilises the core; inserts on the ribs 10–12. | Rotates and laterally flexes the trunk; stabilises the core. | inserts on the ribs 10–12 | trunk-rotation, trunk-lateral-flexion, core-stabilisation | Thoracolumbar fascia; Iliac crest; Inguinal ligament | Ribs 10–12; Linea alba | “The” in front of a numbered range **Grammar only** (“the” dropped): Rotates and laterally flexes the trunk; stabilises the core; inserts on ribs 10–12. |

### 14. Ankle dorsiflexion, toe extension

2 muscles share these tags: Extensor Hallucis Longus, Extensor Digitorum Longus.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Extensor Hallucis Longus | Extends the toes and dorsiflexes the ankle; inserts on the base of distal phalanx of big toe. | Extends the toes and dorsiflexes the ankle. | inserts on the base of distal phalanx of big toe | toe-extension, ankle-dorsiflexion | Middle anterior surface of fibula; Interosseous membrane | Base of distal phalanx of big toe | Missing articles (label wording inside a sentence) The action part says “the toes” for a muscle named for one digit; only the clause says which **Grammar only** (articles added): Extends the toes and dorsiflexes the ankle; inserts on the base of the distal phalanx of the big toe. |
| Extensor Digitorum Longus — LIVE PAPER: Ankle & foot 6: a wrong answer (question on Tibialis Posterior) | Extends the toes and dorsiflexes the ankle; inserts on the distal phalanges of toes 2–5. | Extends the toes and dorsiflexes the ankle. | inserts on the distal phalanges of toes 2–5 | toe-extension, ankle-dorsiflexion | Lateral condyle of tibia; Anterior fibula | Distal phalanges of toes 2–5 | Reads as a sentence. |

### 15. Ankle plantarflexion, foot eversion

2 muscles share these tags: Peroneus Longus, Peroneus Brevis.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Peroneus Longus | Everts the foot and plantarflexes the ankle; inserts on the medial cuneiform. | Everts the foot and plantarflexes the ankle. | inserts on the medial cuneiform | foot-eversion, ankle-plantarflexion | Head & upper lateral fibula | Medial cuneiform; Base of 1st metatarsal | Reads as a sentence. |
| Peroneus Brevis — LIVE PAPER: Ankle & foot 6: a wrong answer (question on Tibialis Posterior) | Everts the foot and weakly assists ankle plantarflexion. | n/a (hand-written) | none | foot-eversion, ankle-plantarflexion | Distal 2/3 lateral fibula | Tuberosity of 5th metatarsal | Hand-written, for comparison. |

### 16. Toe extension

2 muscles share these tags: Extensor Digitorum Brevis, Extensor Hallucis Brevis.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Extensor Digitorum Brevis | Extends the toes; inserts on the digits 2–4. | Extends the toes. | inserts on the digits 2–4 | toe-extension | Dorsal and lateral surface of calcaneus | Digits 2–4 | “The” in front of a numbered range **Grammar only** (“the” dropped): Extends the toes; inserts on digits 2–4. |
| Extensor Hallucis Brevis | Extends the toes; inserts on the proximal phalanx of digit 1. | Extends the toes. | inserts on the proximal phalanx of digit 1 | toe-extension | Dorsal portion of calcaneus | Proximal phalanx of digit 1 | The action part says “the toes” for a muscle named for one digit; only the clause says which Says “digit 1” where the long extensor in the neighbouring group says “big toe”: two names for one toe. |

### 17. Toe flexion

5 muscles share these tags: Flexor Digitorum Brevis, Quadratus Plantae, Flexor Hallucis Brevis, Flexor Digiti Minimi Brevis (Foot), Opponens Digiti Minimi (Foot).

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Flexor Digitorum Brevis | Flexes the toes; inserts on the middle phalanges of toes 2–5. | Flexes the toes. | inserts on the middle phalanges of toes 2–5 | toe-flexion | Medial tubercle of calcaneus; Plantar aponeurosis | Middle phalanges of toes 2–5 | Reads as a sentence. |
| Quadratus Plantae | Assists flexor digitorum longus in flexing toes 2–5, straightening its oblique line of pull. | n/a (hand-written) | none | toe-flexion | Medial and lateral sides of calcaneus | Posterolateral margin of tendon of flexor digitorum longus | Hand-written, for comparison. |
| Flexor Hallucis Brevis | Flexes the toes; inserts on the medial and lateral sides of the base of the proximal phalanx of the big toe. | Flexes the toes. | inserts on the medial and lateral sides of the base of the proximal phalanx of the big toe | toe-flexion | Plantar surfaces of cuboid and lateral cuneiform | Medial and lateral sides of the base of the proximal phalanx of the big toe | Mostly attachment: 18 words of clause after 3 of action The action part says “the toes” for a muscle named for one digit; only the clause says which |
| Flexor Digiti Minimi Brevis (Foot) | Flexes the toes; inserts on the base of proximal phalanx of 5th toe. | Flexes the toes. | inserts on the base of proximal phalanx of 5th toe | toe-flexion | Base of 5th metatarsal | Base of proximal phalanx of 5th toe | Missing articles (label wording inside a sentence) Mostly attachment: 10 words of clause after 3 of action The action part says “the toes” for a muscle named for one digit; only the clause says which **Grammar only** (articles added): Flexes the toes; inserts on the base of the proximal phalanx of the 5th toe. |
| Opponens Digiti Minimi (Foot) | Flexes the toes; inserts on the lateral part of 5th metatarsal. | Flexes the toes. | inserts on the lateral part of 5th metatarsal | toe-flexion | Base of 5th metatarsal; Sheath of peroneus longus | Lateral part of 5th metatarsal | Missing articles (label wording inside a sentence) The action part says “the toes” for a muscle named for one digit; only the clause says which **Grammar only** (articles added): Flexes the toes; inserts on the lateral part of the 5th metatarsal. |

### 18. Toe abduction, toe flexion

2 muscles share these tags: Abductor Hallucis, Abductor Digiti Minimi (Foot).

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Abductor Hallucis | Abducts and flexes the toes; inserts on the medial side of base of proximal phalanx of big toe. | Abducts and flexes the toes. | inserts on the medial side of base of proximal phalanx of big toe | toe-abduction, toe-flexion | Medial tubercle of calcaneus; Flexor retinaculum; Plantar aponeurosis | Medial side of base of proximal phalanx of big toe | Missing articles (label wording inside a sentence) Mostly attachment: 13 words of clause after 5 of action The action part says “the toes” for a muscle named for one digit; only the clause says which **Grammar only** (articles added): Abducts and flexes the toes; inserts on the medial side of the base of the proximal phalanx of the big toe. |
| Abductor Digiti Minimi (Foot) | Abducts and flexes the toes; inserts on the lateral side of base of proximal phalanx of 5th toe. | Abducts and flexes the toes. | inserts on the lateral side of base of proximal phalanx of 5th toe | toe-abduction, toe-flexion | Medial and lateral tubercles of calcaneus; Plantar aponeurosis | Lateral side of base of proximal phalanx of 5th toe | Missing articles (label wording inside a sentence) Mostly attachment: 13 words of clause after 5 of action The action part says “the toes” for a muscle named for one digit; only the clause says which **Grammar only** (articles added): Abducts and flexes the toes; inserts on the lateral side of the base of the proximal phalanx of the 5th toe. |

### 19. Thumb flexion

2 muscles share these tags: Flexor Pollicis Longus, Flexor Pollicis Brevis.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Flexor Pollicis Longus — LIVE PAPER: Wrist & hand 2: a wrong answer (question on Flexor Digitorum Profundus) | Flexes the thumb; inserts on the distal phalanx of the thumb. | Flexes the thumb. | inserts on the distal phalanx of the thumb | thumb-flexion | Anterior surface of radius; Interosseous membrane | Distal phalanx of the thumb | Reads as a sentence. |
| Flexor Pollicis Brevis | Flexes the thumb; inserts on the base of proximal phalanx of thumb. | Flexes the thumb. | inserts on the base of proximal phalanx of thumb | thumb-flexion | Flexor retinaculum; Trapezium | Base of proximal phalanx of thumb | Missing articles (label wording inside a sentence) Mostly attachment: 9 words of clause after 3 of action **Grammar only** (articles added): Flexes the thumb; inserts on the base of the proximal phalanx of the thumb. |

### 20. Radial deviation, wrist extension

2 muscles share these tags: Extensor Carpi Radialis Longus, Extensor Carpi Radialis Brevis.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Extensor Carpi Radialis Longus | Extends and radially deviates the wrist; inserts on the base of 2nd metacarpal. | Extends and radially deviates the wrist. | inserts on the base of 2nd metacarpal | wrist-extension, radial-deviation | Lateral supracondylar ridge of humerus | Base of 2nd metacarpal | Missing articles (label wording inside a sentence) **Grammar only** (articles added): Extends and radially deviates the wrist; inserts on the base of the 2nd metacarpal. |
| Extensor Carpi Radialis Brevis | Extends and radially deviates the wrist; inserts on the base of 3rd metacarpal. | Extends and radially deviates the wrist. | inserts on the base of 3rd metacarpal | wrist-extension, radial-deviation | Lateral epicondyle of humerus | Base of 3rd metacarpal | Missing articles (label wording inside a sentence) **Grammar only** (articles added): Extends and radially deviates the wrist; inserts on the base of the 3rd metacarpal. |

### 21. Finger extension

3 muscles share these tags: Extensor Digitorum, Extensor Digiti Minimi, Extensor Indicis.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Extensor Digitorum | Extends the fingers; inserts on the extensor expansions of digits 2–5. | Extends the fingers. | inserts on the extensor expansions of digits 2–5 | finger-extension | Lateral epicondyle of humerus | Extensor expansions of digits 2–5 | Reads as a sentence. |
| Extensor Digiti Minimi | Extends the fingers; inserts on the extensor expansion of digit 5. | Extends the fingers. | inserts on the extensor expansion of digit 5 | finger-extension | Lateral epicondyle of humerus | Extensor expansion of digit 5 | The action part says “the fingers” for a muscle named for one digit; only the clause says which |
| Extensor Indicis | Extends the fingers; inserts on the extensor expansion of digit 2. | Extends the fingers. | inserts on the extensor expansion of digit 2 | finger-extension | Posterior surface of ulna; Interosseous membrane | Extensor expansion of digit 2 | The action part says “the fingers” for a muscle named for one digit; only the clause says which |

### 22. Thumb extension

2 muscles share these tags: Extensor Pollicis Brevis, Extensor Pollicis Longus.

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Extensor Pollicis Brevis | Extends the thumb; inserts on the base of proximal phalanx of thumb. | Extends the thumb. | inserts on the base of proximal phalanx of thumb | thumb-extension | Posterior surface of radius; Interosseous membrane | Base of proximal phalanx of thumb | Missing articles (label wording inside a sentence) Mostly attachment: 9 words of clause after 3 of action **Grammar only** (articles added): Extends the thumb; inserts on the base of the proximal phalanx of the thumb. |
| Extensor Pollicis Longus | Extends the thumb; inserts on the base of distal phalanx of thumb. | Extends the thumb. | inserts on the base of distal phalanx of thumb | thumb-extension | Posterior surface of ulna; Interosseous membrane | Base of distal phalanx of thumb | Missing articles (label wording inside a sentence) Mostly attachment: 9 words of clause after 3 of action **Grammar only** (articles added): Extends the thumb; inserts on the base of the distal phalanx of the thumb. |

### 23. Finger abduction

2 muscles share these tags: Abductor Digiti Minimi (Hand), Dorsal Interossei (Hand).

| Muscle | The sentence now | Action part alone | Added clause | Action tags | Origin, as stored | Insertion, as stored | How it reads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Abductor Digiti Minimi (Hand) | Abducts the fingers; inserts on the proximal phalanx of digit 5. | Abducts the fingers. | inserts on the proximal phalanx of digit 5 | finger-abduction | Pisiform | Proximal phalanx of digit 5 | The action part says “the fingers” for a muscle named for one digit; only the clause says which |
| Dorsal Interossei (Hand) — LIVE PAPER: Wrist & hand 7: a wrong answer (question on Lumbricals (Hand)) | Abducts the fingers; inserts on the extensor expansions of digits 2–4. | Abducts the fingers. | inserts on the extensor expansions of digits 2–4 | finger-abduction | Adjacent sides of two metacarpals (bipennate) | Extensor expansions of digits 2–4 | Reads as a sentence. |

## Five more groups, already settled by hand

These share their tags with another muscle but each has a hand-written sentence and no added clause.

| Shared tags | Muscle | The sentence now |
| --- | --- | --- |
| Hip external rotation, hip flexion | Iliacus | A powerful hip flexor that also rotates the femur outward; joins psoas major as iliopsoas. |
| Hip external rotation, hip flexion | Psoas Major | The strongest hip flexor, also rotating the femur outward; the lumbar half of iliopsoas. |
| Elbow flexion | Brachialis | The prime mover of elbow flexion, and the one that works in any forearm position. |
| Elbow flexion | Brachioradialis | Flexes the elbow, most effectively with the forearm midway between pronation and supination — the handshake grip. |
| Ankle plantarflexion, knee flexion | Gastrocnemius | Plantarflexes the ankle — most powerfully with the knee extended — and flexes the knee. |
| Ankle plantarflexion, knee flexion | Plantaris | Weakly assists plantarflexion and knee flexion; largely vestigial, and absent in some people. |
| Ankle plantarflexion, toe flexion | Flexor Digitorum Longus | Flexes toes 2–5 and assists ankle plantarflexion. |
| Ankle plantarflexion, toe flexion | Flexor Hallucis Longus | Flexes the big toe and assists ankle plantarflexion; the muscle that drives push-off. |
| Finger flexion, wrist flexion | Flexor Digitorum Superficialis | Flexes the proximal interphalangeal joints of digits 2–5, and assists wrist flexion. |
| Finger flexion, wrist flexion | Flexor Digitorum Profundus | Flexes the distal interphalangeal joints of digits 2–5 — the only muscle that can — and assists wrist flexion. |
