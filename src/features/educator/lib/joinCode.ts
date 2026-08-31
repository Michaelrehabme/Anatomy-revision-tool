/**
 * 6-character join code, uppercase alphanumeric, excluding characters
 * students commonly transpose when copying a code by hand: 0/O and 1/I/L.
 * Not cryptographically unique — collision handling (regenerate on a
 * duplicate) lives in cohortsRepository.createCohort, which is the only
 * caller that can check against existing codes.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
