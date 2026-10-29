// Least squares line through (x, y) points, as drawn on the compare scatter.

export interface Fit {
  slope: number;
  intercept: number;
  r: number;
  n: number;
}

// null with fewer than two points or when every x is the same
export function ols(points: [number, number][]): Fit | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, [x]) => s + x, 0) / n;
  const my = points.reduce((s, [, y]) => s + y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of points) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r: syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy), n };
}
