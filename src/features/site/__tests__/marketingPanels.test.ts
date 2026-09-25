import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MUSCLE_PLATES } from '../../anatomy-revision/data/seed/musclePlates.generated';
import { PANELS, panelSrc } from '../components/MarketingHome';

// The test environment is jsdom, where import.meta.url is not a file URL;
// vitest runs from the repository root.
const PUBLIC = join(process.cwd(), 'public');

describe('the landing page sample question', () => {
  // The four cards name their angles by hand, so the landing page does not
  // have to load the plate list. A re-render can change which angle a muscle
  // shows best at, or stop publishing one, and nothing else would notice.
  it.each(PANELS)('shows $name on a plate that exists', (panel) => {
    expect(existsSync(`${PUBLIC}${panelSrc(panel)}`)).toBe(true);
  });

  it.each(PANELS)('shows $name at the angle its own card opens on', (panel) => {
    const primary = MUSCLE_PLATES.find((p) => p.structureId === panel.id && p.primary);
    expect(primary?.angle).toBe(panel.angle);
  });
});
