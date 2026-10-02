import { describe, expect, it } from 'vitest';
import { SUCROSE_ATOMS, SUCROSE_BONDS } from '../src/science/sucroseStructure';

describe('the local sucrose model preserves its chemical identity', () => {
  it('represents C12H22O11 with finite coordinates and valid bonds', () => {
    const counts = SUCROSE_ATOMS.reduce<Record<string, number>>((sum, atom) => {
      sum[atom.element] = (sum[atom.element] ?? 0) + 1;
      expect(atom.position.every(Number.isFinite)).toBe(true);
      return sum;
    }, {});
    expect(counts).toEqual({ carbon: 12, hydrogen: 22, oxygen: 11 });
    for (const [a, b] of SUCROSE_BONDS) {
      expect(a).not.toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(SUCROSE_ATOMS.length);
      expect(b).toBeLessThan(SUCROSE_ATOMS.length);
    }
  });
});
