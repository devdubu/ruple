export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };

export function createFixedClock(instant: string) {
  let milliseconds = Date.parse(instant);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== instant) {
    throw new Error('Fixed clock requires a canonical UTC ISO timestamp');
  }
  return {
    now: () => new Date(milliseconds),
    advanceBy(deltaMs: number) {
      if (!Number.isSafeInteger(deltaMs) || deltaMs < 0 || !Number.isFinite(new Date(milliseconds + deltaMs).getTime())) {
        throw new Error('Clock advance requires a non-negative integer duration');
      }
      milliseconds += deltaMs;
    },
  };
}
