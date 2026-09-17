import { describe, it, expect } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { buildLocateQuestions, isTappableIn } from '../questionGenerators/locate';
import { polygonsWidth } from '../hotspot/polygonGeometry';
import { isOnTarget, TAP_SLACK } from '../hotspot/pointInPolygon';
import { promptHighlightHotspots } from '../promptHighlight';

const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));

describe('polygonsWidth', () => {
  it('reads a long ribbon as its width', () => {
    const ribbon = [[[0, 0], [0.01, 0], [0.01, 0.5], [0, 0.5]]];
    expect(polygonsWidth(ribbon)).toBeCloseTo(0.01, 3);
  });

  it('separates a sliver from a compact shape', () => {
    const blob = [[[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]]];
    const sliver = [[[0, 0], [0.01, 0], [0.01, 1], [0, 1]]];
    expect(polygonsWidth(sliver)).toBeLessThan(polygonsWidth(blob));
  });
});

describe('buildLocateQuestions', () => {
  it('never asks for a target too thin to point at', () => {
    for (const q of buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES)) {
      for (const id of q.frameImageIds ?? [q.imageId]) {
        expect(isTappableIn(imagesById.get(id)!, q.targetStructureId)).toBe(true);
      }
    }
  });

  it('drops the sliver angle of flexor carpi radialis but keeps the one that reads', () => {
    // The lateral forearm plate shows FCR as a two-pixel strip between
    // brachioradialis and the wrist; the anterior plate shows the whole belly.
    const fcr = buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES).filter(
      (q) => q.targetStructureId === 'flexor-carpi-radialis',
    );
    expect(fcr.map((q) => q.imageId)).toEqual(['region-forearm-hand-anterior']);
  });

  it('still builds a locate question for most of the dataset', () => {
    const q = buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES);
    expect(q.length).toBeGreaterThan(600);
    expect(new Set(q.map((x) => x.targetStructureId)).size).toBeGreaterThan(280);
  });
});

describe('isOnTarget', () => {
  const strip = [[[0.4, 0.2], [0.42, 0.2], [0.42, 0.8], [0.4, 0.8]]];

  it('accepts a tap inside', () => {
    expect(isOnTarget([0.41, 0.5], strip)).toBe(true);
  });

  it('accepts a tap a few pixels outside a narrow target', () => {
    expect(isOnTarget([0.42 + TAP_SLACK / 2, 0.5], strip)).toBe(true);
  });

  it('rejects a tap well clear of it', () => {
    expect(isOnTarget([0.6, 0.5], strip)).toBe(false);
  });
});

describe('promptHighlightHotspots', () => {
  it('marks the landmark on its own panel, which is not pre-highlighted', () => {
    const panel = imagesById.get('landmark-ulnar-styloid-process-anterior')!;
    expect(panel.mode).toBe('single-structure');
    expect(promptHighlightHotspots(panel, 'ulnar-styloid-process').length).toBeGreaterThan(0);
  });

  it('leaves a pre-highlighted muscle panel alone', () => {
    const panel = imagesById.get('panel-flexor-carpi-radialis')!;
    expect(promptHighlightHotspots(panel, 'flexor-carpi-radialis')).toEqual([]);
  });

  it('still highlights on an atlas slide', () => {
    const plate = imagesById.get('region-forearm-hand-anterior')!;
    expect(promptHighlightHotspots(plate, 'flexor-carpi-radialis').length).toBeGreaterThan(0);
  });
});
