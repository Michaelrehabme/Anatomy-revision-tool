import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES } from '../../data/seed';
import { atlasRow, firstSentence } from '../atlasFacts';
import { isJoint, isLigament, isMuscle } from '../../types/structure';

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

describe('atlasRow', () => {
  it('gives every structure of every kind at least two non-empty columns', () => {
    // The external intercostal membrane has no attachments authored and no
    // joint: docs/ligament-attachments-review.md questions whether it belongs
    // in the ligament set at all. Until that review lands it is the one row
    // the atlas shows with a role only. The intersesamoid and interspinous
    // ligaments (tranche 2) touch no mapped bone mesh, so nothing was derived;
    // their attachments are the review's to author, not this test's.
    const known = ['ligament:intersesamoid-ligament', 'ligament:interspinous-ligaments', 'ligament:external-intercostal-membrane'];
    const thin = ALL_STRUCTURES.filter((s) => atlasRow(s, byId).columns.filter((c) => c.text).length < 2);
    expect(thin.map((s) => `${s.category}:${s.id}`)).toEqual(known);
  });

  it('resolves ids to names for ligaments and joints', () => {
    const ligament = ALL_STRUCTURES.filter(isLigament).find((l) => l.attachmentStructureIds.length > 0)!;
    const row = atlasRow(ligament, byId);
    for (const id of ligament.attachmentStructureIds) {
      const named = byId.get(id);
      if (named) expect(row.columns[0].text).toContain(named.name);
    }
    expect(row.columns[0].text).not.toMatch(/-/);

    const joint = ALL_STRUCTURES.filter(isJoint).find((j) => j.articulatingStructureIds.length > 0)!;
    const jointRow = atlasRow(joint, byId);
    for (const id of joint.articulatingStructureIds) {
      const named = byId.get(id);
      if (named) expect(jointRow.columns[1].text).toContain(named.name);
    }
  });

  it('keeps the muscle columns the table always had', () => {
    const muscle = ALL_STRUCTURES.find(isMuscle)!;
    const row = atlasRow(muscle, byId);
    expect(row.columns.map((c) => c.label)).toEqual(['Origin', 'Insertion', 'Action']);
    expect(row.columns[0].text).toBe(muscle.origin.join('; '));
    expect(row.columns[2].text).toBe(muscle.actionText);
  });

  it('searches across name, aliases and every column', () => {
    const muscle = ALL_STRUCTURES.find(isMuscle)!;
    const row = atlasRow(muscle, byId);
    expect(row.searchText).toContain(muscle.name.toLowerCase());
    expect(row.searchText).toContain(muscle.actionText.toLowerCase().slice(0, 12));
  });
});

describe('firstSentence', () => {
  it('stops at the first full stop, question mark or exclamation', () => {
    expect(firstSentence('The femur is the thigh bone. It is the longest bone.')).toBe('The femur is the thigh bone.');
    expect(firstSentence('No punctuation at all')).toBe('No punctuation at all');
    expect(firstSentence('Attaches at L4-L5. Then more.')).toBe('Attaches at L4-L5.');
  });
});
