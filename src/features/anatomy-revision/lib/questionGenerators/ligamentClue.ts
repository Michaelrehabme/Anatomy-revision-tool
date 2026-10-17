import { isLigament, reviewedAttachmentIds } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import { siteLabel } from '../attachmentSites';

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
  return ids.map((id) => {
    const site = sites.get(id);
    return `Attaches to: ${site ? siteLabel(site, sites) : id.replace(/-/g, ' ')}`;
  });
}

/** A ligament that attaches to every one of `structure`'s sites too: a second right answer. */
export function alsoAttachesToAll(structure: AnatomyStructure, other: AnatomyStructure): boolean {
  if (!isLigament(structure) || !isLigament(other) || other.id === structure.id) return false;
  const theirs = reviewedAttachmentIds(other);
  return reviewedAttachmentIds(structure).every((id) => theirs.includes(id));
}
