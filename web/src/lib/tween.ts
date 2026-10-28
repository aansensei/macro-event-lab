// Easing and interpolation for chart transitions.

// fast start, gentle landing
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

// values part of the way from `from` to `to`; arrays of different length jump straight to `to`
export function lerpArrays(from: number[], to: number[], t: number): number[] {
  if (from.length !== to.length) return to;
  return to.map((v, i) => (from[i] as number) + (v - (from[i] as number)) * t);
}
