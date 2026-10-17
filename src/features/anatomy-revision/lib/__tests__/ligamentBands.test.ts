import { describe, expect, it } from 'vitest';
import bands from '../../../../../ligament-bands.json';
import { ALL_STRUCTURES } from '../../data/seed';
import { CLINICAL_LIGAMENTS } from '../../data/clinicalLigaments';

/**
 * THE BANDS ARE DRAWN FROM THE SOURCES. ligament-bands.json draws the
 * clinically important ligaments the atlas models as a chip as a band between
 * their attachments (renderLigamentPlates.py), and a band is a claim: "this
 * ligament runs from here to there". Each ligament's attachmentStructureIds
 * are source-checked, with the quoted work in ligament-attachment-corrections
 * .json and on /sources, so each end must be one of them: the bone itself, or
 * a landmark on that bone. An end placed at a named landmark (`fromAt`/`toAt`)
 * must be that landmark or its bone.
 */

type Band = { from: string; to: string; fromAt?: string; toAt?: string };
const entries = Object.entries(bands.ligaments as Record<string, { structureId: string; bands: Band[] }>);
const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const landmarks = ALL_STRUCTURES.filter((s) => s.category === 'landmark') as unknown as { id: string; name: string; parentBoneId?: string }[];

/** The bone structure ids an atlas bone answers to. */
function boneIds(bone: string): string[] {
  const name = bone.replace(/\.l$/, '');
  if (/ metacarpal bone$/.test(name)) return ['metacarpals'];
  if (/ metatarsal bone$/.test(name)) return ['metatarsals'];
  const plain = name.replace(/ bone$/, '').toLowerCase().replace(/ /g, '-');
  return [plain];
}

function endIsSourced(bone: string, at: string | undefined, sourced: string[]): boolean {
  const bones = boneIds(bone);
  if (bones.some((id) => sourced.includes(id))) return true;
  const onBone = landmarks.filter((l) => l.parentBoneId && bones.includes(l.parentBoneId)).map((l) => l.id);
  if (at) {
    const named = landmarks.find((l) => l.name.toLowerCase() === at.toLowerCase());
    if (named) return sourced.includes(named.id);
  }
  return onBone.some((id) => sourced.includes(id));
}

describe('ligament bands', () => {
  it('draws only clinically important ligaments', () => {
    for (const [object, entry] of entries) {
      expect(byId.get(entry.structureId)?.category, object).toBe('ligament');
      expect(CLINICAL_LIGAMENTS.has(entry.structureId), object).toBe(true);
      expect(entry.bands.length, object).toBeGreaterThan(0);
    }
  });

  it('starts and ends each band at an attachment the ligament is sourced as having', () => {
    for (const [object, entry] of entries) {
      const sourced = (byId.get(entry.structureId) as { attachmentStructureIds?: string[] }).attachmentStructureIds ?? [];
      for (const band of entry.bands) {
        expect(endIsSourced(band.from, band.fromAt, sourced), `${object}: ${band.from} ${band.fromAt ?? ''} not among ${sourced.join(', ')}`).toBe(true);
        expect(endIsSourced(band.to, band.toAt, sourced), `${object}: ${band.to} ${band.toAt ?? ''} not among ${sourced.join(', ')}`).toBe(true);
      }
    }
  });
});
