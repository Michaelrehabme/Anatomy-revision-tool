import { SCOPES, SCOPE_LABELS, run } from './contrastReport';

/**
 * CLI over contrastReport.ts — prints one table per theme scope and exits
 * non-zero on any failure or any token a scope forgot to declare.
 *
 * The logic lives in contrastReport.ts so that a Vitest wrapper asserts the
 * same thing on every `npm test`. A check nobody remembers to run is not
 * evidence, and features/legal/AccessibilityPage.tsx makes a public claim
 * that rests on this.
 *
 *   npm run check:contrast
 */

const { results, missing, failures } = run();

let incomplete = 0;
for (const scope of SCOPES) {
  if (missing[scope].length === 0) continue;
  incomplete += missing[scope].length;
  console.error(
    `\n${SCOPE_LABELS[scope]} does not declare: ${missing[scope].join(', ')}\n` +
      '  A token missing from a scope inherits the light value through :root, which is an\n' +
      '  invisible contrast bug. Declare every token in every block.',
  );
}

for (const scope of SCOPES) {
  console.log(`\n${SCOPE_LABELS[scope]}`);
  console.log('token pair'.padEnd(26) + 'ratio'.padEnd(9) + 'min'.padEnd(6) + 'result');
  console.log('-'.repeat(84));
  for (const r of results.filter((x) => x.scope === scope)) {
    const pair = `${r.check.fg} on ${r.check.bg}`;
    if (r.ratio === null) {
      console.log(pair.padEnd(26) + 'skipped'.padEnd(9) + '-'.padEnd(6) + `${r.note}  ${r.check.what}`);
      continue;
    }
    console.log(
      pair.padEnd(26) +
        `${r.ratio.toFixed(2)}:1`.padEnd(9) +
        `${r.min}`.padEnd(6) +
        `${r.pass ? 'pass' : 'FAIL'}  ${r.check.what}`,
    );
  }
}

console.log('\n' + '='.repeat(84));
if (failures.length > 0 || incomplete > 0) {
  for (const f of failures) {
    console.error(
      `FAIL  ${SCOPE_LABELS[f.scope]}: ${f.check.fg} on ${f.check.bg} is ${f.ratio?.toFixed(2)}:1, needs ${f.min}:1 — ${f.check.what}`,
    );
  }
  console.error(
    `${failures.length} contrast ${failures.length === 1 ? 'failure' : 'failures'}` +
      (incomplete > 0 ? ` and ${incomplete} undeclared ${incomplete === 1 ? 'token' : 'tokens'}` : '') +
      '.',
  );
  process.exit(1);
}
console.log('All four scopes meet their minima (AA, and AAA for text in high contrast).');
