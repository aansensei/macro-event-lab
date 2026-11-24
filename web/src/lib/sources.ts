import { PUBLIC_EDITION } from "./edition";

type DataSource = readonly [name: string, href: string, role: string];

const PUBLIC_SOURCES: readonly DataSource[] = [
  ["ALFRED", "https://alfred.stlouisfed.org", "First prints, every vintage"],
  ["FRED", "https://fred.stlouisfed.org", "Economic series, release dates"],
];

const RESEARCH_SOURCES: readonly DataSource[] = PUBLIC_EDITION ? PUBLIC_SOURCES : [
  ["Kalshi", "https://kalshi.com", "Market prices"],
  ["ALFRED", "https://alfred.stlouisfed.org", "First prints, every vintage"],
  ["FRED", "https://fred.stlouisfed.org", "Treasury yields, release dates"],
  ["Federal Reserve", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", "FOMC meeting calendar"],
];

export function dataSourcesFor(isPublic: boolean): readonly DataSource[] {
  return isPublic ? PUBLIC_SOURCES : RESEARCH_SOURCES;
}
