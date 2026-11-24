import type { Page } from "./url";

// pages built on Kalshi market data; the public edition leaves them out until Kalshi gives written permission
export const MARKET_PAGES: readonly Page[] = ["events", "compare", "scorecard"];

// the public edition (built with VITE_EDITION=public) publishes only pages made from public government data
export const PUBLIC_EDITION: boolean = import.meta.env.VITE_EDITION === "public";

export function inEdition(page: Page, isPublic: boolean = PUBLIC_EDITION): boolean {
  return !isPublic || !MARKET_PAGES.includes(page);
}
