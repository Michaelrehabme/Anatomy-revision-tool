/**
 * Web Speech API wrapper (CR-011) — zero assets, zero cost, works offline,
 * available everywhere modern, at the cost of mangling some Latin terms.
 * `audioUrl` on a structure overrides synthesis when a hand-recorded clip
 * exists (none recorded yet); callers should hide the pronounce button
 * entirely when `canPronounce` is false rather than show a button that errors.
 */

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export interface PronounceableStructure {
  name: string;
  audioUrl?: string;
}

export function canPronounce(structure: PronounceableStructure): boolean {
  return !!structure.audioUrl || isSpeechSupported();
}

/** Slightly slower than the default rate — these are unfamiliar multi-syllable Latin terms. */
const SPEECH_RATE = 0.85;

function speakName(name: string): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel(); // a rapid second click shouldn't queue behind the first utterance
  const utterance = new SpeechSynthesisUtterance(name);
  utterance.rate = SPEECH_RATE;
  window.speechSynthesis.speak(utterance);
}

/** Prefers a hand-recorded clip when present, otherwise falls back to synthesis. No-ops silently if neither is available. */
export function pronounce(structure: PronounceableStructure): void {
  if (structure.audioUrl) {
    const audio = new Audio(structure.audioUrl);
    audio.play().catch(() => speakName(structure.name)); // e.g. a 404 on the clip — fall back rather than go silent
    return;
  }
  speakName(structure.name);
}
