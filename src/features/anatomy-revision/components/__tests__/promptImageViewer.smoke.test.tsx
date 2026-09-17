import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdentifyTypedSession } from '../IdentifyTypedSession/IdentifyTypedSession';
import { buildIdentifyTypedQuestions } from '../../lib/questionGenerators/identifyTyped';
import { rotationFramesFor, rotationSetKey, rotationAngle } from '../../lib/rotationFrames';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import type { TypedIdentifyQuestion } from '../../types/question';

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
