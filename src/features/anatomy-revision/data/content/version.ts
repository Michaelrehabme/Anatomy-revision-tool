/**
 * Which set of facts this build was made from: a hash of every area's facts,
 * written by buildContent.ts and injected by vite.config.ts. 'dev' under the
 * dev server and the test runner, which do not run the generator.
 *
 * A fetched area is kept on the device until this changes
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md). It moves when a fact does and at no
 * other time — not for a new picture, a renamed alias or a code change — so a
 * deploy that touches no content costs no student a refetch.
 *
 * Nothing imports this yet; the fetch that will is a later step.
 */

/** Replaced at build time by vite.config.ts's `define`. Declared here, beside its one reader. */
declare const __CONTENT_VERSION__: string;

export const CONTENT_VERSION: string = __CONTENT_VERSION__;
