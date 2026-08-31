import type { HotspotPolygon } from '../../anatomy-revision/types/image';

const STORAGE_KEY = 'anatomy-revision:v1:hotspot-editor-drafts';

export type DraftsByImageId = Record<string, HotspotPolygon[]>;

/** Dev-tool convenience only — never read by the shipped app. Survives a page refresh mid-authoring session. */
export function loadDrafts(): DraftsByImageId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DraftsByImageId) : {};
  } catch {
    return {};
  }
}

export function saveDrafts(drafts: DraftsByImageId): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}
