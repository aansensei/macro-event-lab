import { MINUS } from "../lib/format";
import { DataLineage } from "./DataLineage";

function Code({ children }: { children: string }) {
  return <span className="mono">{children}</span>;
}

// the selected hour sees only snapshots before it; the first print arrives at release and later revisions are never used
function TimelineDiagram() {
  return (
    <figure className="method-figure" aria-label="Point in time timeline">
      <div className="t-label">What a chosen hour can see</div>
      <div className="method-diagram-wrap">
      <svg viewBox="0 0 580 130" className="method-diagram" role="img" aria-label="Timeline from seven days before the close to a later revision">
        <line x1="30" y1="55" x2="550" y2="55" stroke="var(--border-control)" strokeWidth="1.5" />
        <rect x="60" y="49" width="150" height="12" fill="var(--band-50)" />
        <circle cx="60" cy="55" r="4" fill="var(--market)" />
        <text x="60" y="38" textAnchor="middle" fontSize="12" fill="var(--text)">T{MINUS}168h</text>
        <line x1="210" y1="20" x2="210" y2="95" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="210" cy="55" r="5" fill="var(--accent)" />
        <text x="210" y="15" textAnchor="middle" fontSize="12" fontWeight="500" fill="var(--accent)">Selected hour (as_of)</text>
        <text x="135" y="80" textAnchor="middle" fontSize="12" fill="var(--text-muted)">visible snapshots</text>
        <circle cx="370" cy="55" r="5" fill="var(--actual)" />
        <text x="370" y="38" textAnchor="middle" fontSize="12" fontWeight="500" fill="var(--actual)">Release: first print</text>
        <text x="370" y="80" textAnchor="middle" fontSize="12" fill="var(--text-muted)">used for the surprise</text>
        <circle cx="510" cy="55" r="5" fill="var(--bg)" stroke="var(--ghost)" strokeWidth="2" strokeDasharray="2 2" />
        <text x="510" y="38" textAnchor="middle" fontSize="12" fill="var(--text-muted)">Later revision</text>
        <text x="510" y="80" textAnchor="middle" fontSize="12" fill="var(--text-muted)">never used</text>
      </svg>
      </div>
    </figure>
  );
}

export function Method() {
  return (
    <div className="method-layout page-fade">
      <article className="method-article">
        <h1 className="t-h1">Method</h1>
        <p className="about-lead">
          How market prices become probabilities, how every number is tied to the moment it became
          public, and how the surprise is measured.
        </p>
        <p>
          Macro Event Lab builds an hourly, point-in-time record of what prediction markets expected in
          the 7 days before each US CPI, jobs, GDP and Fed release, and pairs it with the number first
          published on release day.
        </p>

        <DataLineage />

        <h2 className="t-h2">1. From contract prices to a probability curve</h2>
        <p>
          Kalshi lists binary contracts of the form "CPI month over month above <Code>k</Code>%" for a
          ladder of strikes <Code>k_1 &lt; k_2 &lt; ... &lt; k_m</Code>. Each hourly candle gives one
          usable price per contract: the bid/ask mid when the book is not crossed and the spread is at
          most 10 cents, otherwise the last trade, otherwise none.
        </p>
        <p>
          At each hourly snapshot <Code>t</Code>, a contract takes the latest usable price known at{" "}
          <Code>t</Code>, never a later one. A contract that pays 1 when the number is above{" "}
          <Code>k_i</Code> prices the survival function <Code>S(k_i) = P(X &gt; k_i)</Code>, and each
          outcome bin is the difference of two neighbouring strikes:
        </p>
        <pre className="code-block">{`P(k_{i-1} < X <= k_i) = S(k_{i-1}) ${MINUS} S(k_i)`}</pre>

        <h2 className="t-h2">2. Making the curve consistent</h2>
        <p>
          Raw prices sometimes rise with the strike, which no probability can do. A weighted isotonic
          regression (pool adjacent violators) finds the closest curve with{" "}
          <Code>S(k_1) &gt;= S(k_2) &gt;= ... &gt;= S(k_m)</Code>, weighting each price by the inverse
          of its spread, so one stale or wide quote barely moves its neighbours. Bins are differences of
          the fitted curve, with <Code>{`P(X <= k_1) = 1 ${MINUS} S(k_1)`}</Code> and{" "}
          <Code>P(X &gt; k_m) = S(k_m)</Code>, so they are never negative and sum to 1 by construction.
          The threshold chart shows both the raw prices and the fitted curve.
        </p>

        <TimelineDiagram />

        <h2 className="t-h2">3. Mean, spread, percentiles and surprise</h2>
        <p>
          Each bin <Code>(a, b]</Code> holds the values that can actually be published in it, so its
          probability is spread evenly over <Code>(a + r/2, b + r/2]</Code>, where <Code>r</Code> is the
          publication step: 0.1 point for CPI and GDP, 0.25 for the Fed rate, 1,000 jobs for payrolls. A
          CPI bin (0.3, 0.4] therefore centres on 0.4, the only value it can print. The open tails are
          taken as wide as the median gap between strikes. The mean and standard deviation follow from
          these intervals, and the 5th to 95th percentiles interpolate within them.
        </p>
        <p>
          The first print comes from ALFRED, converted to the unit Kalshi settles on (CPI month over
          month %, payroll jobs added, GDP annualized growth) using both levels from the vintage of
          release day. Fed events use Kalshi's settled value; when Kalshi stores it as text, it is read
          from which strikes resolved yes and which resolved no. The surprise compares the first print
          with the last snapshot before the close:
        </p>
        <pre className="code-block">{`Surprise (SD) = (first print ${MINUS} mean at T${MINUS}1h) / SD at T${MINUS}1h`}</pre>

        <h2 className="t-h2">4. Point in time and data sources</h2>
        <p>
          Official numbers are revised for months or years. Judging expectations against revised data
          uses information nobody had on release day. Every ALFRED vintage therefore carries{" "}
          <Code>known_from</Code>: the official release moment (08:30 ET for CPI, jobs and GDP; 14:00
          ET for FOMC statements) when its date matches the release calendar, otherwise the end of that
          day in New York, so nothing is ever treated as known earlier than it was. A property test
          checks that a query as of any moment never returns data published after it.
        </p>
        <p>
          Data sources: Kalshi market data for <Code>KXCPI</Code>, <Code>KXPAYROLLS</Code>,{" "}
          <Code>KXGDP</Code> and <Code>KXFED</Code>, including their older markets for the same
          releases; ALFRED vintages from the Federal Reserve Bank of St. Louis (<Code>CPIAUCSL</Code>,{" "}
          <Code>PAYEMS</Code>, <Code>GDPC1</Code> among others); FRED release calendars and the Federal
          Reserve FOMC calendar. Treasury yields and sector ETFs are planned.
        </p>
      </article>

      <aside className="method-notes" aria-label="Notes">
        <div className="sidenote-box">
          <strong>What T{MINUS}1h means.</strong> CPI, jobs and GDP markets close at 08:25 or 08:29 ET,
          just before the 08:30 release. Snapshots are taken on the hour, counted back from the hour of
          the close, so T{MINUS}1h is 07:00 ET on release day.
        </div>
        <div className="sidenote-box">
          <strong>FOMC outcomes.</strong> Fed contracts ask whether the upper bound of the target range
          will be above <Code>k</Code>. With strikes 0.25 point apart, each bin is exactly one possible
          rate, so the page follows each rate as its own line over time instead of a continuous fan.
        </div>
        <div className="sidenote-box">
          <strong>Government shutdowns.</strong> Each event is matched to the period its ticker names,
          so a release pushed back by weeks (September 2025 jobs, Q3 2025 GDP) still finds its market. A
          release that never came out (October 2025 CPI) keeps its market snapshots, with the first
          print and surprise left empty.
        </div>
      </aside>
    </div>
  );
}
