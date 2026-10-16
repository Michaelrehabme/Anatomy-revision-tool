import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';
import { encodeHotspotMap } from '../../features/anatomy-revision/data/seed/hotspotCodec';

/**
 * Rewrites each `hotspots.*.generated.ts` set into the compact form of
 * hotspotCodec.ts as it goes into the bundle. Build only: the dev server and
 * the tests load the plain files, so a set read there is exactly what was
 * published.
 *
 * Only a file whose one export is a plain map of hotspot lists is rewritten.
 * The aggregates (`hotspots.ligaments.generated.ts`, which spreads the parts
 * together) and the muscle index (which is functions) are passed through, so
 * a new kind of generated file is left alone rather than mangled.
 *
 * The set is read by importing the file itself, which Node can do because
 * these modules hold nothing but data and a type-only import. Reading what the
 * module evaluates to, rather than parsing its text, means the encoder sees the
 * same numbers the app would have.
 */
const SET_FILE = /[\\/]hotspots\.[^\\/]+\.generated\.ts$/;
/** Forward slashes even on Windows, as in vite.config.ts's demoFile. */
const CODEC = fileURLToPath(new URL('../../features/anatomy-revision/data/seed/hotspotCodec.ts', import.meta.url)).replace(/\\/g, '/');

export function compactHotspotsPlugin(): Plugin {
  return {
    name: 'compact-hotspots',
    apply: 'build',
    async transform(code, id) {
      if (!SET_FILE.test(id) || id.includes('.index.')) return null;
      // A value import means an aggregate; only type imports are erased.
      if (/^import (?!type )/m.test(code)) return null;
      const module: Record<string, unknown> = await import(pathToFileURL(id).href);
      const names = Object.keys(module);
      if (names.length !== 1) return null;
      const set = module[names[0]];
      if (!isHotspotMap(set)) return null;
      const json = JSON.stringify(encodeHotspotMap(set));
      return {
        code:
          `import { decodeHotspotMap } from ${JSON.stringify(CODEC)};\n` +
          `export const ${names[0]} = decodeHotspotMap(JSON.parse(${JSON.stringify(json)}));\n`,
        map: null,
      };
    },
  };
}

function isHotspotMap(value: unknown): value is Parameters<typeof encodeHotspotMap>[0] {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every((list) => Array.isArray(list));
}
