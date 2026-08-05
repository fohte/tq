/** Cycles an index by `delta` within `[0, length)`, wrapping around. */
export function cycleIndex(
  current: number,
  delta: 1 | -1,
  length: number,
): number {
  return (current + delta + length) % length
}
