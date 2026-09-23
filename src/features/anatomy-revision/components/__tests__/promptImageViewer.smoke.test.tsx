import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdentifyTypedSession } from '../IdentifyTypedSession/IdentifyTypedSession';
import { buildIdentifyTypedQuestions } from '../../lib/questionGenerators/identifyTyped';
import { rotationFramesFor, rotationSetKey, rotationAngle } from '../../lib/rotationFrames';
import { promptHighlightFrames } from '../../lib/promptHighlight';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import type { TypedIdentifyQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
});

/**
 * A student should be able to walk round an identify picture and lean into it,
 * the way they could always do on a locate one.
 *
 * The viewer was built for locate and lived inside HotspotImage, so identify
 * and MCQ — which show the SAME plates — drew them flat: one fixed angle, no
 * zoom, recognise it or do not. These assert the two halves of the fix, the
 * grouping and the controls, against the real seed rather than a fixture, so
 * they fail if a render ever ships without its angles.
 */
describe('rotationFramesFor', () => {
  it('reads the set and the angle out of an id', () => {
    expect(rotationSetKey('sub-forefoot-a030-plate')).toBe('sub-forefoot-*-plate');
    expect(rotationAngle('sub-forefoot-a030-plate')).toBe(30);
    expect(rotationSetKey('sub-forefoot-plantar')).toBeNull();
    expect(rotationAngle('sub-forefoot-plantar')).toBeNull();
  });

  it('gives back nothing for a picture that is not one of a set', () => {
    const lone = ALL_IMAGES.find((i) => !rotationSetKey(i.id));
    expect(lone).toBeDefined();
    expect(rotationFramesFor(lone, ALL_IMAGES)).toEqual([]);
  });

  it('gathers every angle of a set, in angle order, including the one it was given', () => {
    const frame = ALL_IMAGES.find((i) => rotationSetKey(i.id));
    expect(frame).toBeDefined();
    const frames = rotationFramesFor(frame, ALL_IMAGES);
    expect(frames.length).toBeGreaterThan(1);
    expect(frames).toContain(frame);
    const angles = frames.map((f) => rotationAngle(f.id)!);
    expect([...angles].sort((a, b) => a - b)).toEqual(angles);
    expect(new Set(frames.map((f) => rotationSetKey(f.id))).size).toBe(1);
  });
});

describe('an identify question whose picture is a rotation set', () => {
  const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
  const question = buildIdentifyTypedQuestions(ALL_STRUCTURES, ALL_IMAGES).find(
    (q): q is TypedIdentifyQuestion =>
      !!q.promptImageId && rotationFramesFor(imagesById.get(q.promptImageId), ALL_IMAGES).length > 1,
  );

  it('offers turning and zooming, not a flat picture', () => {
    expect(question).toBeDefined();
    render(<IdentifyTypedSession question={question!} imagesById={imagesById} onAnswer={vi.fn()} onNext={vi.fn()} examMode />);

    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    expect(screen.getByLabelText('Rotate right')).toBeInTheDocument();

    const before = (screen.getByRole('img') as HTMLImageElement).src;
    fireEvent.click(screen.getByLabelText('Rotate right'));
    expect((screen.getByRole('img') as HTMLImageElement).src).not.toBe(before);
  });

  it('does not let the picture be answered on — that is what locate is for', () => {
    render(<IdentifyTypedSession question={question!} imagesById={imagesById} onAnswer={vi.fn()} onNext={vi.fn()} examMode />);
    // The stage takes no button role, so nothing invites a tap at the target.
    const stage = screen.getByRole('img').closest('div');
    expect(stage?.parentElement?.getAttribute('role')).toBeNull();
  });
});

describe('the highlight turns with the picture', () => {
  /*
   * ON A FIXTURE, NOT THE SEED. Identify now opens on the plate framed for the
   * structure (promptImages.ts), and for every rotatable structure that is a
   * pre-highlighted plate carrying no hotspots — so no shipped question drives
   * the app-drawn overlay any more. The rule it protects is still live for any
   * set whose frames DO carry hotspots, so it is asserted against frames built
   * here rather than found in the seed.
   */
  const frame = (angle: number, x: number): AnatomyImageAsset => ({
    id: `sub-fixture-a${String(angle).padStart(3, '0')}-plate`,
    filePath: `/x/a${angle}.webp`,
    mode: 'atlas-slide',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    view: 'anterior',
    layer: 'skeletal',
    credit: 'c',
    licence: 'l',
    width: 1400,
    height: 1400,
    hotspots: [
      { structureId: 'fixture-structure', polygons: [[[x, 0.1], [x + 0.2, 0.1], [x + 0.2, 0.3]]], area: 0.02, centroid: [x + 0.1, 0.17] },
    ],
  });
  const fixtureFrames = [frame(0, 0.1), frame(45, 0.4), frame(90, 0.6)];
  const imagesById = new Map<string, AnatomyImageAsset>(fixtureFrames.map((f) => [f.id, f]));
  const question: TypedIdentifyQuestion = {
    structureId: 'fixture-structure',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    area: 'ankle-foot',
    category: 'bone',
    difficulty: 'medium',
    promptKind: 'identify',
    type: 'identify-typed',
    id: 'identify-typed-fixture',
    prompt: 'Which structure is highlighted?',
    promptImageId: fixtureFrames[0].id,
    acceptedAnswers: ['Fixture structure'],
    explanation: 'x',
  };

  function drawnPoints(): string {
    return Array.from(document.querySelectorAll('svg polygon'))
      .map((p) => p.getAttribute('points') ?? '')
      .join('|');
  }

  it('draws the outline of the frame that is showing, not the opening one', () => {
    render(<IdentifyTypedSession question={question} imagesById={imagesById} onAnswer={vi.fn()} onNext={vi.fn()} examMode />);
    const before = drawnPoints();
    expect(before).not.toBe('');
    fireEvent.click(screen.getByLabelText('Rotate right'));
    const after = drawnPoints();
    expect(after).not.toBe('');
    expect(after).not.toBe(before);
  });

  it('only offers angles where the target is traced', () => {
    const frames = rotationFramesFor(imagesById.get(question.promptImageId), fixtureFrames);
    const offered = promptHighlightFrames(frames, question.structureId);
    expect(offered.length).toBeGreaterThan(1);
    for (const f of offered) expect((f.hotspots ?? []).some((h) => h.structureId === question.structureId)).toBe(true);
    // A pre-highlighted set carries no hotspots at all, and is left alone.
    const bare = frames.map((f) => ({ ...f, hotspots: [] }));
    expect(promptHighlightFrames(bare, question.structureId)).toBe(bare);
  });
});
