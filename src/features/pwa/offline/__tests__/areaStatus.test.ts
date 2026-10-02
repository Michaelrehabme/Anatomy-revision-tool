import { describe, expect, it } from 'vitest';
import { actionsFor, areaStatus, percentDone } from '../areaStatus';
import { emptyRecord, type AreaRecord } from '../offlineCache';

const partial: AreaRecord = { ...emptyRecord('knee'), files: { '/anatomy/a.webp': 'aaaaaaaaaaaaaaaa' }, bytes: 100 };
const complete: AreaRecord = { ...partial, manifestHash: '1111111111111111', completedAt: '2026-10-02T09:00:00.000Z' };

describe('areaStatus', () => {
  it('is not downloaded with no record, or a record holding nothing', () => {
    expect(areaStatus({ record: null, latestHash: 'x', downloading: false })).toBe('not-downloaded');
    expect(areaStatus({ record: emptyRecord('knee'), latestHash: 'x', downloading: false })).toBe('not-downloaded');
  });

  it('is downloading whenever a download is running, whatever is held', () => {
    expect(areaStatus({ record: null, latestHash: null, downloading: true })).toBe('downloading');
    expect(areaStatus({ record: complete, latestHash: '2222222222222222', downloading: true })).toBe('downloading');
  });

  it('is paused when some arrived and it never finished', () => {
    expect(areaStatus({ record: partial, latestHash: '1111111111111111', downloading: false })).toBe('paused');
  });

  it('is downloaded when it finished against the current manifest', () => {
    expect(areaStatus({ record: complete, latestHash: '1111111111111111', downloading: false })).toBe('downloaded');
  });

  it('has an update when the manifest has moved on', () => {
    expect(areaStatus({ record: complete, latestHash: '2222222222222222', downloading: false })).toBe('update-available');
  });

  // Offline there is no index to compare against. What is held is what will
  // be shown, and that is "Downloaded".
  it('is downloaded, not unknown, when the index could not be fetched', () => {
    expect(areaStatus({ record: complete, latestHash: null, downloading: false })).toBe('downloaded');
  });
});

describe('actionsFor', () => {
  it('offers what each state supports', () => {
    expect(actionsFor('not-downloaded', false)).toEqual(['download']);
    expect(actionsFor('downloading', false)).toEqual(['cancel']);
    expect(actionsFor('paused', false)).toEqual(['resume', 'remove']);
    expect(actionsFor('downloaded', false)).toEqual(['remove']);
    expect(actionsFor('update-available', false)).toEqual(['update', 'remove']);
  });

  it('never fetches for a locked area, but always lets its storage be taken back', () => {
    expect(actionsFor('not-downloaded', true)).toEqual([]);
    expect(actionsFor('paused', true)).toEqual(['remove']);
    expect(actionsFor('downloaded', true)).toEqual(['remove']);
    expect(actionsFor('update-available', true)).toEqual(['remove']);
    expect(actionsFor('downloading', true)).toEqual(['cancel']);
  });
});

describe('percentDone', () => {
  it('does not round up to 100 while anything is missing', () => {
    expect(percentDone(999, 1000)).toBe(99);
    expect(percentDone(1000, 1000)).toBe(100);
  });

  it('is 0 before the size is known', () => {
    expect(percentDone(50, null)).toBe(0);
    expect(percentDone(0, 1000)).toBe(0);
  });
});
