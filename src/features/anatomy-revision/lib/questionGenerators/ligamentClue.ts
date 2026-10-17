import { isLigament, reviewedAttachmentIds } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import { siteLabel } from '../attachmentSites';
import { LIGAMENT_ATTACHMENT_DETAIL } from '../../data/ligamentAttachmentDetail';

/**
 * "WHAT LIGAMENT IS THIS?" AS BULLET POINTS (owner, 17 Oct 2026): one short
 * line per sourced attachment site instead of a sentence, as many lines as the
 * ligament really has attachments. Shared by the multiple-choice and the typed
 * question, so the two always agree on which ligaments are asked.
 *
 * Null when another ligament attaches to exactly the same sites:
 * the ATFL and PTFL both reach the lateral malleolus and the talus, and a
 * question with two right answers teaches nothing. Those wait until their
 * sites are named more precisely, sourced and reviewed first.
 */
export function ligamentPromptLines(
  structure: AnatomyStructure,
  sites: ReadonlyMap<string, StructureIndexEntry>,
): string[] | null {
  if (!isLigament(structure)) return null;
  // Decided once over every ligament: data/seed/index.ts withAttachmentRule.
  if (structure.eligibility.identifyByAttachments === false) return null;
  const ids = reviewedAttachmentIds(structure);
  if (!ids.length) return null;
  const detail = LIGAMENT_ATTACHMENT_DETAIL[structure.id] ?? {};
  return ids.map((id) => {
    const site = sites.get(id);
    const label = site ? siteLabel(site, sites) : id.replace(/-/g, ' ');
    // The part of the bone, where a source names it (data/ligamentAttachmentDetail.ts).
    return `Attaches to: ${label}${detail[id] ? ` — ${detail[id]}` : ''}`;
  });
}

/**
 * A ligament that attaches to every one of `structure`'s sites too, at the
 * same named part where a part is named: a second right answer. The PTFL is
 * not one for the ATFL any more: same bones, different parts of them, which
 * makes it the wrong answer most worth offering.
 */
export function alsoAttachesToAll(structure: AnatomyStructure, other: AnatomyStructure): boolean {
  if (!isLigament(structure) || !isLigament(other) || other.id === structure.id) return false;
  const theirs = reviewedAttachmentIds(other);
  const mine = LIGAMENT_ATTACHMENT_DETAIL[structure.id] ?? {};
  const their = LIGAMENT_ATTACHMENT_DETAIL[other.id] ?? {};
  return reviewedAttachmentIds(structure).every((id) => theirs.includes(id) && (!mine[id] || !their[id] || mine[id] === their[id]));
}
