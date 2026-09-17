import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HotspotImage } from '../LocateStructureSession/HotspotImage';
import type { AnatomyImageAsset } from '../../types/image';

/**
 * jsdom lays nothing out, so every rect is 0x0 and a click would normalise
 * to NaN. Give the stage and the picture a real box: 400x400 at the origin,
 * which is what the transform maths and the hit test are measured against.
 */
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    // The transformed picture box reports its transformed bounds, as a browser would.
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(el.style.transform ?? '');
    const z = m ? Number(m[3]) : 1;
    const tx = m ? Number(m[1]) : 0;
    const ty = m ? Number(m[2]) : 0;
    return { left: tx, top: ty, width: 400 * z, height: 400 * z, right: tx + 400 * z, bottom: ty + 400 * z, x: tx, y: ty, toJSON: () => ({}) } as DOMRect;
  };
  Element.prototype.setPointerCapture = () => {};
});

function frame(angle: number, targetArea: number): AnatomyImageAsset {
  const a = String(angle).padStart(3, '0');
  return {
    id: `ligament-t-a${a}-context`,
    filePath: `/x/${a}.webp`,
    slideTitle: `Test ${angle}`,
    mode: 'atlas-slide',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    view: angle === 0 ? 'anterior' : 'lateral',
    layer: 'ligament',
    credit: 'c',
    licence: 'l',
    width: 400,
    height: 400,
    hotspots: [
      // The target: a square in the top-left quarter, bigger at 270.
      { structureId: 'target', polygons: [[[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]]], area: targetArea, centroid: [0.25, 0.25] },
      // A neighbour in the bottom-right quarter, only on the anterior frame.
      ...(angle === 0
        ? [{ structureId: 'neighbour', polygons: [[[0.6, 0.6], [0.9, 0.6], [0.9, 0.9], [0.6, 0.9]]], area: 0.09, centroid: [0.75, 0.75] as [number, number] }]
        : []),
    ],
  };
}

const frames = [frame(0, 0.02), frame(270, 0.09)];

describe('HotspotImage with a rotation set', () => {
  it('opens on the frame it was given and turns to the others', () => {
    render(<HotspotImage image={frames[1]} frames={frames} targetStructureId="target" onAnswer={vi.fn()} />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toContain('/x/270.webp');
    // The degrees are part of the label: at 30 degrees a turntable has twelve
    // frames and two of them share every view name, so the angle is what tells
    // a student where they are.
    expect(screen.getByText(/Lateral · 270° · 2\/2/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Rotate right'));
    expect((screen.getByRole('img') as HTMLImageElement).src).toContain('/x/000.webp');
    expect(screen.getByText(/Anterior · 0° · 1\/2/)).toBeInTheDocument();
  });

  it('grades the click against the frame that is showing, and says which one', () => {
    const onAnswer = vi.fn();
    render(<HotspotImage image={frames[1]} frames={frames} targetStructureId="target" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByLabelText('Rotate left'));
    // Now on the anterior frame, where the neighbour exists. Click it.
    fireEvent.click(screen.getByRole('button', { name: /Test 0/ }), { clientX: 300, clientY: 300 });
    expect(onAnswer).toHaveBeenCalledTimes(1);
    const result = onAnswer.mock.calls[0][0];
    expect(result.correct).toBe(false);
    expect(result.structureId).toBe('neighbour');
    expect(result.imageId).toBe('ligament-t-a000-context');
  });

  it('maps a click through zoom and pan', () => {
    const onAnswer = vi.fn();
    render(<HotspotImage image={frames[0]} frames={frames} targetStructureId="target" onAnswer={onAnswer} />);
    const stage = screen.getByRole('button', { name: /Test 0/ });
    // Two button zooms, each about the stage centre (200,200): the picture
    // ends up 2.25x, its box running from -250px to 650px. Screen pixel 380
    // is 0.95 of the picture at 1x — empty bone — but (380 + 250) / 900 =
    // 0.70 once zoomed, which is inside the neighbour's square (0.6-0.9).
    fireEvent.click(screen.getByLabelText('Zoom in'));
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText('2.3×')).toBeInTheDocument();
    fireEvent.click(stage, { clientX: 380, clientY: 380 });
    const result = onAnswer.mock.calls[0][0];
    expect(result.point[0]).toBeCloseTo(630 / 900, 2);
    expect(result.structureId).toBe('neighbour');
    expect(result.correct).toBe(false);
  });

  it('locks rotation once answered', () => {
    render(<HotspotImage image={frames[0]} frames={frames} targetStructureId="target" onAnswer={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Test 0/ }), { clientX: 100, clientY: 100 });
    expect(screen.getByLabelText('Rotate right')).toBeDisabled();
  });
});
