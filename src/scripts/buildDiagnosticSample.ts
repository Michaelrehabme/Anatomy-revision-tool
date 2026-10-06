/**
 * Draws the diagnostic's fixed paper from the seed and writes it down, once.
 *
 *   npx tsx src/scripts/buildDiagnosticSample.ts            (refuses if the file exists)
 *   npx tsx src/scripts/buildDiagnosticSample.ts --force    (see "WHEN TO RUN IT")
 *
 * WHAT IT WRITES. src/features/anatomy-revision/data/diagnostic/fixedSample.v<N>.json:
 * fifteen finished multiple-choice questions — prompt, picture, four choices,
 * which is right — and nothing else about the structures they ask about. That
 * file is COMMITTED and ships to everyone in every kind of build
 * (lib/diagnosticSample.ts says why, and exactly what it makes public).
 *
 * HOW THE FIFTEEN ARE CHOSEN. By the rule the diagnostic used when each class
 * drew its own paper (lib/diagnostic.ts `buildDiagnostic` and
 * `buildDiagnosticQuestions`), given one fixed name in place of a class id.
 * So the paper has the character the live one had — the most-pictured
 * muscles and bones, every area first and then round again, the kinds of
 * question spread — and nobody typed a list.
 *
 * WHEN TO RUN IT. Not at build, and not when the seed changes: the point of a
 * committed file is that the paper stands still while the content moves, so a
 * follow-up in December asks what the baseline asked in October. Run it again
 * only to make a NEW paper, and then as a new version: bump DIAGNOSTIC_VERSION,
 * keep the old file (open baselines are replayed from it), register the new
 * one in lib/diagnosticSample.ts. `--force` overwrites a version's file and is
 * for a version no student has sat yet.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ALL_IMAGES, ALL_STRUCTURES } from '../features/anatomy-revision/data/seed';
import { AREAS } from '../features/anatomy-revision/types/region';
import { generateRevisionSet } from '../features/anatomy-revision/lib/questionGenerators/generateSet';
import {
  buildDiagnostic,
  buildDiagnosticQuestions,
  DIAGNOSTIC_SIZE,
  DIAGNOSTIC_VERSION,
} from '../features/anatomy-revision/lib/diagnostic';
import { FIXED_SAMPLE_MARKER, type FixedSampleFile } from '../features/anatomy-revision/lib/diagnosticSample';
import type { MCQQuestion } from '../features/anatomy-revision/types/question';

/** The name the paper is drawn under, in place of a class id. Changing it changes the paper. */
const DRAWN_AS = 'locus-fixed-sample-2';

const out = join(
  process.cwd(),
  `src/features/anatomy-revision/data/diagnostic/fixedSample.v${DIAGNOSTIC_VERSION}.json`,
);
if (existsSync(out) && !process.argv.includes('--force')) {
  console.error(
    `${out} exists. A paper students may have sat is never redrawn: make a new version instead\n` +
      '(see the note at the top of this script), or pass --force if nobody has sat this one.',
  );
  process.exit(1);
}

const pool = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
  types: ['mcq'], mode: 'practice', seed: 1, entitledAreas: AREAS,
}).filter((q): q is MCQQuestion => q.type === 'mcq');

const spec = buildDiagnostic(ALL_STRUCTURES, DRAWN_AS);
const drawn = buildDiagnosticQuestions(spec, pool);
if (drawn.length !== DIAGNOSTIC_SIZE) {
  console.error(`Drew ${drawn.length} questions, not ${DIAGNOSTIC_SIZE}. Nothing written.`);
  process.exit(1);
}

const areaDrawnFor = new Map(spec.items.map((i) => [i.structureId, i.area]));
const file: FixedSampleFile = {
  sample: `${FIXED_SAMPLE_MARKER}${DIAGNOSTIC_VERSION}`,
  version: DIAGNOSTIC_VERSION,
  drawnAs: DRAWN_AS,
  questions: drawn.map((q) => ({
    coversArea: areaDrawnFor.get(q.structureId)!,
    question: {
      id: q.id,
      structureId: q.structureId,
      region: q.region,
      subregion: q.subregion,
      area: q.area,
      category: q.category,
      difficulty: q.difficulty,
      promptKind: q.promptKind,
      type: 'mcq',
      prompt: q.prompt,
      ...(q.promptImageId ? { promptImageId: q.promptImageId } : {}),
      choices: q.choices,
      correctIndex: q.correctIndex,
      // The generator's explanation is the structure's whole card. The
      // diagnostic shows none, and this file is public.
      explanation: '',
    },
  })),
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
console.log(`Wrote ${out}: ${file.questions.length} questions.`);
for (const { coversArea, question } of file.questions) {
  console.log(`  ${coversArea.padEnd(15)} ${question.promptKind.padEnd(10)} ${question.id}`);
}
