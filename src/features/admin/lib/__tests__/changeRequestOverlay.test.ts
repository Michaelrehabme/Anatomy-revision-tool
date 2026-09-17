import { describe, expect, it } from 'vitest';
import { overlayChangeRequests } from '../changeRequestOverlay';
import { CHANGE_REQUESTS_SEED } from '../../data/changeRequests.seed';
import type { ChangeRequest } from '../../types/changeRequest';

/**
 * The rule under test is one sentence: git owns the definition, Firestore owns
 * the state, and neither source alone may hide a change request. The last case
 * is the one that motivated the module — a CR written in git and never seeded
 * used to render nothing at all.
 */

function cr(ref: string, over: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    ref,
    title: `Title for ${ref}`,
    category: 'infrastructure',
    priority: 'p1',
    effort: 'm',
    status: 'new',
    description: 'Seed description.',
    prompt: 'Seed prompt.',
    dependsOn: [],
    createdAt: null,
    startedAt: null,
    completedAt: null,
    notes: '',
    ...over,
  };
}

describe('overlayChangeRequests', () => {
  it('shows a change request that is in git but has never been seeded', () => {
    const out = overlayChangeRequests([cr('CR-001')], []);
    expect(out).toHaveLength(1);
    expect(out[0].ref).toBe('CR-001');
    expect(out[0].status).toBe('new');
  });

  it('keeps a change request created in the app, which has no seed entry', () => {
    const stored = cr('CR-099', { title: 'Raised in the app', status: 'inProgress' });
    const out = overlayChangeRequests([cr('CR-001')], [stored]);
    expect(out.map((i) => i.ref)).toEqual(['CR-001', 'CR-099']);
    expect(out[1].title).toBe('Raised in the app');
  });

  it('takes the definition from git, so an edited walkthrough reaches an admin who seeded months ago', () => {
    const seed = cr('CR-001', {
      title: 'Retitled in git',
      description: 'Rewritten in git.',
      checklist: [
        { id: 'step-a', rank: 1, label: 'Do the thing', why: 'Because.', walkthrough: '1. Do it.', effort: '1 hour' },
      ],
    });
    // The seeder wrote the whole document once; it is now stale on every
    // definition field, which is exactly the state this overlay exists for.
    const stored = cr('CR-001', { title: 'Title as seeded', description: 'Stale copy.' });

    const [out] = overlayChangeRequests([seed], [stored]);
    expect(out.title).toBe('Retitled in git');
    expect(out.description).toBe('Rewritten in git.');
    expect(out.checklist?.[0].label).toBe('Do the thing');
  });

  it('takes the state from Firestore, so git never overwrites what an admin did on the screen', () => {
    const seed = cr('CR-001', { status: 'new' });
    const stored = cr('CR-001', {
      status: 'completed',
      startedAt: '2026-09-01T00:00:00.000Z',
      completedAt: '2026-09-14T00:00:00.000Z',
      notes: 'Done, with caveats.',
      checklistDone: { 'step-a': '2026-09-14T10:00:00.000Z' },
    });

    const [out] = overlayChangeRequests([seed], [stored]);
    expect(out.status).toBe('completed');
    expect(out.startedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(out.completedAt).toBe('2026-09-14T00:00:00.000Z');
    expect(out.notes).toBe('Done, with caveats.');
    expect(out.checklistDone).toEqual({ 'step-a': '2026-09-14T10:00:00.000Z' });
  });

  it('treats notes cleared by an admin as a real value, not a missing field', () => {
    const seed = cr('CR-001', { notes: 'Seeded note.' });
    const [out] = overlayChangeRequests([seed], [cr('CR-001', { notes: '' })]);
    expect(out.notes).toBe('');
  });

  it('orders by ref, which is the numeric order because refs are zero-padded', () => {
    const refs = ['CR-010', 'CR-002', 'CR-001'].map((r) => cr(r));
    expect(overlayChangeRequests(refs, []).map((i) => i.ref)).toEqual(['CR-001', 'CR-002', 'CR-010']);
  });

  it('renders the real backlog with an empty Firestore — the unseeded case, end to end', () => {
    const out = overlayChangeRequests(CHANGE_REQUESTS_SEED, []);
    expect(out).toHaveLength(CHANGE_REQUESTS_SEED.length);

    // CR-033 is the launch-readiness checklist; its steps have to survive the
    // overlay or the tracker renders as an ordinary change request.
    const launch = out.find((i) => i.ref === 'CR-033');
    expect(launch?.checklist).toHaveLength(18);
    expect(launch?.checklist?.every((step) => step.walkthrough.length > 0)).toBe(true);
  });
});
