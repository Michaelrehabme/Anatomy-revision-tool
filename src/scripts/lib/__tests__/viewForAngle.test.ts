import { describe, expect, it } from 'vitest';
import { viewForAngle } from '../viewForAngle';

describe('viewForAngle', () => {
  it('names a one-sided plate the way the ligament plates always have', () => {
    // Checked on the renders: 90 looks at a left limb from the inside.
    expect(viewForAngle(0, false)).toBe('anterior');
    expect(viewForAngle(30, false)).toBe('anteromedial');
    expect(viewForAngle(60, false)).toBe('anteromedial');
    expect(viewForAngle(90, false)).toBe('medial');
    expect(viewForAngle(120, false)).toBe('posteromedial');
    expect(viewForAngle(150, false)).toBe('posteromedial');
    expect(viewForAngle(180, false)).toBe('posterior');
    expect(viewForAngle(210, false)).toBe('posterolateral');
    expect(viewForAngle(240, false)).toBe('posterolateral');
    expect(viewForAngle(270, false)).toBe('lateral');
    expect(viewForAngle(300, false)).toBe('anterolateral');
    expect(viewForAngle(330, false)).toBe('anterolateral');
  });

  it('agrees with the ligament publisher at its eight angles', () => {
    expect([0, 45, 90, 135, 180, 225, 270, 315].map((a) => viewForAngle(a, false))).toEqual([
      'anterior', 'anteromedial', 'medial', 'posteromedial',
      'posterior', 'posterolateral', 'lateral', 'anterolateral',
    ]);
  });

  it('never calls a midline plate medial', () => {
    for (let a = 0; a < 360; a += 30) expect(viewForAngle(a, true)).not.toMatch(/medial/);
    expect(viewForAngle(90, true)).toBe('lateral');
    expect(viewForAngle(270, true)).toBe('lateral');
    expect(viewForAngle(30, true)).toBe('anterolateral');
    expect(viewForAngle(150, true)).toBe('posterolateral');
  });
});
