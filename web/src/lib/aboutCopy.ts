import { PUBLIC_EDITION } from "./edition";

// the whole project in four lines: the problem, what the site does, how, and with what
const GLANCE: [string, string][] = [
  ["The problem", "Headlines call every CPI print or jobs report a beat or a miss, but they measure it against one consensus guess, and the official number often gets revised later anyway."],
  ["What it does", "Rebuilds, hour by hour, the full set of odds Kalshi traders put on each release since mid 2021, then checks them against the number first published and against how Treasury yields moved that day."],
  ["How", "An automated pipeline saves every raw download, cleans it into tables, and turns contract prices into probability curves with a weighted isotonic fit. Every number is joined point in time, so nothing uses information published later, and every build runs the tests."],
  ["Built with", "Python, Polars, DuckDB, Parquet, pytest and Hypothesis for the pipeline; React, TypeScript and Vite with hand-drawn SVG charts for the site; data from Kalshi, ALFRED, FRED and the Federal Reserve."],
];

const QUESTIONS = [
  "What did the market expect at its comparison snapshot, and how sure was it?",
  "How did that view move during the recorded trading window?",
  "How big was the surprise, measured against the market's own uncertainty instead of a single guess?",
  "Did bond yields move the way the surprise suggested?",
  "Across every release, were the markets well calibrated, and did they beat simply repeating the last number?",
];

const WHY: [string, string][] = [
  ["Numbers as they were known", "Official figures get revised. Judging a forecast against today's revised number uses information nobody had on release day, so every value here carries the moment it became public, and every chart can be replayed hour by hour."],
  ["The whole distribution", "A prediction market prices every outcome, not one consensus number. That shows how sure the market was, how that certainty changed in the week before a release, and how large the surprise really was."],
  ["Checked, not just shown", "A forecast is only useful if it can be checked. Every release is scored with the tools professional forecasters use, Brier score, CRPS and PIT, and compared with a naive guess, so the site says where markets were right and where they were not."],
  ["Readable without an economics degree", "Each event opens with a plain words reading built from its own numbers, and every technical term links to the Glossary."],
  ["Honest about gaps", "When something cannot be measured, such as a release cancelled by the 2025 shutdown or an early market with a single contract, the page explains why instead of filling the gap."],
  ["An engineering project", "Behind the site is an automated, tested data pipeline that collects public market and economic data and rebuilds every table from the raw responses it saved."],
];

const STACK: [string, string][] = [
  ["Data sources", "Kalshi market data for the \"above k\" contracts on CPI, payrolls, GDP and the Fed rate; ALFRED vintages from the Federal Reserve Bank of St. Louis for first prints; FRED release calendars; the Federal Reserve FOMC calendar."],
  ["Pipeline", "Python with httpx, Polars, DuckDB and Parquet. Every API response is stored first as compressed JSON named by its hash, then parsed into clean tables that can be rebuilt from scratch at any time."],
  ["Methods", "As-of joins so a snapshot only sees prices known at that hour; weighted isotonic regression to turn contract prices into a consistent probability curve; bins aligned with how each number is published, so a CPI bin is centred on the value it can actually print."],
  ["Quality", "pytest with Hypothesis property tests, including one that checks no snapshot ever uses later data; ruff; data quality checks on every build; continuous integration on GitHub Actions."],
  ["Website", "React and TypeScript built with Vite into static files, with hand-drawn SVG charts. Each event is one prebuilt JSON file, so the site needs no server."],
];

const FAQ: [string, string][] = [
  ["What does \"point in time\" mean here?", "Each number is shown as it was known at a chosen moment. Drag the time slider to 48 hours before a release and the page shows only the market prices that were public at that hour, never anything published later."],
  ["Why prediction markets instead of economist surveys?", "Markets trade around the clock and price every possible outcome, so their expectations can be read hour by hour as a full distribution. A survey gives one median number, collected days before the release."],
  ["Why compare with the first print and not today's number?", "On release day the market reacted to the first published number. Revisions arrive weeks or months later and are not used for the surprise, so the comparison stays fair to what was known at the time."],
  ["What happens when a release is not published?", "Some releases never came out, such as October 2025 CPI during the government shutdown. The market data is still shown; the first print and the surprise stay empty instead of being filled in."],
  ["Where do the numbers come from?", "From the pipeline described above, run on real data. Numbers derived from Kalshi prices are shown publicly only with Kalshi's permission."],
  ["Can I see the values behind a chart?", "Yes. The outcome and threshold charts have a data table with exactly the values they draw."],
  ["Is this investment advice?", "No. Macro Event Lab is a research and engineering project. Nothing on this site is a recommendation to buy, sell or trade anything."],
];

const PUBLIC_COPY = {
  lead: "An auditable, point-in-time forecast arena for US macro releases, built on ALFRED, FRED and professional forecaster surveys. Preliminary results are live for GDP growth, inflation and payrolls; the foundation model contestants have not run yet.",
  glance: [
    [
      "The problem",
      "Forecasts can look better when judged against revised numbers or information unavailable on forecast day.",
    ],
    [
      "What it does",
      "Scores forecasts of first-published US GDP growth, inflation and payroll changes, from professional forecasters, classical models and baselines, with a record of when each input became available.",
    ],
    [
      "How",
      "A frozen protocol fixes the contestants, the scoring and the leakage rules before results are read. A daily pipeline saves every source response, builds typed tables, replays each forecast as of its own date and exports the website data.",
    ],
    [
      "Built with",
      "Python, Polars, DuckDB, Parquet, pytest and Hypothesis for the pipeline; React, TypeScript and Vite for the site; public economic data from ALFRED and FRED and the Survey of Professional Forecasters from the Federal Reserve Bank of Philadelphia.",
    ],
  ] as [string, string][],
  idea: [
    "Every economic release begins with a first published number. Later revisions can change that number, so a fair forecast comparison must record both the forecast date and the version used as the outcome.",
    "The arena compares professional forecasters, classical methods and, once they have run, time series foundation models against the same first prints. A naive forecast that repeats the previous first print is the bar every contestant must clear. Official ALFRED vintages and FRED release calendars provide the point-in-time evidence.",
    "The results are preliminary. Evaluation periods are short, releases are not independent of each other, and extreme periods such as spring 2020 can dominate an average. The site shows how much of each contestant's error comes from its single worst period so that no ranking is read without it.",
    "I built it to practise the whole path from raw data to a public product: collecting data carefully, modelling it honestly, and explaining the result so anyone can follow it.",
  ],
  questions: [
    "What was first published, and how much was it revised later?",
    "Which forecasts used only information available at the time?",
    "How do forecast errors compare against repeating the previous first print?",
    "How often do forecast intervals contain the first print?",
    "Is one period responsible for most of a contestant's error?",
  ],
  why: [
    [
      "Numbers as they were known",
      "Every value carries the moment it became public. Later revisions cannot enter an earlier forecast.",
    ],
    [
      "Rules written before results",
      "The contestants, the error measures, the interval method and the leakage rules are fixed in a protocol document. Changes are listed after it instead of rewriting it.",
    ],
    [
      "Checked, not just shown",
      "Forecasts are compared over the same periods and against a simple baseline, with interval coverage, a test against the baseline and the worst period share shown next to every error.",
    ],
    [
      "Readable without an economics degree",
      "Plain explanations, a note under every graph on how to read it, and the Glossary explain the economic numbers and methods.",
    ],
    [
      "Honest about gaps",
      "Unavailable releases remain missing. The pipeline does not fill them with invented observations, and results stay labelled preliminary until every contestant has run.",
    ],
    [
      "An engineering project",
      "A tested pipeline rebuilds economic tables from saved source responses, and the same checks run on every change.",
    ],
  ] as [string, string][],
  stack: [
    [
      "Data sources",
      "ALFRED vintages for first prints and FRED release calendars, from the Federal Reserve Bank of St. Louis. The Survey of Professional Forecasters from the Federal Reserve Bank of Philadelphia supplies the professional benchmark for GDP growth.",
    ],
    [
      "Contestants",
      "A naive baseline, an autoregression, ridge regression, ridge on principal components and LASSO, all written for this project and refit at every forecast date, plus the survey median. Two time series foundation models are planned and have not run.",
    ],
    [
      "Pipeline",
      "Python with httpx, Polars, DuckDB and Parquet. Source responses are saved as compressed, content-addressed files before parsing, and the site data is rebuilt every day.",
    ],
    [
      "Methods",
      "As-of joins select only information published by the forecast cutoff. First prints and later revisions are kept separate. Intervals use a conformal rule on recent absolute errors, and differences from the baseline use a Diebold-Mariano test with a small sample correction.",
    ],
    [
      "Quality",
      "pytest with Hypothesis property tests, ruff, data quality checks, an independent recomputation of the key numbers and continuous integration on GitHub Actions.",
    ],
    [
      "Website",
      "React and TypeScript built with Vite into static files with SVG charts and checked JSON inputs.",
    ],
  ] as [string, string][],
  faq: [
    [
      "What does \"point in time\" mean here?",
      "Each forecast may use only information already published at its stated cutoff. Later observations and revisions are excluded.",
    ],
    [
      "Which forecasts are in the arena today?",
      "A naive baseline, an autoregression, ridge regression, ridge on principal components, LASSO and, for GDP growth only, the survey median. The two foundation models are planned and have not run, so the results are labelled preliminary.",
    ],
    [
      "Why compare professional surveys with forecasting methods?",
      "They offer different ways of forecasting the same economic release. A common information date and first-print outcome make the comparison auditable.",
    ],
    [
      "Why compare with the first print and not today's number?",
      "The first print was the number available on release day. Revisions arrive later, so they are shown separately.",
    ],
    [
      "Why does one period matter so much?",
      "Errors are squared, so one extreme period can supply most of the total. The leaderboard shows each contestant's worst period share so you can see when that happens.",
    ],
    [
      "What happens when a release is not published?",
      "Its first print remains empty. Missing releases are not filled with invented values.",
    ],
    [
      "Where do the numbers come from?",
      "From saved ALFRED vintages, FRED release calendars and the Philadelphia Fed survey, run through the checked pipeline described above.",
    ],
    [
      "Can I see the values behind a chart?",
      "Yes. Chart readouts and data tables show the values drawn by each chart.",
    ],
    [
      "Is this investment advice?",
      "No. Macro Event Lab is a research and engineering project. Nothing on this site is a recommendation to buy, sell or trade anything.",
    ],
  ] as [string, string][],
  disclaimer: [
    "It can contain mistakes. Data can be missing, delayed or wrong, and forecasting methods rest on assumptions that may not hold. Please check anything important against the original sources.",
    "Nothing on this site is investment, trading, financial, legal or tax advice, and nothing here is an offer or a recommendation to buy or sell anything. Past forecasts do not predict future results.",
    "The site is not affiliated with, endorsed by or sponsored by the Federal Reserve, the Federal Reserve Bank of Philadelphia, the Federal Reserve Bank of St. Louis, the Bureau of Labor Statistics or the Bureau of Economic Analysis. Their names identify data sources, whose data remain subject to their own terms.",
  ],
};

const RESEARCH_COPY: typeof PUBLIC_COPY = PUBLIC_EDITION ? PUBLIC_COPY : {
  lead: "Macro Event Lab shows what prediction markets expected before each US CPI report, jobs report, GDP release and Fed decision, and how that compared with the number first published.",
  glance: GLANCE,
  idea: ["Every month the economy gets a report card: a CPI print, a jobs number, a GDP estimate, a Fed decision. Headlines call each one a beat or a miss, but against what? Usually a single consensus figure from a survey taken days earlier, compared with a number that is often revised later anyway.", "Prediction markets offer something richer. On Kalshi, traders buy and sell contracts such as \"CPI above 0.3%\" at many thresholds at once. Read together, those prices form a full probability distribution of what the market expected, updated every hour. Macro Event Lab rebuilds that distribution for every release since mid 2021, lines it up with the number first published, and checks how the bond market reacted.", "I built it to practise the whole path from raw data to a public product: collecting data carefully, modelling it honestly, and explaining the result so anyone can follow it."],
  questions: QUESTIONS,
  why: WHY,
  stack: STACK,
  faq: FAQ,
  disclaimer: ["It can contain mistakes. Data can be missing, delayed or wrong, and the methods used to turn market prices into probabilities rest on assumptions that may not hold. Please check anything important against the original sources.", "Nothing on this site is investment, trading, financial, legal or tax advice, and nothing here is an offer or a recommendation to buy or sell anything. Past market expectations do not predict future results.", "The site is not affiliated with, endorsed by or sponsored by Kalshi, the Federal Reserve, the Federal Reserve Bank of St. Louis, the Bureau of Labor Statistics or the Bureau of Economic Analysis. Their names are used only to identify where the data comes from, and their data stays subject to their own terms."],
};

export function aboutCopyFor(isPublic: boolean): typeof PUBLIC_COPY {
  return isPublic ? PUBLIC_COPY : RESEARCH_COPY;
}
