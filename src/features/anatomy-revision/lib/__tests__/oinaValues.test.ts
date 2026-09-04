import { describe, it, expect } from 'vitest';
import {
  stripHeadPrefix,
  humanizeActionTag,
  actionsConflict,
  canonicalNerveNames,
  conflictsWith,
} from '../oinaValues';
import { ALL_STRUCTURES } from '../../data/seed';
import { isMuscle } from '../../types/structure';

const muscles = ALL_STRUCTURES.filter(isMuscle);
const byId = new Map(muscles.map((m) => [m.id, m]));

describe('stripHeadPrefix', () => {
  it('strips the "<head>:" prefix that only multi-headed muscles carry', () => {
    expect(stripHeadPrefix('Long head: ischial tuberosity')).toBe('Ischial tuberosity');
    expect(stripHeadPrefix('Short head: linea aspera of the femur')).toBe('Linea aspera of the femur');
    expect(stripHeadPrefix('Sternocostal head: sternum & costal cartilages 1–6')).toBe('Sternum & costal cartilages 1–6');
  });

  it('strips gemelli\'s "Superior:"/"Inferior:", which do not use the word "head"', () => {
    expect(stripHeadPrefix('Superior: ischial spine')).toBe('Ischial spine');
    expect(stripHeadPrefix('Inferior: ischial tuberosity')).toBe('Ischial tuberosity');
  });

  it('strips pronator teres\' trailing head qualifier', () => {
    expect(stripHeadPrefix('Medial epicondyle of humerus (humeral head)')).toBe('Medial epicondyle of humerus');
    expect(stripHeadPrefix('Coronoid process of ulna (ulnar head)')).toBe('Coronoid process of ulna');
  });

  it('leaves values that merely contain the word "head" alone', () => {
    expect(stripHeadPrefix('Head of the fibula')).toBe('Head of the fibula');
    expect(stripHeadPrefix('Head & upper lateral fibula')).toBe('Head & upper lateral fibula');
  });

  it('keeps meaningful trailing parentheticals', () => {
    expect(stripHeadPrefix('Anterior superior iliac spine (ASIS)')).toBe('Anterior superior iliac spine (ASIS)');
    expect(stripHeadPrefix('Metacarpals (unipennate)')).toBe('Metacarpals (unipennate)');
    expect(stripHeadPrefix('Proximal medial surface of the tibia (pes anserinus)')).toBe(
      'Proximal medial surface of the tibia (pes anserinus)',
    );
  });

  it('collapses triceps brachii to two distinct origins — its lateral and medial heads share one site', () => {
    const triceps = byId.get('triceps-brachii')!;
    expect(triceps.origin).toHaveLength(3);
    expect(new Set(triceps.origin.map(stripHeadPrefix)).size).toBe(2);
  });

  it('never produces an empty or duplicated value across the whole dataset', () => {
    for (const m of muscles) {
      for (const field of ['origin', 'insertion'] as const) {
        const stripped = m[field].map(stripHeadPrefix);
        expect(stripped.every((v) => v.length > 0), `${m.id}.${field}`).toBe(true);
      }
    }
  });
});

describe('canonicalNerveNames', () => {
  it('strips head/part qualifiers so the nerve itself is the answer', () => {
    expect(canonicalNerveNames(byId.get('biceps-femoris')!.nerve)).toEqual([
      'Tibial nerve',
      'Common fibular nerve',
    ]);
    expect(canonicalNerveNames(byId.get('flexor-digitorum-profundus')!.nerve)).toEqual([
      'Ulnar nerve',
      'Median nerve',
    ]);
  });

  it('folds the mid-string synonym form onto the spelling the rest of the data uses', () => {
    expect(canonicalNerveNames([{ name: 'Deep fibular (peroneal) nerve', roots: [] }])).toEqual(['Deep fibular nerve']);
    expect(canonicalNerveNames([{ name: 'Spinal accessory nerve (CN XI)', roots: [] }])).toEqual(['Spinal accessory nerve']);
  });

  it('drops bare root designations, which are not nerve names', () => {
    expect(canonicalNerveNames(byId.get('trapezius')!.nerve)).toEqual(['Spinal accessory nerve']);
    expect(canonicalNerveNames(byId.get('levator-scapulae')!.nerve)).toEqual(['Dorsal scapular nerve']);
  });

  it('drops the hedged accessory obturator nerve rather than requiring it', () => {
    expect(canonicalNerveNames(byId.get('pectineus')!.nerve)).toEqual(['Femoral nerve']);
  });

  it('splits the three authored strings that pack two nerves into one', () => {
    expect(canonicalNerveNames([{ name: 'Lateral & medial pectoral nerves', roots: [] }])).toEqual([
      'Lateral pectoral nerve',
      'Medial pectoral nerve',
    ]);
    expect(canonicalNerveNames([{ name: 'Upper & lower subscapular nerves', roots: [] }])).toEqual([
      'Upper subscapular nerve',
      'Lower subscapular nerve',
    ]);
  });

  it('folds dorsal and posterior rami onto one canonical name', () => {
    expect(canonicalNerveNames([{ name: 'Posterior rami of spinal nerves', roots: [] }])).toEqual([
      'Dorsal rami of spinal nerves',
    ]);
    expect(canonicalNerveNames([{ name: 'Dorsal & ventral rami', roots: [] }])).toEqual([
      'Dorsal rami of spinal nerves',
      'Ventral rami',
    ]);
  });

  it('leaves every muscle with at least one answerable nerve', () => {
    const empty = muscles.filter((m) => canonicalNerveNames(m.nerve).length === 0).map((m) => m.id);
    expect(empty).toEqual([]);
  });
});

describe('conflictsWith', () => {
  it('flags values naming the same site in different words', () => {
    expect(conflictsWith('Greater trochanter of the femur', 'Greater trochanter')).toBe(true);
    expect(conflictsWith('Anterior fibula', 'Distal anterior fibula')).toBe(true);
    expect(conflictsWith('Inferior ramus of pubis', 'Inferior ramus of the pubis')).toBe(true);
  });

  it('keeps genuine discriminations — those are the questions worth asking', () => {
    expect(conflictsWith('Supraspinous fossa of scapula', 'Infraspinous fossa of scapula')).toBe(false);
    expect(conflictsWith('Base of 2nd metacarpal', 'Base of 3rd metacarpal')).toBe(false);
    expect(conflictsWith('Greater trochanter of the femur', 'Lesser trochanter of the femur')).toBe(false);
  });
});

describe('action tags', () => {
  it('humanizes to sentence case', () => {
    expect(humanizeActionTag('knee-external-rotation')).toBe('Knee external rotation');
    expect(humanizeActionTag('hip-flexion')).toBe('Hip flexion');
  });

  it('treats the stabilisation family as interchangeable', () => {
    expect(actionsConflict('hip-stabilisation', 'pelvic-stabilisation')).toBe(true);
    expect(actionsConflict('core-stabilisation', 'spinal-stabilisation')).toBe(true);
    expect(actionsConflict('inspiration', 'accessory-inspiration')).toBe(true);
  });

  it('keeps opposing movements distinct', () => {
    expect(actionsConflict('hip-internal-rotation', 'hip-external-rotation')).toBe(false);
    expect(actionsConflict('knee-flexion', 'knee-extension')).toBe(false);
  });
});
