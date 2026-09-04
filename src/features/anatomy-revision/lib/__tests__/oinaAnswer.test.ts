import { describe, it, expect } from 'vitest';
import { acceptedVariantsFor, gradeTypedSlots, matchesSlot, normalizeForGrading } from '../oinaAnswer';
import { conflictsWith, stripHeadPrefix } from '../oinaValues';
import { ALL_STRUCTURES } from '../../data/seed';
import { isMuscle } from '../../types/structure';

const slotFor = (raw: string) => acceptedVariantsFor('origin', raw);
const grade = (input: string, raw: string) => matchesSlot(input, slotFor(raw));

describe('normalizeForGrading', () => {
  it('folds what a student cannot type', () => {
    expect(normalizeForGrading('Spinous processes C7–T12')).toBe('spinous processes c7-t12');
    expect(normalizeForGrading('Sternum & costal cartilages 1–6')).toBe('sternum and costal cartilages 1-6');
    expect(normalizeForGrading("Gerdy's tubercle")).toBe('gerdys tubercle');
    expect(normalizeForGrading('  The   Ischial  Tuberosity ')).toBe('ischial tuberosity');
  });
});

describe('typed answer matching', () => {
  it('accepts a one-character typo', () => {
    expect(grade('ischial tuberocity', 'Ischial tuberosity')).toBe(true);
    expect(grade('linea aspara of the femur', 'Short head: linea aspera of the femur')).toBe(true);
  });

  it('accepts either site of a value that names two', () => {
    const raw = 'Long head: supraglenoid tubercle & adjacent glenoid labrum';
    expect(grade('supraglenoid tubercle', raw)).toBe(true);
    expect(grade('Supraglenoid tubercle and adjacent glenoid labrum', raw)).toBe(true);
    expect(grade('costal cartilages 1-6', 'Sternocostal head: sternum & costal cartilages 1–6')).toBe(true);
  });

  it('accepts an abbreviation, and an answer that omits one', () => {
    expect(grade('ASIS', 'Anterior superior iliac spine (ASIS)')).toBe(true);
    expect(grade('anterior superior iliac spine', 'Anterior superior iliac spine (ASIS)')).toBe(true);
  });

  it('tolerates one extra word of context but not a whole other attachment', () => {
    expect(grade('supraglenoid tubercle of the scapula', 'Supraglenoid tubercle')).toBe(true);
    expect(grade("Iliotibial band (inserting into the lateral tibial condyle — Gerdy's tubercle)", 'Lateral condyle of tibia')).toBe(false);
  });

  it('is word-order independent', () => {
    expect(grade('femur, linea aspera of the', 'Short head: linea aspera of the femur')).toBe(true);
  });

  /**
   * The cases that killed the obvious implementation (an edit-distance
   * tolerance scaled by string length): every one of these differs from the
   * expected answer by one or two characters, and every one is a different
   * place in the body.
   */
  it('rejects a different attachment that differs by one word or one character', () => {
    expect(grade('lesser trochanter of the femur', 'Greater trochanter of the femur')).toBe(false);
    expect(grade('infraspinous fossa of scapula', 'Supraspinous fossa of scapula')).toBe(false);
    expect(grade('base of 3rd metacarpal', 'Base of 2nd metacarpal')).toBe(false);
    expect(grade('base of 1st metacarpal', 'Base of 1st metatarsal')).toBe(false);
    expect(grade('spinous processes C7-T1', 'Spinous processes C7–T12')).toBe(false);
    expect(grade('tendons of flexor digitorum profundus', 'Tendons of flexor digitorum longus')).toBe(false);
    expect(grade('anterior superior iliac spine', 'Anterior Inferior Iliac Spine (AIIS)')).toBe(false);
    expect(grade('transverse processes of the cervical and lumbar vertebrae', 'Spinous processes of the cervical and lumbar vertebrae')).toBe(false);
  });

  it('rejects an empty or unrelated answer', () => {
    expect(grade('', 'Ischial tuberosity')).toBe(false);
    expect(grade('   ', 'Ischial tuberosity')).toBe(false);
    expect(grade('the femur', 'Ischial tuberosity')).toBe(false);
  });

  it('accepts a nerve named without the word "nerve"', () => {
    expect(matchesSlot('musculocutaneous', acceptedVariantsFor('nerve', 'Musculocutaneous nerve'))).toBe(true);
    expect(matchesSlot('femoral nerve', acceptedVariantsFor('nerve', 'Femoral nerve'))).toBe(true);
    expect(matchesSlot('obturator nerve', acceptedVariantsFor('nerve', 'Femoral nerve'))).toBe(false);
  });
});

/**
 * The invariant the whole grader exists to hold: no authored attachment may
 * ever grade as a correct answer for a different one. The exceptions below
 * are pairs that name the same site in two wordings — accepting those is
 * correct behaviour, and each is listed explicitly so that a regression
 * shows up as a new entry rather than a silently larger number.
 */
const SAME_SITE_DIFFERENT_WORDING = new Set([
  'Iliotibial band (inserting into the lateral tibial condyle — Gerdy\'s tubercle) <= Iliotibial band (ITB)',
  'Coronoid process & ulnar tuberosity <= Coronoid process of ulna',
  'Medial & lateral femoral condyles <= Lateral surface of the lateral femoral condyle',
  'Posterior surface of radius <= Posterior surfaces of ulna and radius',
  'Posterior surface of ulna <= Posterior surfaces of ulna and radius',
]);

describe('no authored attachment grades as another', () => {
  it('holds across every pair in the dataset', () => {
    const raws = new Map<string, string>();
    for (const m of ALL_STRUCTURES.filter(isMuscle)) {
      for (const v of [...m.origin, ...m.insertion]) raws.set(stripHeadPrefix(v), v);
    }
    const canonicals = [...raws.keys()];

    const unexpected: string[] = [];
    for (const expected of canonicals) {
      const accepted = slotFor(raws.get(expected)!);
      for (const typed of canonicals) {
        if (expected === typed) continue;
        if (conflictsWith(expected, typed)) continue; // already known to name the same site
        if (!matchesSlot(typed, accepted)) continue;
        const key = `${expected} <= ${typed}`;
        if (!SAME_SITE_DIFFERENT_WORDING.has(key)) unexpected.push(key);
      }
    }
    expect(unexpected).toEqual([]);
  });
});

describe('gradeTypedSlots', () => {
  const slots = [
    { label: 'Origin 1 of 2', accepted: slotFor('Long head: ischial tuberosity') },
    { label: 'Origin 2 of 2', accepted: slotFor('Short head: linea aspera of the femur') },
  ];

  it('accepts the two heads in either order', () => {
    expect(gradeTypedSlots(['ischial tuberosity', 'linea aspera of the femur'], slots).allCorrect).toBe(true);
    expect(gradeTypedSlots(['linea aspera of the femur', 'ischial tuberosity'], slots).allCorrect).toBe(true);
  });

  it('marks the question wrong but reports which slot was missed', () => {
    const result = gradeTypedSlots(['ischial tuberosity', ''], slots);
    expect(result.allCorrect).toBe(false);
    expect(result.slotCorrect).toEqual([true, false]);
    expect(result.correctCount).toBe(1);
  });

  it('never lets one input satisfy two slots', () => {
    const result = gradeTypedSlots(['ischial tuberosity', 'ischial tuberosity'], slots);
    expect(result.slotCorrect).toEqual([true, false]);
    expect(result.matchedInputIndex[0]).toBe(0);
    expect(result.matchedInputIndex[1]).toBeNull();
  });

  /** Guards the first-fit shortcut in gradeTypedSlots — see its doc comment. */
  it('has no muscle whose own values could match each other', () => {
    const ambiguous: string[] = [];
    for (const m of ALL_STRUCTURES.filter(isMuscle)) {
      for (const field of ['origin', 'insertion'] as const) {
        const values = [...new Set(m[field].map(stripHeadPrefix))];
        for (const a of values) {
          for (const b of values) {
            if (a !== b && matchesSlot(b, slotFor(a))) ambiguous.push(`${m.id}.${field}: ${a} <= ${b}`);
          }
        }
      }
    }
    expect(ambiguous).toEqual([]);
  });
});
