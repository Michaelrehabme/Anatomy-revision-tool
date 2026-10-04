import { useEffect, useState } from 'react';
import type { AnatomyStructure } from '../types/structure';
import type { AnatomyImageAsset } from '../types/image';
import type { LocateQuestion } from '../types/question';
import type { LocateRoutes } from '../lib/locateRoutes';
import { STRUCTURE_INDEX } from '../data/structureIndex';

/**
 * The ways to answer this locate question without its picture — the question
 * in words where the seed supports one, and the list of names — or null until
 * the generators have arrived.
 *
 * They are fetched with import() the first time a locate question is shown,
 * not when the student asks for them: by the time anyone presses "Answer
 * without the picture" the module has been there for seconds, and a student
 * who has made that route their default (lib/preferences.ts) is waiting on
 * one small chunk the service worker already holds.
 *
 * Names come from the index and descriptions from the session's own
 * structures, which today are the same list and, once facts are served per
 * area, will not be (docs/CONTENT-SERVER-STATUS.md).
 */
export function useLocateRoutes(
  question: LocateQuestion,
  /** The opening picture and every angle the student may turn to. */
  frames: readonly AnatomyImageAsset[],
  structuresById: ReadonlyMap<string, AnatomyStructure>,
): LocateRoutes | null {
  const [built, setBuilt] = useState<{ questionId: string; routes: LocateRoutes } | null>(null);
  // The frames are looked up afresh on every render; their ids say whether they changed.
  const frameKey = frames.map((f) => f.id).join('|');

  useEffect(() => {
    let live = true;
    void import('../lib/locateRoutes').then((m) => {
      if (live) setBuilt({ questionId: question.id, routes: m.buildLocateRoutes(question, frames, structuresById, STRUCTURE_INDEX) });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, frameKey, structuresById]);

  // Never the last question's routes for this one.
  return built?.questionId === question.id ? built.routes : null;
}
