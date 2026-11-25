// the probabilities of the live quantiles: 0.05 to 0.95 in steps of 0.05
export const ODDS_PROBS: readonly number[] = Array.from({ length: 19 }, (_, i) => Math.round((i + 1) * 5) / 100);

export interface Odds {
  // chance that the number ends up above the threshold, between 0.05 and 0.95 when it can be read from the quantiles
  value: number;
  // "over" and "under" mean the threshold lies outside the range of the quantiles, so only a bound is known
  bound: "exact" | "over" | "under";
}

// chance of ending above `threshold`, from the predictive quantiles by linear interpolation of the distribution
export function probabilityAbove(quantiles: readonly number[], threshold: number): Odds {
  const first = quantiles[0];
  const last = quantiles[quantiles.length - 1];
  if (first === undefined || last === undefined || quantiles.length !== ODDS_PROBS.length) throw new Error("Expected 19 quantiles.");
  if (threshold <= first) return { value: 1 - ODDS_PROBS[0]!, bound: "over" };
  if (threshold >= last) return { value: 1 - ODDS_PROBS[ODDS_PROBS.length - 1]!, bound: "under" };
  for (let i = 1; i < quantiles.length; i += 1) {
    const high = quantiles[i]!;
    if (threshold <= high) {
      const low = quantiles[i - 1]!;
      const share = high === low ? 0 : (threshold - low) / (high - low);
      const cdf = ODDS_PROBS[i - 1]! + share * (ODDS_PROBS[i]! - ODDS_PROBS[i - 1]!);
      return { value: 1 - cdf, bound: "exact" };
    }
  }
  return { value: 1 - ODDS_PROBS[ODDS_PROBS.length - 1]!, bound: "under" };
}

// the wording of the odds as a whole percent, with the word over or under when only a bound is known
export function oddsLabel(odds: Odds): string {
  const percent = Math.round(odds.value * 100);
  if (odds.bound === "over") return `over ${percent}%`;
  if (odds.bound === "under") return `under ${percent}%`;
  return `${percent}%`;
}

const STEP: Record<string, number> = { gdp: 1, cpi: 0.1, payrolls: 50 };

// five round thresholds centred near the middle of the predictive distribution of a target
export function thresholdsFor(target: string, middle: number): number[] {
  const step = STEP[target] ?? 1;
  const centre = Math.round(middle / step) * step;
  return [-2, -1, 0, 1, 2].map((offset) => Number((centre + offset * step).toFixed(2)));
}
