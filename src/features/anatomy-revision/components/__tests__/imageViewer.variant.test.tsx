import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageViewer } from '../shared/ImageViewer';
import type { AnatomyImageAsset, ImageVariantKind } from '../../types/image';

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  Element.prototype.setPointerCapture = () => {};
  localStorage.clear();
});

/** A knee frame from above; `variant` gives it a second render with the femur gone. */
function frame(marker: string, variant?: ImageVariantKind, subject = 'Femur'): AnatomyImageAsset {
  return {
    id: `ligament-k-${marker}-context`,
    filePath: `/x/${marker}.webp`,
    slideTitle: `Test ${marker}`,
    mode: 'atlas-slide',
    region: 'hip-thigh',
    subregion: 'knee',
    view: 'anterior',
    layer: 'ligament',
    credit: 'c',
    licence: 'l',
    width: 400,
    height: 400,
    hotspots: [],
    ...(variant ? { variant: { kind: variant, subject, filePath: `/x/${marker}.${variant}.webp` } } : {}),
  } as AnatomyImageAsset;
}

const src = () => (screen.getByRole('img') as HTMLImageElement).getAttribute('src');
const option = (name: string) => screen.getByRole('radio', { name });

describe('ImageViewer with a second render', () => {
  const frames = [frame('a000u045', 'hidden'), frame('a090u045', 'hidden'), frame('a180u045'), frame('a000u089', 'hidden')];

  it('opens on the ghosted render and names the switch for what changes', () => {
    render(<ImageViewer image={frames[0]} frames={frames} />);
    expect(src()).toBe('/x/a000u045.webp');
    expect(screen.getByRole('radiogroup', { name: 'Femur' })).toBeInTheDocument();
    expect(option('ghosted')).toHaveAttribute('aria-checked', 'true');
    expect(option('hidden')).toHaveAttribute('aria-checked', 'false');
  });

  it('swaps the file and nothing else, and swaps back', () => {
    render(<ImageViewer image={frames[0]} frames={frames} />);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    const zoom = screen.getByText(/×$/).textContent;
    fireEvent.click(option('hidden'));
    expect(src()).toBe('/x/a000u045.hidden.webp');
    expect(option('hidden')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/×$/).textContent).toBe(zoom);
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
    fireEvent.click(option('ghosted'));
    expect(src()).toBe('/x/a000u045.webp');
  });

  it('keeps the choice as the picture turns and tilts', () => {
    render(<ImageViewer image={frames[0]} frames={frames} />);
    fireEvent.click(option('hidden'));
    fireEvent.click(screen.getByLabelText('Rotate right'));
    expect(src()).toBe('/x/a090u045.hidden.webp');
    fireEvent.click(screen.getByLabelText('Tilt up'));
    expect(src()).toBe('/x/a000u089.hidden.webp');
  });

  it('greys the switch on a frame that was rendered one way only, and comes back after it', () => {
    render(<ImageViewer image={frames[1]} frames={frames} />);
    fireEvent.click(option('hidden'));
    fireEvent.click(screen.getByLabelText('Rotate right'));
    expect(src()).toBe('/x/a180u045.webp');
    expect(option('hidden')).toBeDisabled();
    expect(option('ghosted')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByLabelText('Rotate right'));
    expect(src()).toBe('/x/a000u045.hidden.webp');
    expect(option('hidden')).not.toBeDisabled();
  });

  it('hands the tap and the overlay the DEFAULT frame, whichever render is showing', () => {
    const onPick = vi.fn();
    const overlay = vi.fn(() => null);
    render(<ImageViewer image={frames[0]} frames={frames} onPick={onPick} overlay={overlay} />);
    fireEvent.click(option('hidden'));
    expect(src()).toBe('/x/a000u045.hidden.webp');
    fireEvent.click(screen.getByRole('img'), { clientX: 100, clientY: 200 });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][1]).toBe(frames[0]);
    expect(onPick.mock.calls[0][0][0]).toBeCloseTo(0.25);
    expect(overlay).toHaveBeenLastCalledWith(frames[0]);
  });

  it('does not treat a press on the switch as a tap on the picture', () => {
    const onPick = vi.fn();
    render(<ImageViewer image={frames[0]} frames={frames} onPick={onPick} />);
    fireEvent.click(option('hidden'));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('remembers the choice for the next picture of the same kind, and not for another kind', () => {
    const first = render(<ImageViewer image={frames[0]} frames={frames} />);
    fireEvent.click(option('hidden'));
    first.unmount();

    const again = render(<ImageViewer image={frames[3]} frames={frames} />);
    expect(src()).toBe('/x/a000u089.hidden.webp');
    again.unmount();

    const wrist = [frame('a000', 'solid', 'Bones'), frame('a090', 'solid', 'Bones')];
    render(<ImageViewer image={wrist[0]} frames={wrist} />);
    expect(src()).toBe('/x/a000.webp');
    expect(screen.getByRole('radiogroup', { name: 'Bones' })).toBeInTheDocument();
    expect(option('see-through')).toHaveAttribute('aria-checked', 'true');
    expect(option('solid')).toBeInTheDocument();
  });

  it('works from the keyboard: one tab stop, arrows change the choice', () => {
    render(<ImageViewer image={frames[0]} frames={frames} />);
    expect(option('ghosted')).toHaveAttribute('tabindex', '0');
    expect(option('hidden')).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(option('ghosted'), { key: 'ArrowRight' });
    expect(src()).toBe('/x/a000u045.hidden.webp');
    expect(option('hidden')).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(option('hidden'), { key: 'ArrowLeft' });
    expect(src()).toBe('/x/a000u045.webp');
  });

  it('survives storage that throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<ImageViewer image={frames[0]} frames={frames} />);
    expect(src()).toBe('/x/a000u045.webp');
    fireEvent.click(option('hidden'));
    expect(src()).toBe('/x/a000u045.hidden.webp');
    get.mockRestore();
    set.mockRestore();
  });

  it('shows no switch for a set with no second render', () => {
    const plain = [frame('a000'), frame('a090')];
    render(<ImageViewer image={plain[0]} frames={plain} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});

describe('ImageViewer with a ring of tilted frames and no level one', () => {
  const frames = [frame('a000u045'), frame('a090u045'), frame('a270u045'), frame('a000u089')];

  it('turns round the tilted ring and counts it', () => {
    render(<ImageViewer image={frames[0]} frames={frames} />);
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Rotate right'));
    expect(src()).toBe('/x/a090u045.webp');
    fireEvent.click(screen.getByLabelText('Rotate left'));
    fireEvent.click(screen.getByLabelText('Rotate left'));
    expect(src()).toBe('/x/a270u045.webp');
  });

  it('has no empty level rung to fall onto', () => {
    render(<ImageViewer image={frames[0]} frames={frames} />);
    expect(screen.getByLabelText('Tilt down')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Rotate right'));
    fireEvent.click(screen.getByLabelText('Tilt up'));
    expect(src()).toBe('/x/a000u089.webp');
    expect(screen.getByLabelText('Rotate right')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Tilt down'));
    // Back to the frame it tilted away from, not to the one it opened on.
    expect(src()).toBe('/x/a090u045.webp');
  });
});
