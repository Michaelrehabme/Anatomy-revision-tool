import '@testing-library/jest-dom/vitest';
import { attachHotspots } from '../features/anatomy-revision/data/seed/hotspots';

/**
 * The hotspot polygons are attached to the images asynchronously in the app
 * (seed/hotspots.ts explains why), and the repositories await that before they
 * hand any image out. A test that reads ALL_IMAGES straight from the seed has
 * no repository to do it, and would see every image with an empty `hotspots`
 * — so the tests over the shipped data would pass by finding nothing.
 *
 * Awaiting it once here keeps those tests reading the real thing, and keeps
 * the assertion that matters — that the shipped polygons are sane — honest.
 */
await attachHotspots();

/**
 * jsdom has no layout, so window.scrollTo is unimplemented and every component
 * that scrolls to the top on a step change logs a red "Not implemented" error
 * through the virtual console. It is noise, not a failure, and noise in a test
 * run is how a real failure goes unread. Stubbed rather than avoided in the
 * components, because scrolling to the top of a new screen is correct
 * behaviour that should not be bent around the test environment.
 */
window.scrollTo = () => {};
