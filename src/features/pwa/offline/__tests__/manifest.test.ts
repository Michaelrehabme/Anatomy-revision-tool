import { describe, expect, it } from 'vitest';
import { AREAS } from '../../../anatomy-revision/types/region';
import {
  diffManifest,
  formatBytes,
  manifestHashInput,
  parseAreaManifest,
  parseOfflineIndex,
  type AreaManifest,
} from '../manifest';

const file = (name: string, hash: string, bytes = 100) => ({ url: `/anatomy/joints/${name}.webp`, bytes, hash });

const manifest = (files = [file('a', 'aaaaaaaaaaaaaaaa'), file('b', 'bbbbbbbbbbbbbbbb', 250)]): AreaManifest => ({
  version: 1,
  area: 'elbow',
  hash: '0123456789abcdef',
  bytes: files.reduce((sum, f) => sum + f.bytes, 0),
  files,
});

describe('diffManifest', () => {
  it('is a full download when nothing is held', () => {
    const diff = diffManifest(manifest(), {});
    expect(diff.toFetch.map((f) => f.url)).toEqual(['/anatomy/joints/a.webp', '/anatomy/joints/b.webp']);
    expect(diff).toMatchObject({ toDelete: [], fetchBytes: 350, heldBytes: 0 });
  });

  it('is a resume when some is held: only the rest is fetched, and progress starts where it stopped', () => {
    const diff = diffManifest(manifest(), { '/anatomy/joints/a.webp': 'aaaaaaaaaaaaaaaa' });
    expect(diff.toFetch.map((f) => f.url)).toEqual(['/anatomy/joints/b.webp']);
    expect(diff).toMatchObject({ fetchBytes: 250, heldBytes: 100 });
  });

  // A re-render reuses the filename. The URL being held proves nothing.
  it('refetches a file whose hash changed under the same url', () => {
    const diff = diffManifest(manifest(), {
      '/anatomy/joints/a.webp': 'aaaaaaaaaaaaaaaa',
      '/anatomy/joints/b.webp': '0000000000000000',
    });
    expect(diff.toFetch.map((f) => f.url)).toEqual(['/anatomy/joints/b.webp']);
    expect(diff.toDelete).toEqual([]);
  });

  it('deletes what the area no longer includes', () => {
    const diff = diffManifest(manifest(), {
      '/anatomy/joints/a.webp': 'aaaaaaaaaaaaaaaa',
      '/anatomy/joints/b.webp': 'bbbbbbbbbbbbbbbb',
      '/anatomy/regions/retired.webp': 'cccccccccccccccc',
    });
    expect(diff).toMatchObject({ toFetch: [], toDelete: ['/anatomy/regions/retired.webp'], heldBytes: 350 });
  });
});

describe('parseAreaManifest', () => {
  it('reads back what the generator writes', () => {
    expect(parseAreaManifest(JSON.parse(JSON.stringify(manifest())), 'elbow')).toEqual(manifest());
  });

  // The SPA fallback answers a missing /offline/elbow.json with index.html and
  // a 200. Whatever that parses as, it must not be "an area with no files".
  it.each([
    ['a web page', '<!doctype html>'],
    ['null', null],
    ['an empty file list', { ...manifest(), files: [] }],
    ['another area', { ...manifest(), area: 'knee' }],
    ['a future version', { ...manifest(), version: 2 }],
    ['a file outside /anatomy/', manifest([{ url: '/index.html', bytes: 1, hash: 'aaaaaaaaaaaaaaaa' }])],
    ['a path that climbs out', manifest([{ url: '/anatomy/../sw.js', bytes: 1, hash: 'aaaaaaaaaaaaaaaa' }])],
    ['a file with no hash', manifest([{ url: '/anatomy/a.webp', bytes: 1, hash: '' }])],
  ])('refuses %s', (_name, raw) => {
    expect(parseAreaManifest(raw, 'elbow')).toBeNull();
  });
});

describe('parseOfflineIndex', () => {
  const areas = Object.fromEntries(AREAS.map((a) => [a, { bytes: 10, files: 2, hash: 'aaaaaaaaaaaaaaaa' }]));

  it('reads an index that covers every area', () => {
    expect(parseOfflineIndex({ version: 1, areas })?.areas.knee).toEqual({ bytes: 10, files: 2, hash: 'aaaaaaaaaaaaaaaa' });
  });

  it('refuses one with an area missing, rather than reporting it as size zero', () => {
    const rest = Object.fromEntries(Object.entries(areas).filter(([area]) => area !== 'knee'));
    expect(parseOfflineIndex({ version: 1, areas: rest })).toBeNull();
    expect(parseOfflineIndex('<!doctype html>')).toBeNull();
  });
});

describe('manifestHashInput', () => {
  it('does not depend on the order the files were listed in', () => {
    const a = file('a', 'aaaaaaaaaaaaaaaa');
    const b = file('b', 'bbbbbbbbbbbbbbbb');
    expect(manifestHashInput([a, b])).toBe(manifestHashInput([b, a]));
  });

  it('changes when a file is redrawn', () => {
    expect(manifestHashInput([file('a', 'aaaaaaaaaaaaaaaa')])).not.toBe(manifestHashInput([file('a', 'bbbbbbbbbbbbbbbb')]));
  });
});

describe('formatBytes', () => {
  it.each([
    [640, '640 B'],
    [23_052, '23 KB'],
    [9_997_424, '10.0 MB'],
    [62_200_000, '62 MB'],
    [1_240_000_000, '1.2 GB'],
  ])('%d -> %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});
