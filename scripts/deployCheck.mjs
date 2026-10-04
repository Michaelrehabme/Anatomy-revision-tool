import { execSync } from 'node:child_process';
import { lstatSync, realpathSync } from 'node:fs';

/**
 * Refuses to deploy a working tree that doesn't match the remote.
 *
 * This exists because of a real incident: two checkouts of this project live
 * on the same machine, and a deploy was run from the one that was missing two
 * days of committed work. The site silently lost a whole question type. The
 * build output looked fine — it was just built from the wrong repository, and
 * nothing in the deploy path had any opinion about which commit it came from.
 *
 * The check is deliberately about IDENTITY, not correctness: it cannot tell
 * whether the code is good, only whether what you are about to publish is a
 * commit that exists on the remote everyone else can see.
 *
 * Run `npm run deploy` rather than `netlify deploy` directly. Better still,
 * let Netlify build from git (see README "Deploying"), which removes the local
 * working tree from the deploy path entirely and makes this script redundant.
 */

const run = (cmd) => execSync(cmd, { encoding: 'utf-8' }).trim();

function fail(message, detail) {
  console.error(`\nRefusing to deploy: ${message}\n`);
  if (detail) console.error(`${detail}\n`);
  process.exit(1);
}

/**
 * A linked node_modules ships functions that cannot start.
 *
 * Found on 4 Oct 2026 in the production log: the daily renewal-reminders run
 * died three times with "Cannot find package 'firebase-admin'". The deploy had
 * been made from a git worktree whose node_modules was a junction to the main
 * checkout's (the draft-preview recipe). Netlify's function bundler traces
 * each function's dependencies and copies them into the zip; through a
 * junction it copies the link and none of the files. The zips came out at
 * about 62 KB instead of 2.2 MB, for all three functions — the Paddle webhook
 * and the billing portal with them — and nothing in the deploy said so.
 *
 * A junction is fine for a DRAFT of the front end. It must never reach
 * production, where the functions are the payment chain.
 */
let modules;
try {
  modules = lstatSync('node_modules');
} catch {
  fail('there is no node_modules here.', 'Run `npm ci` in this checkout first.');
}
if (modules.isSymbolicLink()) {
  fail(
    'node_modules is a link (a junction or symlink), not a real install.',
    `It points at ${realpathSync('node_modules')}.\n` +
      'Functions built through a link are deployed WITHOUT their dependencies:\n' +
      'the Paddle webhook, the billing portal and the renewal reminders would\n' +
      'all fail on their first call. Deploy from a checkout with its own\n' +
      '`npm ci`, or let Netlify build from git.',
  );
}

const branch = run('git rev-parse --abbrev-ref HEAD');
const head = run('git rev-parse --short HEAD');

if (run('git status --porcelain')) {
  fail(
    'the working tree has uncommitted changes.',
    'What you deploy would not correspond to any commit, so nobody could\n' +
      'reproduce or roll back to it. Commit or stash first:\n\n' +
      run('git status --short'),
  );
}

// A fetch failure shouldn't block a deploy outright — offline is a legitimate
// state — but it does mean the comparison below is against stale information.
let fetched = true;
try {
  execSync('git fetch --quiet origin', { stdio: 'ignore' });
} catch {
  fetched = false;
  console.warn('Warning: could not reach origin, comparing against the last fetch.\n');
}

let upstream;
try {
  upstream = run(`git rev-parse --abbrev-ref ${branch}@{upstream}`);
} catch {
  fail(
    `branch "${branch}" is not tracking a remote branch.`,
    'A deploy from a branch that exists only on this machine is exactly how\n' +
      'work published from another checkout gets overwritten. Push it first.',
  );
}

const ahead = Number(run(`git rev-list --count ${upstream}..HEAD`));
const behind = Number(run(`git rev-list --count HEAD..${upstream}`));

if (ahead > 0) {
  fail(
    `${ahead} commit${ahead === 1 ? '' : 's'} on ${branch} ${ahead === 1 ? 'is' : 'are'} not pushed to ${upstream}.`,
    'Push first, so the deployed site corresponds to something another\n' +
      'machine can check out.',
  );
}

if (behind > 0) {
  fail(
    `${branch} is ${behind} commit${behind === 1 ? '' : 's'} behind ${upstream}.`,
    'Someone else has published work you do not have. Deploying now would\n' +
      'remove it from the live site. Pull first:\n\n' +
      run(`git log --oneline HEAD..${upstream}`),
  );
}

console.log(`Deploying ${branch} at ${head}${fetched ? '' : ' (unverified: origin unreachable)'} — matches ${upstream}.\n`);
