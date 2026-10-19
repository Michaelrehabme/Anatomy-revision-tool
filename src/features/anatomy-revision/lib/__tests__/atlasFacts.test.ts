import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES } from '../../data/seed';
import { atlasCardSections, atlasRow, firstSentence, muscleCardFacts } from '../atlasFacts';
import { isJoint, isLigament, isMuscle } from '../../types/structure';

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

describe('atlasRow', () => {
  it('gives every structure of every kind at least two non-empty columns', () => {
    // The external intercostal membrane has no attachments authored and no
    // joint: docs/ligament-attachments-review.md questions whether it belongs
    // in the ligament set at all. Until that review lands it is the one row
    // the atlas shows with a role only. Ligaments awaiting review say
    // "Being checked" instead of stating attachments nobody has verified.
    // (Since 19 Oct 2026 it has its two sites, costal cartilages and sternum,
    // from Gray's and Kenhub, so no row is thin any more.)
    const known: string[] = [];
    const thin = ALL_STRUCTURES.filter((s) => atlasRow(s, byId).columns.filter((c) => c.text).length < 2);
    expect(thin.map((s) => `${s.category}:${s.id}`)).toEqual(known);
  });

  it('resolves ids to names for ligaments and joints', () => {
    const ligament = ALL_STRUCTURES.filter(isLigament).find((l) => !l.needsReview && l.attachmentStructureIds.length > 0)!;
    const row = atlasRow(ligament, byId);
    for (const id of ligament.attachmentStructureIds) {
      const named = byId.get(id);
      if (named) expect(row.columns[0].text).toContain(named.name);
    }
    expect(row.columns[0].text).not.toMatch(/-/);

    // A part of a bone is named with its bone, as the questions name it
    // (attachmentSites.ts): the Atlas is where a student checks an answer.
    const ischiofemoral = atlasRow(ALL_STRUCTURES.find((s) => s.id === 'ischiofemoral-ligament')!, byId);
    expect(ischiofemoral.columns[0].text.split('; ').sort()).toEqual(['Greater Trochanter of the femur', 'Ischium']);
    expect(ischiofemoral.searchText).toContain('femur');

    const joint = ALL_STRUCTURES.filter(isJoint).find((j) => j.articulatingStructureIds.length > 0)!;
    const jointRow = atlasRow(joint, byId);
    for (const id of joint.articulatingStructureIds) {
      const named = byId.get(id);
      if (named) expect(jointRow.columns[1].text).toContain(named.name);
    }
  });

  it('does not state attachments nobody has checked', () => {
    // Built rather than found: every ligament in the data is checked as of
    // 28 Sep 2026, and the guard has to keep working for the next one added.
    const real = ALL_STRUCTURES.filter(isLigament).find((l) => l.attachmentStructureIds.length > 0)!;
    const unchecked = { ...real, needsReview: true };
    expect(atlasRow(unchecked, byId).columns[0].text).toBe('Being checked');
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

describe('atlasCardSections', () => {
  const sections = (id: string) => atlasCardSections(byId.get(id)!, byId);
  const section = (id: string, label: string) => sections(id).find((s) => s.label === label)?.items ?? [];

  it("states a ligament's attachments, with the part of the bone where it is sourced", () => {
    expect(section('anterior-talofibular-ligament', 'Attaches to')).toEqual([
      '**Talus** — in front of its lateral (fibular) facet',
      '**Lateral Malleolus of the fibula** — anterior margin of the lateral malleolus',
    ]);
  });

  it("prints a muscle's four facts in the card's own words, which the diagnostic papers mark", () => {
    const m = byId.get('deltoid')!;
    if (!isMuscle(m)) throw new Error('deltoid is a muscle');
    const card = muscleCardFacts(m);
    expect(section('deltoid', 'Origin(s)')).toEqual([`**${card.origin}**`]);
    expect(section('deltoid', 'Insertion(s)')).toEqual([`**${card.insertion}**`]);
    expect(section('deltoid', 'Nerve supply')).toEqual([`**${card.nerve}**`]);
    expect(section('deltoid', 'Action(s)')[0].replace(/\*\*/g, '')).toBe(card.action);
  });

  it('gives every structure facts beyond its name', () => {
    const empty = ALL_STRUCTURES.filter((s) => atlasCardSections(s, byId).length === 0);
    expect(empty.map((s) => s.id)).toEqual([]);
  });

  it("never prints the generator's placeholder as a ligament's description", () => {
    for (const s of ALL_STRUCTURES.filter(isLigament)) {
      for (const line of atlasCardSections(s, byId).find((x) => x.label === 'About')?.items ?? []) {
        expect(line, s.id).not.toMatch(/^Ligament of the [^,.]+\.$/);
      }
    }
  });
});
