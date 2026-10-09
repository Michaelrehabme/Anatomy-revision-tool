import { describe, expect, it } from 'vitest';
import { answerItems, isAnswerMatch, itemVariants } from '../answerMatching';

describe('an answer that names several things', () => {
  it('is one item for each of them', () => {
    expect(answerItems('Gluteus medius/minimus')).toEqual(['Gluteus medius', 'Gluteus minimus']);
    expect(answerItems('Rhomboid major/minor')).toEqual(['Rhomboid major', 'Rhomboid minor']);
    expect(answerItems('Sartorius, gracilis, semitendinosus')).toEqual(['Sartorius', 'gracilis', 'semitendinosus']);
    expect(answerItems('tibia and patella')).toEqual(['tibia', 'patella']);
    expect(answerItems('Proximal and distal tibiofibular joints')).toEqual(['Proximal tibiofibular joints', 'distal tibiofibular joints']);
    expect(answerItems('Fibularis longus and brevis')).toEqual(['Fibularis longus', 'Fibularis brevis']);
    expect(answerItems('Alar and apical ligaments')).toEqual(['Alar ligaments', 'apical ligaments']);
  });

  it('borrows no words without a cue', () => {
    expect(answerItems('Trapezius and rhomboid minor')).toEqual(['Trapezius', 'rhomboid minor']);
    expect(answerItems('Coracobrachialis and short head of biceps brachii')).toEqual(['Coracobrachialis', 'short head of biceps brachii']);
    expect(answerItems('Diaphragm and abdominal wall muscles')).toEqual(['Diaphragm', 'abdominal wall muscles']);
  });

  it('drops what cannot be typed, and leaves a phrase or a single answer whole', () => {
    expect(answerItems('Piriformis and other short external rotators')).toEqual(['Piriformis']);
    expect(answerItems('ribs 1–8/9')).toEqual(['ribs 1–8/9']);
    expect(answerItems('atlas, between the occipital condyles and the superior articular facets')).toHaveLength(1);
    expect(answerItems('gluteal tuberosity')).toEqual(['gluteal tuberosity']);
  });

  it('takes the gym word for a glute, and a ligament without the word ligament', () => {
    expect(isAnswerMatch('glute medius', itemVariants('Gluteus medius'))).toBe(true);
    expect(isAnswerMatch('iliofemoral', itemVariants('Iliofemoral ligament'))).toBe(true);
    expect(isAnswerMatch('gluteus maximus', itemVariants('Gluteus medius'))).toBe(false);
  });
});
