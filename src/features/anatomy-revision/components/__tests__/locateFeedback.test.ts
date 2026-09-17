import { describe, it, expect } from 'vitest';
import { locateFeedback } from '../LocateStructureSession/locateFeedback';
import { PASS_SCORE, RING_COUNT } from '../../lib/hotspot/accuracy';

describe('locateFeedback', () => {
  describe('an outline target, which is right or wrong with no score', () => {
    it('names what was tapped before naming the answer', () => {
      const { title, detail } = locateFeedback({ correct: false }, 'Flexor Carpi Radialis', 'Brachioradialis');
      expect(title).toBe('Not quite');
      // The old copy was "That was Flexor Carpi Radialis", which reads as a
      // label for the muscle under the finger — so a student who tapped the
      // wrong one was handed the wrong name and no reason to doubt it.
      expect(detail).toBe('That was Brachioradialis. Flexor Carpi Radialis is shown in green.');
    });

    it('says only where the answer is when the tap landed on nothing', () => {
      expect(locateFeedback({ correct: false }, 'Sartorius').detail).toBe('Sartorius is shown in green.');
    });

    it('does not tell a student they tapped the thing they were asked for', () => {
      // A near miss inside the slack resolves to the target under hitTest, and
      // "That was Sartorius. Sartorius is shown in green" is nonsense.
      expect(locateFeedback({ correct: false }, 'Sartorius', 'Sartorius').detail).toBe(
        'Sartorius is shown in green.',
      );
    });

    it('is brief when the tap was right', () => {
      expect(locateFeedback({ correct: true }, 'Sartorius', 'Sartorius').title).toBe('Correct');
    });
  });

  describe('a scored target, where how close you were is the answer', () => {
    it('reports the score rather than the name', () => {
      const { title, detail } = locateFeedback({ correct: true, accuracy: RING_COUNT }, 'Greater Trochanter');
      expect(title).toBe(`Correct — ${RING_COUNT}/${RING_COUNT}`);
      expect(detail).toBe('Dead centre.');
    });

    it('distinguishes a near miss from a wrong part of the bone', () => {
      const near = locateFeedback({ correct: false, accuracy: PASS_SCORE - 1 }, 'Linea Aspera');
      expect(near.detail).toContain('Close');
      const wrong = locateFeedback({ correct: false, accuracy: 0 }, 'Linea Aspera');
      expect(wrong.detail).toBe('That is not where Linea Aspera sits.');
    });
  });
});
