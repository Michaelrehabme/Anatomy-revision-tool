import { describe, expect, it } from 'vitest';
import record from '../../../../../ligament-attachment-detail.json';
import { ALL_STRUCTURES } from '../../data/seed';
import { LIGAMENT_ATTACHMENT_DETAIL } from '../../data/ligamentAttachmentDetail';
import { isLigament, reviewedAttachmentIds } from '../../types/structure';
import { buildMcqQuestions } from '../questionGenerators/mcq';
import { ligamentPromptLines } from '../questionGenerators/ligamentClue';
import { buildIndexes } from '../indexes';
import { createRng } from '../rng';
import { ALL_IMAGES } from '../../data/seed';

/**
 * The specific attachment sites (owner, 17 Oct 2026: included when sourced
 * and uncontested). Every one is a part of a site the ligament is already
 * source-checked as attaching to, and every one has its source and quote.
 */
describe('specific attachment sites', () => {
  const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
  const included = (record as { included: Record<string, Record<string, { text: string; url: string; quote: string }>> }).included;

  it('names only sites the ligament is already sourced as attaching to', () => {
    for (const [lig, sites] of Object.entries(LIGAMENT_ATTACHMENT_DETAIL)) {
      const s = byId.get(lig);
      expect(s && isLigament(s), lig).toBe(true);
      if (!s || !isLigament(s)) continue;
      for (const site of Object.keys(sites)) expect(reviewedAttachmentIds(s), `${lig}: ${site}`).toContain(site);
    }
  });

  it('has a source URL and a quote behind every one, and matches the record word for word', () => {
    for (const [lig, sites] of Object.entries(LIGAMENT_ATTACHMENT_DETAIL)) {
      for (const [site, text] of Object.entries(sites)) {
        const row = included[lig]?.[site];
        expect(row?.text, `${lig}: ${site}`).toBe(text);
        expect(row?.url, `${lig}: ${site}`).toMatch(/^https:\/\//);
        expect(row?.quote?.length, `${lig}: ${site}`).toBeGreaterThan(5);
      }
    }
  });

  it('tells the ATFL from the PTFL, and offers each as the other\'s wrong answer', () => {
    const atfl = byId.get('anterior-talofibular-ligament')!;
    const ptfl = byId.get('posterior-talofibular-ligament')!;
    expect(atfl.eligibility.identifyByAttachments).toBe(true);
    expect(ptfl.eligibility.identifyByAttachments).toBe(true);
    const ligaments = ALL_STRUCTURES.filter(isLigament);
    const q = buildMcqQuestions([atfl], ALL_IMAGES, buildIndexes(ALL_STRUCTURES), createRng(2), { promptKinds: ['identify'], distractorPool: ligaments })[0];
    expect(q?.promptLines?.some((line) => line.includes(' — '))).toBe(true);
  });

  it('now asks most ligaments by name', () => {
    const asked = ALL_STRUCTURES.filter(isLigament).filter((l) => l.eligibility.identifyByAttachments);
    expect(asked.length).toBeGreaterThan(140);
  });
});

describe('clues with enough to go on (student reports, 1 Nov 2026)', () => {
  const sites = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
  const clue = (id: string) => ligamentPromptLines(sites.get(id)!, sites)?.join(' | ') ?? '';

  it('gives both ends of the superior transverse scapular ligament', () => {
    expect(clue('superior-transverse-scapular-ligament')).toContain('medial end of the scapular notch');
  });

  it('says which side of the carpus the dorsal intercarpal ligament is on', () => {
    expect(clue('dorsal-intercarpal-ligaments')).toContain('dorsal tubercle of the triquetrum');
    expect(clue('dorsal-intercarpal-ligaments')).toContain('dorsal groove of the scaphoid');
  });

  it('takes the dorsal scaphotriquetral ligament as the same ligament', () => {
    expect(sites.has('dorsal-scaphotriquetral-ligament')).toBe(false);
    expect(sites.get('dorsal-intercarpal-ligaments')!.aliases).toContain('Dorsal scaphotriquetral ligament');
  });

  it.each([
    ['anterior-cruciate-ligament', 'in front of the intercondylar eminence'],
    ['posterior-cruciate-ligament', 'posterior intercondylar area'],
    ['long-plantar-ligament', 'plantar aspect'],
    ['radiocapitate-ligament', 'palmar aspect'],
    ['superior-glenohumeral-ligament', 'superior aspect of the glenoid'],
    ['middle-glenohumeral-ligament', 'anterosuperior glenoid'],
  ])('says where %s is: %s', (id, part) => {
    expect(clue(id)).toContain(part);
  });

  it('leaves a paper published before them as it was', () => {
    const before = ligamentPromptLines(sites.get('superior-transverse-scapular-ligament')!, sites, '2026-10-17');
    expect(before).toEqual(['Attaches to: Coracoid Process of the scapula']);
  });
});
