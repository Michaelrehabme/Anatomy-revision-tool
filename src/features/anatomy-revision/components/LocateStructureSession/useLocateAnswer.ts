import { useEffect, useState } from 'react';
import type { LocateQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import type { Confidence } from '../../types/attempt';
import type { AnswerRoute } from '../../lib/answerRoute';
import type { HotspotAnswerResult } from './HotspotImage';
import { describedFeedback, locateFeedback } from './locateFeedback';
import { useLocateRoutes } from '../../hooks/useLocateRoutes';
import { getLocateWithoutPicture } from '../../lib/preferences';
import { STRUCTURE_INDEX_BY_ID } from '../../data/structureIndex';

export interface LocateAnswerParams {
  structureId: string;
  correct: boolean;
  hitDistance?: number;
  accuracy?: number;
  confidence?: Confidence;
  /** Answered in words: the description chosen and the right one. */
  selectedAnswer?: string;
  correctAnswer?: string;
  /** Present when the question was answered in words rather than located (lib/answerRoute.ts). */
  route?: AnswerRoute;
}

/**
 * Everything about answering a locate question that is the same on the desktop
 * screen and the phone's: the three ways in — the picture (by pointer or by
 * the keyboard's crosshair), the question in words, the list of names — and
 * what each one reports.
 *
 * It lived twice, once in each screen, and a third route would have made it
 * three sets of handlers to keep in step. The screens keep what really
 * differs between them: the layout and where the verdict is shown.
 *
 * WHICH ROUTE IS OPEN. The picture, unless the student has asked on the
 * Account screen for locate questions without it (lib/preferences.ts). A
 * button swaps the two on any question, until it is answered: after that the
 * other route would be a second go at a question already marked.
 *
 * WHAT IS RECORDED. A tap, by pointer or key, and a name from the list are
 * the locate question, as they always were. A description is recorded as its
 * own kind of answer and never as a locate success (lib/answerRoute.ts).
 */
export function useLocateAnswer({
  question,
  imagesById,
  structuresById,
  onAnswer,
  examMode,
}: {
  question: LocateQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  structuresById: Map<string, AnatomyStructure>;
  onAnswer: (params: LocateAnswerParams) => void;
  examMode?: boolean;
}) {
  const [result, setResult] = useState<HotspotAnswerResult | null>(null);
  /** The description chosen, when the question was answered in words. */
  const [chosenDescription, setChosenDescription] = useState<number | null>(null);
  const [wordsMode, setWordsMode] = useState(getLocateWithoutPicture);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setResult(null);
    setChosenDescription(null);
    setWordsMode(getLocateWithoutPicture());
    setRated(false);
  }, [question.id]);

  const image = imagesById.get(question.imageId);
  // The other angles of a rotation set, if the question has them.
  const frames = (question.frameImageIds ?? [])
    .map((id) => imagesById.get(id))
    .filter((f): f is AnatomyImageAsset => !!f);
  const routes = useLocateRoutes(question, image ? [image, ...frames] : frames, structuresById);
  const described = routes?.described ?? null;

  const located = (r: HotspotAnswerResult): LocateAnswerParams => ({
    structureId: question.targetStructureId,
    correct: r.correct,
    hitDistance: r.hitDistance,
    accuracy: r.accuracy,
  });
  const inWords = (index: number): LocateAnswerParams => ({
    structureId: question.targetStructureId,
    correct: index === described?.correctIndex,
    selectedAnswer: described?.choices[index],
    correctAnswer: described?.choices[described.correctIndex],
    route: 'described-region',
  });

  const handleImageAnswer = (r: HotspotAnswerResult) => {
    setResult(r);
    if (examMode) onAnswer(located(r));
  };
  const handleListAnswer = (structureId: string) => {
    if (result) return;
    // The list names a structure rather than pointing at one, so there is no
    // tap and no frame of its own — the question's own image is the honest
    // answer for `imageId`, and [0, 0] the conventional no-point.
    const r: HotspotAnswerResult = {
      structureId,
      correct: structureId === question.targetStructureId,
      point: [0, 0],
      imageId: question.imageId,
    };
    setResult(r);
    if (examMode) onAnswer(located(r));
  };
  const handleDescribedAnswer = (index: number) => {
    if (result || !described) return;
    setChosenDescription(index);
    setResult({ structureId: null, correct: index === described.correctIndex, point: [0, 0], imageId: question.imageId });
    if (examMode) onAnswer(inWords(index));
  };
  const handleRate = (confidence: Confidence) => {
    if (!result) return;
    setRated(true);
    onAnswer({ ...(chosenDescription !== null ? inWords(chosenDescription) : located(result)), confidence });
  };

  // Names from the index: the structure tapped by mistake can be a neighbour
  // from an area whose facts are not on the device, and it still has a name.
  const nameOf = (id: string) => structuresById.get(id)?.name ?? STRUCTURE_INDEX_BY_ID.get(id)?.name;
  const targetName = nameOf(question.targetStructureId) ?? question.targetStructureId;
  const feedback: { title: string; detail?: string } = !result
    ? { title: '' }
    : chosenDescription !== null && routes?.describedAnswer
      ? describedFeedback(result.correct, targetName, routes.describedAnswer)
      : locateFeedback(result, targetName, result.structureId ? nameOf(result.structureId) : undefined);

  return {
    image,
    frames,
    routes,
    result,
    chosenDescription,
    rated,
    wordsMode,
    /** Swap between the picture and the words; refused once the question is answered. */
    toggleWords: () => {
      if (!result) setWordsMode((v) => !v);
    },
    handleImageAnswer,
    handleListAnswer,
    handleDescribedAnswer,
    handleRate,
    feedback,
    /**
     * The heading over the question. The words route asks its own; the list
     * says what to do with it ("Tap the acromion" over a list of names is an
     * instruction nobody can follow); and while the words are still arriving
     * there is nothing to say yet — not the picture's prompt, which would be
     * read out and then replaced.
     */
    prompt: !wordsMode ? question.prompt : !routes ? '' : described ? described.prompt : `Choose ${targetName} from the list.`,
  };
}
