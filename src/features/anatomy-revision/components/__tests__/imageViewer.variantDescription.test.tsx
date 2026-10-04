import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImageViewer } from '../shared/ImageViewer';
import { PlateCatalogueProvider } from '../shared/PlateDescription';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { attachHotspots } from '../../data/seed/hotspots';
import { rotationFramesFor } from '../../lib/rotationFrames';

/**
 * The switch between a frame's two renders and the picture's accessible name
 * and long description were written on separate branches, in the same
 * component. This is the two of them together, on real seed pictures: the
 * switch works from the keyboard and changes the file, and the name and the
 * description are the same whichever render is showing — and say nothing that
 * answers an open question.
 */

const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
const structuresById = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const catalogue = { imagesById, structuresById };

beforeAll(async () => {
  Element.prototype.setPointerCapture = () => {};
  await attachHotspots();
});
beforeEach(() => localStorage.clear());

const KNEE = 'ligament-anterior-meniscotibial-ligament-lateral-meniscus-a000u045-highlight';
const KNEE_SUBJECT = 'anterior-meniscotibial-ligament-lateral-meniscus';
const WRIST = 'ligament-scapholunate-interosseous-ligament-a000-highlight';
const WRIST_SUBJECT = 'scapholunate-interosseous-ligament';

function show(imageId: string, subjectId: string, conceal?: 'name' | 'place') {
  const image = imagesById.get(imageId)!;
  return render(
    <PlateCatalogueProvider value={catalogue}>
      <ImageViewer image={image} frames={rotationFramesFor(image, ALL_IMAGES)} subjectId={subjectId} conceal={conceal} />
    </PlateCatalogueProvider>,
  );
}

const stage = () => screen.getByRole('group', { name: /./ });
const picture = () => screen.getByRole('img') as HTMLImageElement;
/** The text aria-describedby points at, once the generator's chunk has arrived. */
async function description(): Promise<string> {
  const id = stage().getAttribute('aria-describedby')!;
  await waitFor(() => expect(document.getElementById(id)?.textContent ?? '').not.toBe(''));
  return document.getElementById(id)!.textContent!;
}

describe('the variant switch and the accessible picture, together', () => {
  it('knee, identify: keyboard switches femur ghosted → hidden; the name and description do not change and do not answer', async () => {
    show(KNEE, KNEE_SUBJECT, 'name');
    const image = imagesById.get(KNEE)!;
    const answer = structuresById.get(KNEE_SUBJECT)!.name;

    const before = { name: stage().getAttribute('aria-label'), alt: picture().alt, text: await description() };
    expect(picture().getAttribute('src')).toBe(image.filePath);
    expect(before.name).toBe('Anatomy image — anterior view, from 45° above');
    expect(before.alt).toBe(before.name);
    expect(before.text).toContain('with the femur ghosted and with it hidden');
    for (const said of [before.name!, before.alt, before.text]) {
      expect(said).not.toContain(answer);
      expect(said.toLowerCase()).not.toContain('meniscotibial');
    }

    // The group is named, holds one tab stop, and the arrow keys move the choice.
    const group = screen.getByRole('radiogroup', { name: 'Femur' });
    const [ghosted, hidden] = [screen.getByRole('radio', { name: 'ghosted' }), screen.getByRole('radio', { name: 'hidden' })];
    expect(ghosted).toHaveAttribute('tabindex', '0');
    expect(hidden).toHaveAttribute('tabindex', '-1');
    ghosted.focus();
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(hidden).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(hidden);
    expect(picture().getAttribute('src')).toBe(image.variant!.filePath);

    expect(stage().getAttribute('aria-label')).toBe(before.name);
    expect(picture().alt).toBe(before.alt);
    expect(await description()).toBe(before.text);

    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(ghosted).toHaveAttribute('aria-checked', 'true');
    expect(picture().getAttribute('src')).toBe(image.filePath);
  });

  it('wrist, identify: bones see-through → solid by keyboard; the description stays on the frame, not the render', async () => {
    show(WRIST, WRIST_SUBJECT, 'name');
    const image = imagesById.get(WRIST)!;
    const before = await description();
    expect(before).toContain('with the bones see-through and with them solid');
    expect(before).not.toContain(structuresById.get(WRIST_SUBJECT)!.name);
    expect(before.toLowerCase()).not.toMatch(/scaphoid|lunate/);

    const group = screen.getByRole('radiogroup', { name: 'Bones' });
    screen.getByRole('radio', { name: 'see-through' }).focus();
    fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(screen.getByRole('radio', { name: 'solid' })).toHaveAttribute('aria-checked', 'true');
    expect(picture().getAttribute('src')).toBe(image.variant!.filePath);
    expect(await description()).toBe(before);
  });

  it('once answered, the description names the ligament, and is still the same for both renders', async () => {
    show(KNEE, KNEE_SUBJECT);
    const answered = await description();
    expect(answered).toContain(`${structuresById.get(KNEE_SUBJECT)!.name} is the structure in cyan.`);
    expect(stage().getAttribute('aria-label')).toBe(imagesById.get(KNEE)!.slideTitle);
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'hidden' }));
    });
    expect(await description()).toBe(answered);
  });

  it('the description follows the frame as the picture turns, with the choice of render kept', async () => {
    show(KNEE, KNEE_SUBJECT, 'name');
    await description();
    fireEvent.click(screen.getByRole('radio', { name: 'hidden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
    expect(picture().getAttribute('src')).toMatch(/\.hidden\.webp$/);
    expect(await description()).toMatch(/the camera \d+° round from the front and 45° above the horizontal/);
    expect(stage().getAttribute('aria-label')).toMatch(/^Anatomy image — \w+ view, \d+°, from 45° above$/);
  });

  it('carpal gap plate, locate open: the description points at no gap', async () => {
    const image = imagesById.get('gap-carpal-gaps-a000-plate')!;
    render(
      <PlateCatalogueProvider value={catalogue}>
        <ImageViewer image={image} frames={rotationFramesFor(image, ALL_IMAGES)} subjectId={WRIST_SUBJECT} conceal="place" onPick={() => {}} />
      </PlateCatalogueProvider>,
    );
    const said = await description();
    expect(said).toContain('gaps between the bones can be chosen in this view');
    expect(said.toLowerCase()).not.toMatch(/scaphoid|lunate|scapholunate|interosseous/);
    // No second render on this plate, so no switch.
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
