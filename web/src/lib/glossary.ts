// Terms used on the site, in plain words. `short` feeds the hint on hover; `long` the glossary page.

export interface GlossaryEntry {
  id: string;
  term: string;
  short: string;
  long: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "cpi",
    term: "CPI (Consumer Price Index)",
    short: "How much the prices of everyday goods and services changed.",
    long: "The government's measure of how much the prices people pay for everyday goods and services changed. A higher CPI number means prices rose faster, which is what people call inflation.",
  },
  {
    id: "m-m",
    term: "m/m (month over month)",
    short: "The change from the previous month.",
    long: "Compared with the month before. A CPI of 0.3% m/m means prices were 0.3% higher than a month earlier.",
  },
  {
    id: "payrolls",
    term: "Jobs report (nonfarm payrolls)",
    short: "How many jobs the US economy added or lost last month.",
    long: "The monthly count of how many jobs employers outside farming added or lost. More jobs than expected usually signals a stronger economy.",
  },
  {
    id: "gdp",
    term: "GDP (annualized growth)",
    short: "How fast the whole economy grew, stated as a yearly rate.",
    long: "Gross domestic product is the value of everything the country produces. Each quarter's growth is stated as if it lasted a full year, so 2% annualized means the economy is growing at a 2% a year pace.",
  },
  {
    id: "fomc",
    term: "FOMC and the upper bound",
    short: "The Fed committee that sets interest rates, and the top of its target range.",
    long: "The Federal Open Market Committee is the group at the Federal Reserve that sets the main US interest rate. The rate is a range, such as 3.50% to 3.75%; this site follows its top, the upper bound.",
  },
  {
    id: "prediction-market",
    term: "Prediction market",
    short: "A market where people trade on what number will come out.",
    long: "A market where traders buy and sell contracts that pay out only if an event happens, for example 'CPI comes in above 0.3%'. The price of such a contract works like the crowd's probability of that outcome.",
  },
  {
    id: "implied-probability",
    term: "Implied probability",
    short: "The chance of an outcome read from contract prices.",
    long: "A contract that pays $1 if something happens and trades at 56 cents implies about a 56% chance. Putting all the contracts of one release together gives a full set of odds for every possible number.",
  },
  {
    id: "median",
    term: "Median and mean",
    short: "The middle outcome, and the average outcome, of the market's odds.",
    long: "The median is the value with half of the odds below it and half above. The mean is the probability-weighted average. When the odds are lopsided the two differ.",
  },
  {
    id: "sd",
    term: "SD (standard deviation)",
    short: "How spread out the market's odds were: a measure of uncertainty.",
    long: "A typical distance between the possible outcomes and the average. A small SD means traders were confident about the number; a large SD means they were unsure.",
  },
  {
    id: "range",
    term: "50% and 90% range",
    short: "Where the market put the middle half, or nine tenths, of its odds.",
    long: "The 50% range runs from the 25th to the 75th percentile of the market's odds, the 90% range from the 5th to the 95th. If the market is well calibrated, the real number lands inside the 90% range about 9 times in 10.",
  },
  {
    id: "surprise",
    term: "Surprise (in SD)",
    short: "How far the real number was from expectations, in units of uncertainty.",
    long: "The first published number minus what the market expected an hour before, divided by the market's SD. A surprise of +2 SD means the number came in far above expectations given how confident traders were; under 0.5 SD is close to expected.",
  },
  {
    id: "t-1h",
    term: "T−1h, T−7d",
    short: "One hour, or seven days, before the market closed.",
    long: "Times are counted back from the moment trading stopped, just before the release. T−1h is one hour before; for CPI and jobs that is 07:00 ET on release day.",
  },
  {
    id: "first-print",
    term: "First print",
    short: "The number as it was first published, before any later revision.",
    long: "Official numbers are often revised weeks later. Markets react to the first published number, so that is what this site compares expectations with.",
  },
  {
    id: "alfred",
    term: "ALFRED",
    short: "The St. Louis Fed archive of every version of an economic number.",
    long: "ArchivaL Federal Reserve Economic Data keeps every version (vintage) of each economic series, so you can see exactly what was published on a given day, not just today's revised value.",
  },
  {
    id: "point-in-time",
    term: "Point in time",
    short: "Using only what was known at that moment, never later data.",
    long: "Every chart shows only information that was public at the chosen hour. Using data published later would make the market look smarter or dumber than it really was.",
  },
  {
    id: "pp",
    term: "pp (percentage points)",
    short: "The difference between two percentages.",
    long: "Going from 0.3% to 0.5% is a change of 0.2 percentage points.",
  },
  {
    id: "bp",
    term: "bp (basis point)",
    short: "One hundredth of a percentage point.",
    long: "A yield moving from 4.00% to 4.05% has risen 5 basis points. Bond markets usually move a few basis points a day.",
  },
  {
    id: "yield",
    term: "Treasury yield (2-year, 10-year)",
    short: "The interest rate the US government pays to borrow for 2 or 10 years.",
    long: "Set by trading in government bonds. The 2-year yield follows what markets expect the Fed to do soon; the 10-year reflects the longer run. Yields rising after a release usually means markets expect higher interest rates.",
  },
  {
    id: "calibration",
    term: "Calibration",
    short: "Whether stated odds match how often things really happen.",
    long: "A market is well calibrated if outcomes it calls 90% likely really happen about 90% of the time. This site checks that across every release of each kind.",
  },
  {
    id: "fit",
    term: "Fit (isotonic regression)",
    short: "A small correction that makes raw contract prices consistent.",
    long: "Raw prices sometimes say a higher number is more likely than a lower one, which cannot be true. The fit nudges them, trusting tighter quotes more, until every bar is a valid probability.",
  },
];

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY.find((e) => e.id === id);
}
