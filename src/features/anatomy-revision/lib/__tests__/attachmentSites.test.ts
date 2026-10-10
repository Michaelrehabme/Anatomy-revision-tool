import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { isLigament } from '../../types/structure';
import { siteLabel } from '../attachmentSites';
import { gradeTypedSlots } from '../oinaAnswer';
import { buildIdentifyTypedQuestions } from '../questionGenerators/identifyTyped';

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const label = (id: string) => siteLabel(byId.get(id)!, byId);

describe('an attachment reads as "landmark of bone"', () => {
  it('names the bone a landmark is on', () => {
    expect(label('greater-trochanter')).toBe('Greater Trochanter of the femur');
    expect(label('intertrochanteric-line')).toBe('Intertrochanteric Line of the femur');
    expect(label('dens-odontoid-process')).toBe('Dens (Odontoid Process) of the axis');
    expect(label('acetabulum')).toBe('Acetabulum of the hip bone');
    expect(label('coracoid-process')).toBe('Coracoid Process of the scapula');
  });

  it('leaves a bone, a bone filed as a landmark, and a name that already says its bone', () => {
    expect(label('femur')).toBe('Femur');
    expect(label('ilium')).toBe('Ilium');
    expect(label('scaphoid')).toBe('Scaphoid');
    expect(label('head-of-fibula')).toBe('Head of Fibula');
    // The adjective names the bone too.
    expect(label('ischial-tuberosity')).toBe('Ischial Tuberosity');
    expect(label('aiis')).toBe('Anterior Inferior Iliac Spine (AIIS)');
    expect(label('femoral-head')).toBe('Femoral Head');
    expect(label('medial-condyle-femur')).toBe('Medial Condyle of Femur');
  });

  it('prints every ligament attachment without saying "of the X" twice', () => {
    for (const l of ALL_STRUCTURES.filter(isLigament)) {
      for (const id of l.attachmentStructureIds) {
        const site = byId.get(id);
        if (site) expect(siteLabel(site, byId), `${l.id}: ${id}`).not.toMatch(/ of (?:the )?(\w+) of the \1/i);
      }
    }
  });
});

describe('a bonus box takes the landmark with or without its bone', () => {
  const question = buildIdentifyTypedQuestions(ALL_STRUCTURES, ALL_IMAGES).find((q) => q.structureId === 'ischiofemoral-ligament')!;
  const slots = question.attachmentSlots!;
  const right = (...typed: string[]) => gradeTypedSlots(typed, slots).correctCount;

  it('shows the full form', () => {
    expect(slots.map((s) => s.accepted[0]).sort()).toEqual(['Greater Trochanter of the femur', 'Ischium']);
  });

  it('is right for the landmark alone, and with its bone', () => {
    expect(right('greater trochanter', 'ischium')).toBe(2);
    expect(right('greater trochanter of the femur', 'ischium')).toBe(2);
  });

  it('is not right for the bone alone', () => {
    expect(right('femur', 'pelvis')).toBe(0);
  });
});
