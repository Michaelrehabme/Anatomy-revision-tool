/**
 * What a "select all that apply" option turned out to be, in words.
 *
 * Once an answer is checked the options show it with a solid, a dashed or a
 * red border, and nothing else — colour and line style alone (WCAG 1.4.1), and
 * nothing at all to a screen reader, which reads four disabled buttons with
 * the same names they had before. This is the text of that border, appended
 * to each option as visually hidden text; empty for an option that was rightly
 * left alone, which has nothing to add.
 */
export function choiceRevealNote(isCorrectChoice: boolean, isSelected: boolean): string {
  if (isCorrectChoice) return isSelected ? 'correct' : 'correct, not chosen';
  return isSelected ? 'wrong' : '';
}
