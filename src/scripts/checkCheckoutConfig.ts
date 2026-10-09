/**
 * Fails a build whose pricing page would refuse to sell.
 *
 *   npx tsx src/scripts/checkCheckoutConfig.ts [dist]
 *
 * WHY. From 23 September to 9 October 2026 the live pricing page said
 * "Subscriptions are not open yet" to every visitor. The Paddle client token
 * is held in Netlify as a SECRET variable; Netlify's own builders can read
 * one, a build on a developer's machine cannot, and is handed a row of
 * asterisks instead. readPaddleConfig (billing/lib/checkout.ts) saw a token
 * that was not a live one in a production build and, as it is meant to, closed
 * the checkout. Nothing failed and nothing was logged: the site simply could
 * not take a payment for seventeen days, and the first anyone knew was the
 * owner trying to buy.
 *
 * So the built pricing chunk is read back. If the build says it is for
 * Paddle's production environment, the token baked into it must be a live
 * one; for the sandbox, a test one. A build with no Paddle settings at all (a
 * local-persistence build, a test build) sells nothing by design and passes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const assets = join(process.cwd(), dist, 'assets');
const chunk = readdirSync(assets).find((name) => /^PricingPage-.*\.js$/.test(name));
if (!chunk) {
  console.log(`checkout check: no pricing page in ${dist}, nothing to check.`);
  process.exit(0);
}

const source = readFileSync(join(assets, chunk), 'utf8');
const read = (key: string) => source.match(new RegExp(`${key}:"([^"]*)"`))?.[1] ?? '';
const environment = read('VITE_PADDLE_ENV');
const token = read('VITE_PADDLE_CLIENT_TOKEN');
const monthly = read('VITE_PADDLE_PRICE_MONTHLY');
const annual = read('VITE_PADDLE_PRICE_ANNUAL');

if (!environment && !token && !monthly && !annual) {
  console.log(`checkout check: ${dist} has no Paddle settings, so it sells nothing. That is right for a local or demo-data build.`);
  process.exit(0);
}

const wanted = environment === 'production' ? 'live_' : 'test_';
const problems: string[] = [];
if (!token.startsWith(wanted)) {
  const shown = /^\*+$/.test(token) ? 'a masked value (asterisks)' : token ? `"${token.slice(0, 5)}…"` : 'nothing';
  problems.push(
    `the client token is ${shown}; a ${environment || 'sandbox'} build needs one starting ${wanted}. ` +
      'If it is masked, the token is a Netlify secret this machine cannot read: put the real value in .env ' +
      'and deploy the finished build with --no-build.',
  );
}
if (!monthly.startsWith('pri_')) problems.push('the monthly price id is missing');
if (!annual.startsWith('pri_')) problems.push('the annual price id is missing');

if (problems.length > 0) {
  console.error(`checkout check FAILED for ${dist}: the pricing page would say "Subscriptions are not open yet".`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`checkout check: ${dist} can sell (${environment || 'sandbox'}, token ${token.slice(0, 5)}…).`);
