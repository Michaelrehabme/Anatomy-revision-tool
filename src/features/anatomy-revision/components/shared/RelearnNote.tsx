/**
 * Above a question asked again after its relearn card (lib/relearn.ts): says
 * why it is back and that it does not count, in the same voice as the card's
 * "Learn · not scored".
 */
export function RelearnNote() {
  return (
    <div
      role="note"
      className="mx-auto mt-6 w-full max-w-2xl px-6 text-center"
      style={{ font: '500 10px/1.4 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
    >
      Once more · not scored · missed three times running
    </div>
  );
}
