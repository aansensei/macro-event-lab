// Plain words for the live GDP nowcast shown on the public home and the model page.

import type { LiveNowcast } from "../data/nowcast";
import { formatIsoDate } from "./format";
import { periodLabel } from "./revisionWords";

// "Q3 2026: 3.4% annualized growth, from data published by Nov 23 2026 (3 of 3 months of payrolls)"
export function liveSentence(live: LiveNowcast): string {
  const quarter = periodLabel("KXGDP", live.reference_period);
  const sign = live.nowcast < 0 ? "\u2212" : "";
  return `${quarter}: ${sign}${Math.abs(live.nowcast).toFixed(1)}% annualized growth, from data published by `
    + `${formatIsoDate(live.as_of)} (${live.months_published} of 3 months of payrolls)`;
}
