import { DataLineage } from "../components/DataLineage";
import { PUBLIC_EDITION } from "../lib/edition";
import { ResearchMethod } from "./ResearchMethod";

export function Method() {
  if (!PUBLIC_EDITION) return <ResearchMethod />;
  return <div className="method-layout page-fade">
    <article className="method-article">
      <h1 className="t-h1">Method</h1>
      <p className="about-lead">How official economic numbers are saved, matched in time and checked.</p>
      <p>The public edition reads ALFRED vintages and FRED release calendars. Revisions and the GDP nowcast
        use only official economic observations. The forecast arena adds the Survey of Professional Forecasters and
        several models, and its results are preliminary until every contestant has run.</p>
      <DataLineage />
      <h2 className="t-h2">First prints and later revisions</h2>
      <p>The first print is the earliest published value for a period. Revisions arrive later and are shown
        separately. Monthly CPI uses month-over-month growth, payrolls use the change in employment,
        and GDP uses annualized quarterly growth. Both levels of each change come from the same vintage.</p>
      <h2 className="t-h2">Only information already published</h2>
      <p>Every observation carries a known_from timestamp. When a vintage date matches the release calendar,
        the timestamp uses the official release moment. Otherwise it uses the end of that day in New York,
        so a value is never treated as available early. As-of joins exclude information after the cutoff.</p>
      <h2 className="t-h2">Forecasts against first prints</h2>
      <p>The GDP nowcast trains on earlier releases and is evaluated against first-published GDP.
        The previous first print supplies a naive comparison. Model selection takes place within the
        earlier training periods. Missing observations remain visible rather than being invented.</p>
      <h2 className="t-h2">An auditable pipeline</h2>
      <p>Source responses are saved before parsing. Typed tables, duplicate checks, publication timestamps
        and tests support reproducible exports. A property test checks that point-in-time queries never
        return observations published after the requested moment.</p>
      <p>Sources: ALFRED vintages and FRED release calendars, Federal Reserve Bank of St. Louis.</p>
    </article>
  </div>;
}
