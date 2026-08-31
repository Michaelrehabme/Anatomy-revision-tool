import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSpeechSupported, canPronounce, pronounce } from '../pronunciation';

describe('isSpeechSupported / canPronounce', () => {
  const originalSpeechSynthesis = (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  const originalUtterance = (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;

  afterEach(() => {
    (window as unknown as { speechSynthesis?: unknown }).speechSynthesis = originalSpeechSynthesis;
    (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = originalUtterance;
  });

  it('reports unsupported when the API is absent (jsdom default)', () => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    delete (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    expect(isSpeechSupported()).toBe(false);
  });

  it('reports supported once both pieces of the API exist', () => {
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { speak: vi.fn(), cancel: vi.fn() };
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {};
    expect(isSpeechSupported()).toBe(true);
  });

  it('canPronounce is true when an audioUrl exists even without speech support', () => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    expect(canPronounce({ name: 'Deltoid', audioUrl: '/audio/deltoid.mp3' })).toBe(true);
  });

  it('canPronounce is false with neither audioUrl nor speech support', () => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    delete (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    expect(canPronounce({ name: 'Deltoid' })).toBe(false);
  });
});

describe('pronounce', () => {
  let speak: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    speak = vi.fn();
    cancel = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { speak, cancel };
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      text: string;
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    };
  });

  it('speaks the structure name via speech synthesis when there is no audioUrl', () => {
    pronounce({ name: 'Flexor hallucis longus' });
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as { text: string; rate: number };
    expect(utterance.text).toBe('Flexor hallucis longus');
    expect(utterance.rate).toBeLessThan(1); // slower than default, per the module's own comment
  });

  it('does not throw when speech synthesis is unavailable and there is no audioUrl', () => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    expect(() => pronounce({ name: 'Deltoid' })).not.toThrow();
    expect(speak).not.toHaveBeenCalled();
  });

  it('plays the recorded clip instead of speech synthesis when audioUrl is present', () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      class {
        play = play;
      },
    );
    pronounce({ name: 'Deltoid', audioUrl: '/audio/deltoid.mp3' });
    expect(play).toHaveBeenCalledTimes(1);
    expect(speak).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('falls back to speech synthesis if the recorded clip fails to play', async () => {
    const play = vi.fn().mockRejectedValue(new Error('404'));
    vi.stubGlobal(
      'Audio',
      class {
        play = play;
      },
    );
    pronounce({ name: 'Deltoid', audioUrl: '/audio/broken.mp3' });
    await vi.waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    vi.unstubAllGlobals();
  });
});
