export interface JournalEntry {
  id: string;
  month: string;
  title: string;
  paragraphs: string[];
}

// notable moments of the build, each a fact the repository can back up; no figure here comes from market data
export const JOURNAL: JournalEntry[] = [
  {
    id: "the-idea",
    month: "The beginning",
    title: "4:30 in the afternoon, Engineering Hall, and an idea walks in",
    paragraphs: [
      "It was half past four in the main lecture room of Engineering Hall, the hour when the clock moves slower than the data. Then an idea walked in without knocking and took the seat next to me.",
      "It went like this. Every economic number is published once and then quietly edited for years. So if you want to know who predicted a number best, which version of the number do you grade them on? And if you ask a forecaster about 2012, shouldn't you give them the numbers of 2012, not today's polished ones?",
      "That is a very serious question to have in a lecture room at 4:30, and it has refused to leave since. Everything else on this site is what happens when you take it seriously: a time machine for data, a diary of forecasts that nobody can edit, and tests that argue with each other.",
    ],
  },
  {
    id: "slow-arena",
    month: "November 2026",
    title: "The monthly models were too slow, and the reason was economic",
    paragraphs: [
      "The first run of the monthly LASSO for payrolls took far too long. Each fit needed about 1,955 passes of its solver, close to the cap of 5,000, because two columns of the table said almost the same thing: the level of payroll employment and the lagged first prints of the same series.",
      "Dropping the employment indicator for the payrolls target, and only for it, brought a fit down to 287 passes and the whole run to about ten minutes. The rule is written in the evaluation notes with the reason.",
    ],
  },
  {
    id: "second-implementation",
    month: "November 2026",
    title: "A second implementation found a rule the documents did not state",
    paragraphs: [
      "A copy of the five models was written from the written formulas alone and compared with the real code on seeded test data. Ridge, ridge on principal components and LASSO matched on the first try. The autoregression did not.",
      "The real code picks the lag on a common sample and forecasts with that fit, with no refit afterwards. The documents never said so. They do now, and the test suite keeps the second implementation as a permanent check.",
    ],
  },
  {
    id: "floating-point-edge",
    month: "November 2026",
    title: "An independent recomputation caught a rounding accident",
    paragraphs: [
      "A forecast interval is closed, so an actual that lands exactly on its edge is inside. For one inflation month the lower edge was computed as minus 0.49999999999999994 while the actual was minus 0.5, and the code counted a miss.",
      "A script that recomputed every score from the published forecasts disagreed on exactly that row. Edges are now compared with a tolerance of one billionth, and one inflation coverage figure moved by a single forecast.",
    ],
  },
  {
    id: "mutations",
    month: "November 2026",
    title: "Eight deliberate bugs, three caught",
    paragraphs: [
      "To test the tests, eight small bugs were put into the model code one at a time: a wrong divisor, a missing intercept, a solver that stops early, a fixed lag and others. The suite caught three of them.",
      "Five new tests now cover the other five. A passing suite says little until you have seen it fail on purpose.",
    ],
  },
  {
    id: "outside-review",
    month: "November 2026",
    title: "An outside review found real mistakes",
    paragraphs: [
      "An outside review of the repository found that the play mode added up errors measured in different units, and that the percent difference to the naive forecast compared two different sets of months. Both were real, and both were fixed.",
      "It also called some statements too strong. The text on the site now says what the code does and no more, and the limits are written into the evaluation notes.",
    ],
  },
  {
    id: "ledger",
    month: "November 2026",
    title: "Forecasts are written down before the numbers come out",
    paragraphs: [
      "Every day the build records the live forecasts in a public file where each row is hashed together with the row before it, so changing or deleting one breaks the chain. The first daily build wrote sixteen rows.",
      "The first releases that can score them are the November payrolls and the November inflation reports in early December. Until then the track record is empty and says so.",
    ],
  },
  {
    id: "navigation",
    month: "November 2026",
    title: "Too many pages made the site harder to use",
    paragraphs: [
      "The public site reached eleven destinations and a visitor with two minutes felt buried. The header was cut to a handful of tabs, and the rest moved into one menu on phones, the footer and the home page.",
      "The play mode first disappeared with the cut and had to be given its own tab again. Hiding something that works well is a cost too.",
    ],
  },
  {
    id: "plain-result",
    month: "November 2026",
    title: "A plain result that was left in",
    paragraphs: [
      "Over the full history without 2020, repeating the previous payrolls number has the smallest error of the models in the arena, while over the last twelve months the models are closer. Both statements are preliminary and describe a short sample.",
      "The site shows both and names no winner. A result that is not flattering stays in the record.",
    ],
  },
];
