const REPO = "https://github.com/aansensei/macro-event-lab";

const WHY: [string, string][] = [
  ["Numbers as they were known", "Official figures get revised. Judging a forecast against today's revised number uses information nobody had on release day, so every value here carries the moment it became public, and every chart can be replayed hour by hour."],
  ["The whole distribution", "A prediction market prices every outcome, not one consensus number. That shows how sure the market was, how that certainty changed in the week before a release, and how large the surprise really was."],
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

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="about-rows">
      {rows.map(([term, text]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function About() {
  return (
    <article className="about-page page-fade">
      <h1 className="t-h1">About Macro Event Lab</h1>
      <p className="about-lead">
        Macro Event Lab shows what prediction markets expected before each US CPI report, jobs report,
        GDP release and Fed decision, and how that compared with the number first published.
      </p>

      <section className="about-section" aria-labelledby="about-why">
        <h2 className="t-h2" id="about-why">Why it exists</h2>
        <Rows rows={WHY} />
      </section>

      <section className="about-section" aria-labelledby="about-stack">
        <h2 className="t-h2" id="about-stack">How it is built</h2>
        <Rows rows={STACK} />
      </section>

      <section className="about-section" aria-labelledby="about-author">
        <h2 className="t-h2" id="about-author">Author</h2>
        <div className="author-card">
          <div className="author-photo" role="img" aria-label="Photo to be added">Photo TBA</div>
          <div>
            <p className="author-name">An Nguyen</p>
            <p className="author-role">Role and school: TBA</p>
            <p className="author-bio">Short bio: TBA</p>
            <dl className="author-links">
              <div><dt>Code</dt><dd><a href={REPO}>github.com/aansensei/macro-event-lab</a></dd></div>
              <div><dt>Portfolio</dt><dd className="tba">TBA</dd></div>
              <div><dt>LinkedIn</dt><dd className="tba">TBA</dd></div>
              <div><dt>Email</dt><dd className="tba">TBA</dd></div>
            </dl>
          </div>
        </div>
        <p className="about-note">
          Found a mistake or have a question? Open an issue on <a href={`${REPO}/issues`}>GitHub</a>.
        </p>
      </section>

      <section className="about-section" aria-labelledby="about-faq">
        <h2 className="t-h2" id="about-faq">FAQ</h2>
        <div className="faq-list">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <details className="disclaimer">
        <summary>Disclaimer</summary>
        <div className="disclaimer-body">
          <p>Macro Event Lab is a personal research and learning project built by one person. It is not a product, a data service or a financial publication.</p>
          <p>It can contain mistakes. Data can be missing, delayed or wrong, and the methods used to turn market prices into probabilities rest on assumptions that may not hold. Please check anything important against the original sources.</p>
          <p>Nothing on this site is investment, trading, financial, legal or tax advice, and nothing here is an offer or a recommendation to buy or sell anything. Past market expectations do not predict future results.</p>
          <p>The site is not affiliated with, endorsed by or sponsored by Kalshi, the Federal Reserve, the Federal Reserve Bank of St. Louis, the Bureau of Labor Statistics or the Bureau of Economic Analysis. Their names are used only to identify where the data comes from, and their data stays subject to their own terms.</p>
          <p>Everything here is provided as is, without any warranty. The author accepts no responsibility for any loss or decision that results from using this site or its data.</p>
        </div>
      </details>
    </article>
  );
}
