import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { isLigament, reviewedAttachmentIds } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import { buildLocateQuestions } from '../questionGenerators/locate';
import { buildIdentifyTypedQuestions } from '../questionGenerators/identifyTyped';
import { promptImagesFor } from '../questionGenerators/promptImages';
import { rotationFramesFor, rotationTilt } from '../rotationFrames';
import { pointInAnyPolygon } from '../hotspot/pointInPolygon';
import { polygonsWidth } from '../hotspot/polygonGeometry';

/**
 * The nine ligaments tranche 2 could not publish, over the SHIPPED seed
 * (src/test/setup.ts has attached the hotspots).
 */
const WRIST_FIVE = [
  'scapholunate-interosseous-ligament',
  'lunotriquetral-interosseous-ligament',
  'trapeziotrapezoidal-interosseous-ligament',
  'trapezoideocapitate-interosseous-ligament',
  'capitohamate-interosseous-ligament',
];
const KNEE_PAIR = [
  'anterior-meniscotibial-ligament-lateral-meniscus',
  'anterior-meniscotibial-ligament-medial-meniscus',
];
const ORDINARY = ['intertransverse-ligaments', 'palmar-trapezoideocapitate-ligament'];

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const locate = buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES);
const locateFor = (id: string) => locate.filter((q) => q.structureId === id);
const platesOf = (id: string, kind: 'context' | 'highlight') =>
  ALL_IMAGES.filter((i) => i.id.startsWith(`ligament-${id}-a`) && i.id.endsWith(`-${kind}`));
const withVariant = ALL_IMAGES.filter((i): i is AnatomyImageAsset & { variant: NonNullable<AnatomyImageAsset['variant']> } => !!i.variant);

describe('the buried ligaments are seeded, each asked once', () => {
  it.each([...WRIST_FIVE, ...KNEE_PAIR, ...ORDINARY])('%s is a ligament with reviewed attachments and one locate question', (id) => {
    const s = byId.get(id);
    expect(s && isLigament(s)).toBe(true);
    if (!s || !isLigament(s)) return;
    expect(s.eligibility.locate).toBe(true);
    expect(reviewedAttachmentIds(s).length).toBeGreaterThanOrEqual(2);
    for (const attachment of reviewedAttachmentIds(s)) expect(byId.has(attachment), attachment).toBe(true);
    expect(locateFor(id)).toHaveLength(1);
  });

  it('asks the name and both attachments in the typed identify question', () => {
    const typed = buildIdentifyTypedQuestions(ALL_STRUCTURES, ALL_IMAGES);
    for (const id of [...WRIST_FIVE, ...KNEE_PAIR, 'palmar-trapezoideocapitate-ligament']) {
      const mine = typed.filter((q) => q.structureId === id);
      expect(mine, id).toHaveLength(1);
      expect(mine[0].attachmentSlots, id).toHaveLength(2);
      expect(mine[0].promptImageId, id).toMatch(/-highlight$/);
    }
  });
});

describe('the interosseous ligaments of the wrist', () => {
  it('are located on the carpal gap plate and nowhere else', () => {
    for (const id of WRIST_FIVE) {
      const [q] = locateFor(id);
      expect(q.imageId, id).toMatch(/^gap-carpal-gaps-a\d{3}-plate$/);
      for (const frame of q.frameImageIds ?? []) expect(frame, id).toMatch(/^gap-carpal-gaps-/);
      // No hotspot for them on any ligament plate, their own included.
      const elsewhere = ALL_IMAGES.filter((i) => !i.id.startsWith('gap-') && (i.hotspots ?? []).some((h) => h.structureId === id));
      expect(elsewhere.map((i) => i.id), id).toEqual([]);
      expect(platesOf(id, 'context'), id).toEqual([]);
    }
  });

  it('are identified on their own ghosted plate, with solid bones a switch away on every frame', () => {
    for (const id of WRIST_FIVE) {
      const highlights = platesOf(id, 'highlight');
      expect(highlights.length, id).toBeGreaterThanOrEqual(4);
      const [opener] = promptImagesFor(byId.get(id)!, ALL_IMAGES);
      expect(highlights, id).toContain(opener);
      for (const image of highlights) {
        expect(image.variant?.kind, image.id).toBe('solid');
        expect(image.variant?.subject, image.id).toBe('Bones');
        expect(image.hotspots ?? [], image.id).toEqual([]);
      }
    }
  });

  it('are taught as two sets: the proximal row and the distal row', () => {
    const groupOf = (id: string) => byId.get(id)?.groups;
    expect(WRIST_FIVE.slice(0, 2).map(groupOf)).toEqual(Array(2).fill(['proximal-row-interosseous-ligaments']));
    expect(WRIST_FIVE.slice(2).map(groupOf)).toEqual(Array(3).fill(['distal-row-interosseous-ligaments']));
  });

  it('have a band that is the seam plus a catch area, the seam inside it', () => {
    const plates = ALL_IMAGES.filter((i) => i.id.startsWith('gap-carpal-gaps-'));
    expect(plates).toHaveLength(6);
    for (const plate of plates) {
      expect(plate.panelStructureNames, plate.id).toEqual([]);
      for (const h of plate.hotspots ?? []) {
        expect(WRIST_FIVE, plate.id).toContain(h.structureId);
        expect(h.targetCore?.length, `${plate.id} ${h.structureId}`).toBeGreaterThan(0);
        for (const ring of h.targetCore ?? []) {
          const cx = ring.reduce((n, p) => n + p[0], 0) / ring.length;
          const cy = ring.reduce((n, p) => n + p[1], 0) / ring.length;
          // The middle of the seam is in this band and in no other.
          const owners = (plate.hotspots ?? []).filter((o) => pointInAnyPolygon([cx, cy], o.polygons)).map((o) => o.structureId);
          expect(owners.filter((o) => o !== h.structureId), `${plate.id} ${h.structureId}`).toEqual([]);
        }
      }
    }
  });

  it('are asked only where the gap is a line: palmar, dorsal and the obliques beside them', () => {
    // From the side one carpal stands behind the next and the "gap" is two
    // silhouettes overlapping; those views are not published at all.
    const angles = ALL_IMAGES.filter((i) => i.id.startsWith('gap-carpal-gaps-')).map((i) => Number(/-a(\d{3})-/.exec(i.id)![1])).sort((a, b) => a - b);
    expect(angles).toEqual([0, 30, 150, 180, 210, 330]);
    for (const id of WRIST_FIVE) {
      const [q] = locateFor(id);
      expect(q.frameImageIds?.length ?? 1, id).toBeGreaterThanOrEqual(5);
    }
  });

  it('have bands a fingertip can find at 1x on a phone', () => {
    for (const plate of ALL_IMAGES.filter((i) => i.id.startsWith('gap-carpal-gaps-'))) {
      for (const h of plate.hotspots ?? []) {
        // Three percent of a 390px screen is 12px, before the tap slack either side.
        expect(polygonsWidth(h.polygons, h.area), `${plate.id} ${h.structureId}`).toBeGreaterThanOrEqual(0.03);
      }
    }
  });
});

describe('the meniscotibial pair', () => {
  it('are published from above only, and turn round up there', () => {
    for (const id of KNEE_PAIR) {
      for (const kind of ['context', 'highlight'] as const) {
        const plates = platesOf(id, kind);
        expect(plates.length, `${id} ${kind}`).toBeGreaterThanOrEqual(4);
        expect(plates.filter((p) => rotationTilt(p.id) === 0), `${id} ${kind}`).toEqual([]);
        expect(rotationFramesFor(plates[0], ALL_IMAGES), `${id} ${kind}`).toHaveLength(plates.length);
      }
    }
  });

  it('do not all carry one view name', () => {
    for (const id of KNEE_PAIR) {
      const views = new Set(platesOf(id, 'context').map((p) => p.view));
      expect(views.size, id).toBeGreaterThan(1);
      const steep = platesOf(id, 'context').filter((p) => Math.abs(rotationTilt(p.id)) >= 80);
      for (const p of steep) expect(p.view, p.id).toBe('superior');
      for (const p of platesOf(id, 'context').filter((x) => Math.abs(rotationTilt(x.id)) < 80)) expect(p.view, p.id).not.toBe('superior');
    }
  });

  it('offer the femur hidden on every frame, locate and identify alike', () => {
    for (const id of KNEE_PAIR) {
      for (const image of [...platesOf(id, 'context'), ...platesOf(id, 'highlight')]) {
        expect(image.variant?.kind, image.id).toBe('hidden');
        expect(image.variant?.subject, image.id).toBe('Femur');
      }
      const [q] = locateFor(id);
      expect(q.imageId).toMatch(new RegExp(`^ligament-${id}-a\\d{3}u\\d{3}-context$`));
    }
  });
});

describe('a second render is the same frame', () => {
  it('exists for some frames, and only where it was meant to', () => {
    expect(withVariant.length).toBeGreaterThan(0);
    const owners = new Set(withVariant.map((i) => i.id.replace(/^ligament-/, '').replace(/-a\d{3}(?:[ud]\d{3})?-(context|highlight)$/, '')));
    expect([...owners].sort()).toEqual([...WRIST_FIVE, ...KNEE_PAIR].sort());
  });

  it('is named beside its frame, with the variant outside the angle segment', () => {
    for (const image of withVariant) {
      expect(image.variant.filePath, image.id).toBe(image.filePath.replace(/\.webp$/, `.${image.variant.kind}.webp`));
    }
  });

  it('is on disk at the same pixel size as the default', async () => {
    for (const image of withVariant) {
      const file = join(process.cwd(), 'public', image.variant.filePath);
      expect(existsSync(file), image.variant.filePath).toBe(true);
      const meta = await sharp(file).metadata();
      expect([meta.width, meta.height], image.variant.filePath).toEqual([image.width, image.height]);
      const own = await sharp(join(process.cwd(), 'public', image.filePath)).metadata();
      expect([own.width, own.height], image.filePath).toEqual([image.width, image.height]);
    }
  });

  it('is never an image of its own: nothing in the catalogue points at a variant file', () => {
    const variantFiles = new Set(withVariant.map((i) => i.variant.filePath));
    expect(ALL_IMAGES.filter((i) => variantFiles.has(i.filePath)).map((i) => i.id)).toEqual([]);
  });
});
