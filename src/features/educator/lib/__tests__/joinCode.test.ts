import { describe, it, expect } from 'vitest';
import { generateJoinCode } from '../joinCode';

describe('generateJoinCode', () => {
  it('is 6 characters long', () => {
    expect(generateJoinCode()).toHaveLength(6);
  });

  it('only uses unambiguous uppercase alphanumeric characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateJoinCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('is not the same value every call', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
