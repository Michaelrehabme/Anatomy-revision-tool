import type { AnatomyStructure } from '../../types/structure';
import { AREAS, type Area } from '../../types/region';
import type { DistractorSources } from '../../lib/questionGenerators/sources';
import { BUNDLED_CONTENT } from './bundledContent';

/**
 * The facts in hand RIGHT NOW, for code that is not inside the React tree
 * that loaded them.
 *
 * hooks/useAnatomyContent.ts is where facts live, and it hands them down as
 * props. One caller cannot be reached that way: the educator's assignment
 * preview (educator/lib/assignmentScope.ts) is a plain function, called from
 * a lazily loaded part of the app and from tests, and it needs to know which
 * areas it could build questions for at this moment. The hook publishes here
 * each time what it holds changes; the preview reads.
 *
 * It starts as whatever the bundle carries, so in a bundled build — and in a
 * test that never mounts the hook — it is every structure, and the preview is
 * exact, as it always was.
 *
 * A snapshot, not a subscription: a reader gets what is loaded when it asks.
 * The preview recomputes on every change to the form, which is often enough
 * for a number shown beside it.
 */
export interface LoadedContent {
  /** The structures whose facts are in hand. */
  structures: AnatomyStructure[];
  /** The areas those cover completely. */
  areas: readonly Area[];
  /** See AnatomyContent.sources. */
  sources: DistractorSources | undefined;
}

let current: LoadedContent = {
  structures: [...BUNDLED_CONTENT.structures],
  areas: BUNDLED_CONTENT.areas,
  sources:
    BUNDLED_CONTENT.kind === 'bundled' ? undefined : { index: BUNDLED_CONTENT.index, vocabulary: BUNDLED_CONTENT.vocabulary },
};

export function loadedContent(): LoadedContent {
  return current;
}

/** Called by useAnatomyContent whenever the facts it holds change. */
export function publishLoadedContent(next: LoadedContent): void {
  current = next;
}

/** Whether every one of these areas has its facts in hand. */
export function allLoaded(areas: readonly Area[]): boolean {
  return areas.every((area) => current.areas.includes(area));
}

/** For tests that publish: put back what the bundle carries. */
export function resetLoadedContent(): void {
  current = {
    structures: [...BUNDLED_CONTENT.structures],
    areas: BUNDLED_CONTENT.kind === 'bundled' ? AREAS : BUNDLED_CONTENT.areas,
    sources:
      BUNDLED_CONTENT.kind === 'bundled' ? undefined : { index: BUNDLED_CONTENT.index, vocabulary: BUNDLED_CONTENT.vocabulary },
  };
}
