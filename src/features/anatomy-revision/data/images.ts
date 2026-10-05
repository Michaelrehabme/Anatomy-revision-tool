import { IMAGE_ASSETS } from './seed/images.seed';

/**
 * Every picture the app has: plates, panels, turntable frames.
 *
 * Its own module so that app code can have the pictures WITHOUT importing
 * data/seed's index, which also imports every structure's facts. The pictures
 * are public and stay bundled in every kind of build; the facts do not
 * (data/content/contentSource.ts). A screen that only wanted an image list
 * used to pull the whole seed in behind it, and in a build that serves facts
 * from the server that one import would have put them all back.
 *
 * The same array data/seed exports as ALL_IMAGES, not a copy: the hotspot
 * polygons are attached to these objects after load (seed/hotspots.ts).
 */
export const ALL_IMAGES = IMAGE_ASSETS;
