import { describe, it, expect } from 'vitest';
import { linkImages } from '../linkImages';
import type { MuscleStructure, LandmarkStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';

function makeMuscle(overrides: Partial<MuscleStructure>): MuscleStructure {
  return {
    id: 'test-muscle',
    name: 'Test Muscle',
    category: 'muscle',
    region: 'hip-thigh',
    description: '',
    aliases: [],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: [],
    origin: [],
    insertion: [],
    nerve: [],
    actions: [],
    actionText: '',
    ...overrides,
  };
}

function makeLandmark(overrides: Partial<LandmarkStructure>): LandmarkStructure {
  return {
    id: 'test-landmark',
    name: 'Test Landmark',
    category: 'landmark',
    region: 'hip-thigh',
    description: '',
    aliases: [],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: [],
    attachments: [],
    ...overrides,
  };
}

describe('linkImages', () => {
  it('links a structure to an atlas image when its name appears in panelStructureNames', () => {
    const structures = [makeMuscle({ id: 'trapezius', name: 'Trapezius' })];
    const images: AnatomyImageAsset[] = [
      {
        id: 'slide-1',
        filePath: '/x.png',
        mode: 'atlas-slide',
        panelStructureNames: ['Trapezius', 'Levator scapulae'],
        region: 'back-core',
        view: 'posterior',
        layer: 'superficial-muscle',
        credit: '',
        licence: '',
      },
    ];
    const [linked] = linkImages(structures, images);
    expect(linked.imageIds).toEqual(['slide-1']);
  });

  it('matches via alias when the panel label uses a parenthetical short form', () => {
    const structures = [
      makeLandmark({ id: 'asis', name: 'Anterior Superior Iliac Spine (ASIS)', aliases: ['ASIS'] }),
    ];
    const images: AnatomyImageAsset[] = [
      {
        id: 'pelvis-slide',
        filePath: '/y.png',
        mode: 'atlas-slide',
        panelStructureNames: ['ASIS'],
        region: 'hip-thigh',
        view: 'anterior',
        layer: 'landmark',
        credit: '',
        licence: '',
      },
    ];
    const [linked] = linkImages(structures, images);
    expect(linked.imageIds).toEqual(['pelvis-slide']);
  });

  it('is case-insensitive and strips parentheticals when matching', () => {
    const structures = [makeMuscle({ id: 'lumbricals-hand', name: 'Lumbricals (hand)' })];
    const images: AnatomyImageAsset[] = [
      {
        id: 'hand-slide',
        filePath: '/z.png',
        mode: 'atlas-slide',
        panelStructureNames: ['lumbricals'],
        region: 'forearm-hand',
        view: 'palmar',
        layer: 'superficial-muscle',
        credit: '',
        licence: '',
      },
    ];
    const [linked] = linkImages(structures, images);
    expect(linked.imageIds).toEqual(['hand-slide']);
  });

  it('strips a trailing "muscle(s)" suffix so TA2-style aliases match plain panel labels', () => {
    // e.g. muscles.json names it "Peroneus Longus" but its TA2 alias is
    // "Fibularis longus muscle", while the atlas panel just says "Fibularis longus".
    const structures = [
      makeMuscle({ id: 'peroneus-longus', name: 'Peroneus Longus', aliases: ['Fibularis longus muscle'] }),
    ];
    const images: AnatomyImageAsset[] = [
      {
        id: 'leg-slide',
        filePath: '/l.png',
        mode: 'atlas-slide',
        panelStructureNames: ['Fibularis longus'],
        region: 'lower-leg-foot',
        view: 'posterior',
        layer: 'superficial-muscle',
        credit: '',
        licence: '',
      },
    ];
    const [linked] = linkImages(structures, images);
    expect(linked.imageIds).toEqual(['leg-slide']);
  });

  it('links single-structure images via structureId', () => {
    const structures = [makeMuscle({ id: 'sartorius', name: 'Sartorius' })];
    const images: AnatomyImageAsset[] = [
      {
        id: 'sartorius-img',
        filePath: '/s.png',
        mode: 'single-structure',
        structureId: 'sartorius',
        region: 'hip-thigh',
        view: 'anterior',
        layer: 'superficial-muscle',
        credit: '',
        licence: '',
      },
    ];
    const [linked] = linkImages(structures, images);
    expect(linked.imageIds).toEqual(['sartorius-img']);
  });

  it('does not link unrelated images and leaves existing imageIds untouched otherwise', () => {
    const structures = [makeMuscle({ id: 'gastrocnemius', name: 'Gastrocnemius', imageIds: ['existing'] })];
    const images: AnatomyImageAsset[] = [
      {
        id: 'unrelated',
        filePath: '/u.png',
        mode: 'atlas-slide',
        panelStructureNames: ['Soleus'],
        region: 'lower-leg-foot',
        view: 'posterior',
        layer: 'superficial-muscle',
        credit: '',
        licence: '',
      },
    ];
    const [linked] = linkImages(structures, images);
    expect(linked.imageIds).toEqual(['existing']);
  });
});
