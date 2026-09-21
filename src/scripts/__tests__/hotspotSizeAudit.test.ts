import { describe, it, expect } from 'vitest';
import { auditHotspotSizes, familyOf, judgeHotspot } from '../lib/hotspotSizeAudit';
import type { AnatomyImageAsset, HotspotPolygon } from '../../features/anatomy-revision/types/image';

const square = (side: number): number[][][] => [[[0, 0], [side, 0], [side, side], [0, side]]];

function hotspot(overrides: Partial<HotspotPolygon> = {}): HotspotPolygon {
  return { structureId: 's', polygons: square(0.1), area: 0.01, centroid: [0.05, 0.05], ...overrides };
}

function image(id: string, hotspots: HotspotPolygon[]): AnatomyImageAsset {
  return { id, filePath: `/x/${id}.webp`, mode: 'atlas-slide', hotspots, width: 100, height: 100 } as AnatomyImageAsset;
}

describe('familyOf', () => {
  it('reads the family from the image id prefix', () => {
    expect(familyOf('landmark-acetabulum-anterior')).toBe('landmark');
    expect(familyOf('sub-knee-a000-plate')).toBe('sub');
    expect(familyOf('ligament-acl-a000-context')).toBe('ligament');
    expect(familyOf('something-else')).toBe('other');
  });
});

describe('judgeHotspot', () => {
  it('passes a whole bone that legitimately fills a tenth of its plate', () => {
    expect(judgeHotspot('bone-knee-anterior', hotspot({ area: 0.08 }))).toBeNull();
  });

  it('flags an outline over its family limit', () => {
    expect(judgeHotspot('ligament-x-a000-context', hotspot({ area: 0.07 }))?.reason).toMatch(/covers 7\.0%/);
    expect(judgeHotspot('sub-sacrum-a000-plate', hotspot({ area: 0.18 }))?.reason).toMatch(/limit 15%/);
  });

  it('flags a point target whose radius is over the cap, and allows the cap itself', () => {
    expect(judgeHotspot('landmark-a-anterior', hotspot({ targetRadius: 0.2, area: 0.12 }))?.reason).toMatch(/target radius 20\.0%/);
    expect(judgeHotspot('landmark-a-anterior', hotspot({ targetRadius: 0.12, area: 0.045 }))).toBeNull();
  });

  it('checks the anatomy share only on a large region', () => {
    // A thin ridge with a generous margin: small hitbox, small core share — the design working.
    const ridge = hotspot({ area: 0.03, polygons: square(0.17), targetCore: square(0.05) });
    expect(judgeHotspot('landmark-crest-anterior', ridge)).toBeNull();
    // The same proportions on a big hitbox: mostly margin.
    const bloated = hotspot({ area: 0.1, polygons: square(0.316), targetCore: square(0.1) });
    expect(judgeHotspot('landmark-pedicle-superior', bloated)?.reason).toMatch(/only 10% of its hitbox/);
  });
});

describe('auditHotspotSizes', () => {
  it('summarises each family and lists offenders largest first', () => {
    const audit = auditHotspotSizes([
      image('ligament-a-a000-context', [hotspot({ area: 0.07 }), hotspot({ area: 0.01 })]),
      image('ligament-b-a000-context', [hotspot({ area: 0.09 })]),
      image('joint-c-anterior', [hotspot({ area: 0.02 })]),
    ]);
    expect(audit.families.ligament?.count).toBe(3);
    expect(audit.families.ligament?.offenders).toBe(2);
    expect(audit.families.joint?.offenders).toBe(0);
    expect(audit.offenders.map((o) => o.area)).toEqual([0.09, 0.07]);
  });
});
