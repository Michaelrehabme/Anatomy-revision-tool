import type { LocateRoutes } from '../../lib/locateRoutes';
import type { HotspotAnswerResult } from './HotspotImage';
import { moveFocusWithArrows } from '../shared/arrowFocus';
import { choiceRevealNote } from '../shared/choiceReveal';

const LETTERS = ['A', 'B', 'C', 'D'];

type OptionStyle = { border: string; background: string; color: string };
const PLAIN: OptionStyle = { border: '1.2px solid var(--line)', background: 'var(--sf)', color: 'var(--ink)' };
const RIGHT: OptionStyle = { border: '1.4px solid var(--acc)', background: 'var(--accs)', color: 'var(--accd)' };
const WRONG: OptionStyle = { border: '1.4px solid var(--acc2)', background: 'var(--acc2s)', color: 'var(--acc2d)' };

/**
 * A locate question without its picture: the question in words where there is
 * one, the list of names where there is not (lib/locateRoutes.ts). Shared by
 * the desktop screen and the phone's, which differ only in how wide it is.
 *
 * CHOOSING IS ANSWERING, on both, as a tap on the picture is: the first one
 * counts. That is how the list has always behaved, and a described question
 * that asked for a second press to confirm would be the only locate route
 * that did.
 *
 * Once answered, what each option turned out to be is said in words as well
 * as shown in colour (WCAG 1.4.1) — and in an exam, neither.
 */
export function LocateWords({
  routes,
  targetStructureId,
  result,
  chosenDescription,
  examMode,
  compact,
  onDescription,
  onName,
}: {
  routes: LocateRoutes;
  targetStructureId: string;
  result: HotspotAnswerResult | null;
  chosenDescription: number | null;
  examMode?: boolean;
  /** The phone's narrower layout. */
  compact?: boolean;
  onDescription: (index: number) => void;
  onName: (structureId: string) => void;
}) {
  const revealing = !!result && !examMode;
  const note = (isRight: boolean, isChosen: boolean) => {
    const text = revealing ? choiceRevealNote(isRight, isChosen) : '';
    return text ? <span className="sr-only"> ({text})</span> : null;
  };

  if (routes.described) {
    const { choices, correctIndex } = routes.described;
    return (
      <div
        role="group"
        aria-label="Descriptions — choose the one that fits"
        onKeyDown={moveFocusWithArrows}
        className={compact ? 'mt-4 flex flex-col gap-2' : 'mt-8 flex w-full max-w-[760px] flex-col gap-3'}
        data-locate-route="described"
      >
        {choices.map((choice, index) => {
          const isRight = index === correctIndex;
          const isChosen = index === chosenDescription;
          const style = revealing && isRight ? RIGHT : revealing && isChosen ? WRONG : PLAIN;
          return (
            <button
              key={choice}
              type="button"
              disabled={!!result}
              onClick={() => onDescription(index)}
              className={`flex items-start gap-3 rounded-[3px] text-left disabled:cursor-default ${compact ? 'p-3 text-sm' : 'px-5 py-4 text-base'}`}
              style={style}
            >
              <span aria-hidden="true" className="w-4 flex-none pt-0.5" style={{ font: '400 12.5px/1.4 var(--font-mono)' }}>
                {LETTERS[index]}
              </span>
              <span className="flex-1 leading-snug">
                {choice}
                {note(isRight, isChosen)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Structure names — choose the one asked for"
      onKeyDown={moveFocusWithArrows}
      className={compact ? 'mt-4 grid grid-cols-2 gap-2' : 'mt-6 grid max-w-2xl grid-cols-3 gap-2.5'}
      data-locate-route="list"
    >
      {routes.list.map((s) => {
        const isRight = s.id === targetStructureId;
        const isChosen = result?.structureId === s.id;
        const style = revealing && isRight ? RIGHT : revealing && isChosen ? WRONG : compact ? { ...PLAIN, background: 'transparent' } : PLAIN;
        return (
          <button
            key={s.id}
            type="button"
            disabled={!!result}
            onClick={() => onName(s.id)}
            className={`rounded-[3px] text-sm disabled:cursor-default ${compact ? 'p-3' : 'p-2.5'}`}
            style={style}
          >
            {s.name}
            {note(isRight, isChosen)}
          </button>
        );
      })}
    </div>
  );
}
