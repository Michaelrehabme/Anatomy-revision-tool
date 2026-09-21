import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageViewer } from '../shared/ImageViewer';
import { rotationAngle, rotationFramesFor, rotationSetKey, rotationTilt } from '../../lib/rotationFrames';
import type { AnatomyImageAsset } from '../../types/image';

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  Element.prototype.setPointerCapture = () => {};
});

/** A frame of a foot ligament's set: `a000`, or tilted like `a180u045`. */
function frame(marker: string, view: AnatomyImageAsset['view']): AnatomyImageAsset {
  return {
    id: `ligament-t-${marker}-context`,
    filePath: `/x/${marker}.webp`,
    slideTitle: `Test ${marker}`,
    mode: 'atlas-slide',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    view,
    layer: 'ligament',
    credit: 'c',
    licence: 'l',
    width: 400,
    height: 400,
    hotspots: [],
  } as AnatomyImageAsset;
}

const ring = [frame('a000', 'anterior'), frame('a090', 'medial'), frame('a270', 'lateral')];
const tilts = [frame('a000d090', 'plantar'), frame('a000d045', 'plantar'), frame('a180u045', 'dorsal'), frame('a180u090', 'dorsal')];
const all = [...tilts, ...ring];

const src = () => (screen.getByRole('img') as HTMLImageElement).getAttribute('src');

describe('the tilt naming', () => {
  it('puts tilted frames in the same set and reads their tilt', () => {
    expect(rotationSetKey('ligament-t-a180u045-context')).toBe(rotationSetKey('ligament-t-a090-context'));
    expect(rotationTilt('ligament-t-a180u045-context')).toBe(45);
    expect(rotationTilt('ligament-t-a000d090-context')).toBe(-90);
    expect(rotationTilt('ligament-t-a090-context')).toBe(0);
    expect(rotationAngle('ligament-t-a180u045-context')).toBe(180);
  });

  it('lists the ring in angle order, then the tilts from lowest to highest', () => {
    const frames = rotationFramesFor(ring[1], all);
    expect(frames.map((f) => f.filePath)).toEqual([
      '/x/a000.webp', '/x/a090.webp', '/x/a270.webp',
      '/x/a000d090.webp', '/x/a000d045.webp', '/x/a180u045.webp', '/x/a180u090.webp',
    ]);
  });
});

describe('ImageViewer with tilted frames', () => {
  const frames = rotationFramesFor(ring[1], all);

  it('climbs the tilt ladder and comes back to the ring frame it left', () => {
    render(<ImageViewer image={ring[1]} frames={frames} />);
    expect(src()).toBe('/x/a090.webp');
    fireEvent.click(screen.getByLabelText('Tilt up'));
    expect(src()).toBe('/x/a180u045.webp');
    expect(screen.getByText(/Dorsal · tilted up 45°/)).toBeInTheDocument();
    // Turning is for the ring; tilted, the picture only climbs or comes back.
    expect(screen.getByLabelText('Rotate right')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Tilt up'));
    expect(src()).toBe('/x/a180u090.webp');
    expect(screen.getByLabelText('Tilt up')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Tilt down'));
    fireEvent.click(screen.getByLabelText('Tilt down'));
    expect(src()).toBe('/x/a090.webp');
    fireEvent.click(screen.getByLabelText('Tilt down'));
    fireEvent.click(screen.getByLabelText('Tilt down'));
    expect(src()).toBe('/x/a000d090.webp');
    expect(screen.getByLabelText('Tilt down')).toBeDisabled();
  });

  it('turns only through the ring, never into a tilted frame', () => {
    render(<ImageViewer image={ring[0]} frames={frames} />);
    fireEvent.click(screen.getByLabelText('Rotate right'));
    fireEvent.click(screen.getByLabelText('Rotate right'));
    expect(src()).toBe('/x/a270.webp');
    fireEvent.click(screen.getByLabelText('Rotate right'));
    expect(src()).toBe('/x/a000.webp');
    expect(screen.getByText(/Anterior · 0° · 1\/3/)).toBeInTheDocument();
  });

  it('can open on a tilted frame', () => {
    render(<ImageViewer image={tilts[0]} frames={frames} />);
    expect(src()).toBe('/x/a000d090.webp');
    fireEvent.click(screen.getByLabelText('Tilt up'));
    expect(src()).toBe('/x/a000d045.webp');
  });

  it('shows no tilt controls for a set without tilted frames', () => {
    render(<ImageViewer image={ring[0]} frames={ring} />);
    expect(screen.queryByLabelText('Tilt up')).toBeNull();
  });
});
