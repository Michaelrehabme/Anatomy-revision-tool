import { describe, expect, it } from 'vitest';
import {
  acceptedOn,
  bloodCitations,
  bloodSupplyFaults,
  buildBloodSupply,
  resolvePublisher,
  zonesWithoutOwnQuote,
  type BloodSupplyRow,
} from '../provenance';
import { staleBloodSupply } from '../validateProvenance';

/**
 * The blood supply half of /sources. What these guard is the page naming a
 * work for a structure that nothing was quoted from, counting a row the app
 * does not ship, or going on stating last week's numbers.
 */

const ACCEPTED = { status: 'accepted', by: 'owner, 29 Sep 2026: every high- and medium-confidence row' };

const row = (over: Partial<BloodSupplyRow>): BloodSupplyRow => ({
  id: 'iliacus',
  category: 'muscle',
  arteries: ['Iliolumbar artery'],
  unsupported: [],
  sources: [{ title: 'Radiopaedia: Iliacus muscle', url: 'https://radiopaedia.org/articles/iliacus-muscle' }],
  quotes: [
    {
      title: 'Radiopaedia: Iliacus muscle',
      url: 'https://radiopaedia.org/articles/iliacus-muscle',
      quote: 'The iliacus muscle is mainly supplied by the iliolumbar artery.',
    },
  ],
  zone: null,
  review: ACCEPTED,
  ...over,
});

const totals = { muscle: 3, bone: 2, landmark: 5, joint: 1, ligament: 4 };

function build(rows: BloodSupplyRow[]) {
  const works: string[] = [];
  const intern = (raw: string) => {
    const title = resolvePublisher(raw).title;
    if (!works.includes(title)) works.push(title);
    return works.indexOf(title);
  };
  return { built: buildBloodSupply(rows, totals, intern), works };
}

describe('buildBloodSupply', () => {
  it('counts only accepted rows, and never a landmark', () => {
    const { built } = build([
      row({}),
      row({ id: 'psoas', review: undefined }),
      row({ id: 'femur', category: 'bone' }),
      row({ id: 'greater-trochanter', category: 'landmark' }),
    ]);
    expect(built.families.map((f) => [f.category, f.reviewed, f.total])).toEqual([
      ['muscle', 1, 3],
      ['bone', 1, 2],
      ['joint', 0, 1],
      ['ligament', 0, 4],
    ]);
    expect(built.landmarksExcluded).toBe(5);
  });

  it('names a work only where a sentence was quoted from it', () => {
    const unquoted = { title: "Gray's Anatomy (1918)", url: 'https://www.bartleby.com/107/161.html' };
    const r = row({
      sources: [...row({}).sources!, unquoted],
      quotes: [...row({}).quotes!, { ...unquoted, quote: null }],
    });
    expect(bloodCitations(r).map((c) => c.url)).toEqual(['https://radiopaedia.org/articles/iliacus-muscle']);
    const { built, works } = build([r]);
    expect(built.families[0].works.map((i) => works[i])).toEqual(['Radiopaedia']);
  });

  it('counts the zone source as a work, the withheld arteries, and the date of acceptance', () => {
    const { built, works } = build([
      row({
        unsupported: ['Middle collateral artery'],
        zone: {
          text: 'Avascular area in the deep tendon',
          quotes: [{ title: 'Patellar Tendon Rupture - StatPearls', url: 'https://www.ncbi.nlm.nih.gov/books/NBK513275/', quote: 'Relative hypovascularity.' }],
        },
      }),
    ]);
    expect(built.zones).toBe(1);
    expect(built.arteriesWithheld).toBe(1);
    expect(built.lastChecked).toBe('2026-09-29');
    expect(built.families[0].works.map((i) => works[i])).toEqual(['Radiopaedia', 'StatPearls (NCBI Bookshelf)']);
  });
});

describe('resolvePublisher, for the works the blood supply round used', () => {
  it('names StatPearls rather than filing it under journal articles', () => {
    expect(resolvePublisher('StatPearls: Anatomy, Thigh Muscles https://www.ncbi.nlm.nih.gov/books/NBK482445/').title).toBe(
      'StatPearls (NCBI Bookshelf)',
    );
    expect(resolvePublisher('Microvasculature of the human meniscus https://pubmed.ncbi.nlm.nih.gov/7198878/').title).toBe(
      'Peer-reviewed journal articles',
    );
  });
});

describe('acceptedOn', () => {
  it('reads the date out of the acceptance note, or admits there is none', () => {
    expect(acceptedOn(row({}))).toBe('2026-09-29');
    expect(acceptedOn(row({ review: { status: 'accepted', by: 'owner, 3 October 2026' } }))).toBe('2026-10-03');
    expect(acceptedOn(row({ review: { status: 'accepted', by: 'owner' } }))).toBeNull();
  });
});

describe('bloodSupplyFaults', () => {
  it('passes a sourced, quoted, dated row', () => {
    expect(bloodSupplyFaults([row({})])).toEqual([]);
  });

  it('fails an accepted row with no source', () => {
    expect(bloodSupplyFaults([row({ sources: [] })])[0]).toMatch(/"iliacus" is accepted but names no source/);
    expect(bloodSupplyFaults([row({ sources: [{ title: 'Some book' }] })])[0]).toMatch(/names no source/);
  });

  it('fails an accepted row whose sources were never quoted', () => {
    expect(bloodSupplyFaults([row({ quotes: [{ ...row({}).quotes![0], quote: null }] })])[0]).toMatch(/no source is quoted/);
  });

  it('fails a row resting only on works we will not cite', () => {
    const banned = { title: 'TeachMeAnatomy: The Iliacus', url: 'https://teachmeanatomy.info/iliacus' };
    const faults = bloodSupplyFaults([row({ sources: [banned], quotes: [{ ...banned, quote: 'Supplied by the iliolumbar artery.' }] })]);
    expect(faults[0]).toMatch(/rests only on excluded works \(TeachMeAnatomy\)/);
  });

  it('fails an undated acceptance', () => {
    expect(bloodSupplyFaults([row({ review: { status: 'accepted' } })])[0]).toMatch(/no readable date/);
  });

  it('reports, without failing, a zone that has no quote of its own', () => {
    const bare = row({ zone: { text: 'Critical zone', quotes: [] } });
    expect(bloodSupplyFaults([bare])).toEqual([]);
    expect(zonesWithoutOwnQuote([bare, row({ id: 'psoas' })])).toEqual(['iliacus']);
  });

  it('ignores rows the app does not ship', () => {
    expect(bloodSupplyFaults([row({ sources: [], review: undefined }), row({ sources: [], category: 'landmark' })])).toEqual([]);
  });
});

describe('staleBloodSupply', () => {
  const { built, works } = build([row({}), row({ id: 'femur', category: 'bone' })]);
  const shape = { works: works.map((title) => ({ title, citations: 1 })), bloodSupply: built };
  const generated = [
    'export const WORKS: ProvenanceWork[] = [',
    ...works.map((t) => `  { title: ${JSON.stringify(t)}, citations: 1 },`),
    '];',
    '',
    'export const BLOOD_SUPPLY: BloodSupplyProvenance = {',
    '  families: [',
    ...built.families.map(
      (f) => `    { category: "${f.category}", total: ${f.total}, reviewed: ${f.reviewed}, works: [${f.works.join(', ')}] },`,
    ),
    '  ],',
    `  landmarksExcluded: ${built.landmarksExcluded},`,
    `  arteriesWithheld: ${built.arteriesWithheld},`,
    `  zones: ${built.zones},`,
    `  lastChecked: "${built.lastChecked}",`,
    '};',
    '',
  ].join('\n');

  it('passes a file in step with the review', () => {
    expect(staleBloodSupply(generated, shape)).toEqual([]);
  });

  it('fails when the file has no blood supply block at all', () => {
    expect(staleBloodSupply('export const WORKS = [];\n', shape)[0]).toMatch(/no BLOOD_SUPPLY block/);
  });

  it('fails when a row was accepted after the file was written', () => {
    const later = build([row({}), row({ id: 'femur', category: 'bone' }), row({ id: 'tibia', category: 'bone' })]);
    const faults = staleBloodSupply(generated, { works: shape.works, bloodSupply: later.built });
    expect(faults).toHaveLength(1);
    expect(faults[0]).toMatch(/bone blood supply as total 2, reviewed 1.*says total 2, reviewed 2/);
  });

  it('fails when the works the indices point at have changed', () => {
    const faults = staleBloodSupply(generated, { ...shape, works: [{ title: 'Something else', citations: 1 }] });
    expect(faults.some((f) => /lists different works/.test(f))).toBe(true);
  });
});
