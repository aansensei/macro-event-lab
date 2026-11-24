import { useState } from "react";

import { CheckFilter } from "../components/CheckFilter";
import { PageGuide } from "../components/PageGuide";
import { RailPage, type RailSection } from "../components/SectionRail";
import { QualityCheckList } from "../components/QualityCheckList";
import { ResourceError } from "../components/ResourceError";
import { SourceFreshnessTable } from "../components/SourceFreshnessTable";
import { StatusIntro } from "../components/StatusIntro";
import { StatusSummary } from "../components/StatusSummary";
import { loadStatus } from "../data/status";
import { useResource } from "../hooks/useResource";
import { checkCounts, type CheckSelection } from "../lib/statusStats";

const RAIL: RailSection[] = [
  { id: "status-top", label: "Top" },
  { id: "status-sources", label: "Data sources" },
  { id: "status-checks", label: "Quality checks" },
  { id: "status-guide", label: "What this means" },
];

export function Status() {
  const { state, retry } = useResource(loadStatus);
  const [selection, setSelection] = useState<CheckSelection>("all");
  if (state.kind !== "ready") return <div className="status-page page-fade">
    <p className="section-kicker">Data status</p><h1 className="t-h1">Data freshness and quality checks</h1>
    {state.kind === "loading" ? <p className="state-banner" role="status">Loading data status.</p>
      : <ResourceError title={state.message.startsWith("Unsupported") ? "Unsupported data format" : "Data status could not be loaded"} message={state.message} onRetry={retry} />}
  </div>;
  const data = state.data;
  return <RailPage sections={RAIL}><div className="status-page page-fade">
    <StatusIntro generatedAt={data.generated_at} informationDate={data.information_date} />
    <PageGuide
      purpose="Check that the data behind every other page is fresh and passes the checks listed here."
      lookAt="The summary first, then the age of each source against its limit, then any check marked as a warning or a failure."
      limit="Whether every number is correct. It reports freshness and the listed rules only." />
    <StatusSummary sources={data.sources} checks={data.checks} />
    <SourceFreshnessTable sources={data.sources} informationDate={data.information_date} />
    <section className="status-section" aria-labelledby="status-checks">
      <h2 id="status-checks" className="t-h3">Quality checks</h2>
      <p className="muted">Duplicate and missing-observation checks are shown when their source tables exist. Survey records and publication dates are checked when survey data are available. Skipped checks are not listed.</p>
      <CheckFilter selection={selection} counts={checkCounts(data.checks)} onChange={setSelection} />
      <QualityCheckList checks={data.checks} selection={selection} />
    </section>
    <section className="status-section" aria-labelledby="status-guide">
      <h2 id="status-guide" className="t-h3">What this means</h2>
      <p>A fresh source is within its stated calendar-day threshold. A warning needs inspection; a failed check identifies a rule violation. Passing the listed checks does not guarantee complete data or accurate forecasts.</p>
      {data.sources.some((source) => source.id === "spf") && <p className="muted">Survey source: Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF). Used for non-commercial research. The Bank does not endorse this project or its conclusions.</p>}
    </section>
  </div></RailPage>;
}
