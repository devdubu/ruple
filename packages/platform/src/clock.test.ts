import { describe, expect, it } from 'vitest';
import { createFixedClock } from './clock';

describe('injectable test clock', () => {
  it('advances a long period without sleeping or exposing mutable dates', () => {
    const clock = createFixedClock('2026-01-01T00:00:00.000Z');
    clock.now().setFullYear(2030);
    clock.advanceBy(90 * 24 * 60 * 60 * 1000);
    expect(clock.now().toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
  it('rejects ambiguous timestamps and invalid advances', () => {
    expect(() => createFixedClock('2026-01-01')).toThrow();
    const clock = createFixedClock('2026-01-01T00:00:00.000Z');
    for (const duration of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER]) {
      expect(() => clock.advanceBy(duration)).toThrow();
    }
  });
});
