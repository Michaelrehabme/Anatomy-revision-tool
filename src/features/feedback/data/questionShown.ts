import type { RevisionQuestion } from '../../anatomy-revision/types/question';
import type { QuestionShown } from './rows';

/**
 * The question as the student saw it, for the report and the owner's email
 * (owner, 25 Oct 2026). Built from the question itself, so it says what was
 * asked rather than what the question is filed under.
 *
 * `given` is the student's answer if they had answered before reporting;
 * `picture` is resolved by the caller, which holds the images.
 */
export function questionShown(
  question: RevisionQuestion,
  context: { subject?: string; given?: string; picture?: (imageId: string) => string | undefined } = {},
): QuestionShown {
  const pic = (id?: string) => (id && context.picture ? (context.picture(id) ?? '') : '');
  const base = { subject: context.subject ?? '', given: context.given ?? '', lines: '', choices: '', correct: '', picture: '' };
  switch (question.type) {
    case 'mcq':
      return {
        ...base,
        prompt: question.prompt,
        lines: (question.promptLines ?? []).join('\n'),
        choices: question.choices.join('\n'),
        correct: question.choices[question.correctIndex] ?? '',
        picture: pic(question.promptImageId),
      };
    case 'identify-typed':
      return {
        ...base,
        prompt: question.prompt,
        lines: (question.promptLines ?? []).join('\n'),
        correct: question.acceptedAnswers[0] ?? '',
        picture: pic(question.promptImageId),
      };
    case 'multi-select':
      return {
        ...base,
        prompt: question.prompt,
        choices: question.choices.join('\n'),
        correct: question.correctIndices.map((i) => question.choices[i]).join('; '),
      };
    case 'locate':
      return { ...base, prompt: question.prompt, correct: context.subject ?? '', picture: pic(question.imageId) };
    case 'fill-blank':
      return {
        ...base,
        prompt: [question.subject, `${question.before} ____ ${question.after}`.trim()].filter(Boolean).join(': '),
        correct: (question.answers ?? [question.answer]).join('; '),
      };
    case 'flashcard':
      return { ...base, prompt: question.front.text ?? '', correct: question.back.text, picture: pic(question.front.imageId ?? question.back.imageId) };
    case 'oina':
      return question.format === 'select'
        ? {
            ...base,
            prompt: question.prompt,
            choices: question.choices.join('\n'),
            correct: question.correctIndices.map((i) => question.choices[i]).join('; '),
          }
        : { ...base, prompt: question.prompt, correct: question.slots.map((s) => `${s.label}: ${s.accepted[0] ?? ''}`).join('\n') };
  }
}

/** The context a session screen hands the report control, from what it holds. */
export function reportContextFor(
  question: RevisionQuestion | undefined,
  answers: readonly { questionId: string; selectedAnswer?: string }[],
  content: {
    structuresById: ReadonlyMap<string, { name: string }>;
    imagesById: ReadonlyMap<string, { filePath: string }>;
  },
): { subject?: string; given?: string; picture: (imageId: string) => string | undefined } {
  const id = question?.type === 'locate' ? question.targetStructureId : question?.structureId;
  const answered = question ? [...answers].reverse().find((a) => a.questionId === question.id) : undefined;
  return {
    subject: id ? content.structuresById.get(id)?.name : undefined,
    given: answered?.selectedAnswer,
    picture: (imageId) => content.imagesById.get(imageId)?.filePath,
  };
}
