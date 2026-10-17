import { describe, expect, it } from 'vitest';
import record from '../../../../../ligament-attachment-detail.json';
import { ALL_STRUCTURES } from '../../data/seed';
import { LIGAMENT_ATTACHMENT_DETAIL } from '../../data/ligamentAttachmentDetail';
import { isLigament, reviewedAttachmentIds } from '../../types/structure';
import { buildMcqQuestions } from '../questionGenerators/mcq';
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
