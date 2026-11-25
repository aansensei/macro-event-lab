import { useState } from "react";

import { PageGuide } from "../components/PageGuide";
import { ReactionsScatter } from "../components/ReactionsScatter";
import { ResourceError } from "../components/ResourceError";
import { RailPage, type RailSection } from "../components/SectionRail";
import { TargetSwitch } from "../components/TargetSwitch";
import type { ArenaTarget, TargetId } from "../data/arena";
import {
  REACTIONS_NOT_BUILT,
  loadReactions,
  type ReactionRow,
  type ReactionSummary,
} from "../data/reactions";
import { useResource } from "../hooks/useResource";
import { formatIsoDate, signed } from "../lib/format";

const RAIL: RailSection[] = [
  { id: "reactions-top", label: "Top" },
  { id: "reactions-chart", label: "Scatter plot" },
  { id: "reactions-summary", label: "Summary" },
  { id: "reactions-releases", label: "Releases" },
];

const TARGET_META: readonly { id: TargetId; label: string; defaultUnit: string; frequency: "quarterly" | "monthly" }[] = [
  { id: "gdp", label: "GDP growth", defaultUnit: "annualized percent q/q", frequency: "quarterly" },
  { id: "cpi", label: "Inflation", defaultUnit: "percent m/m", frequency: "monthly" },
  { id: "payrolls", label: "Payrolls", defaultUnit: "thousands of jobs", frequency: "monthly" },
];

function formatNumber(value: number, digits = 2): string {
  return signed(value, digits);
}

function formatPValue(value: number | null): string {
  if (value === null) return "Not available";
  if (value === 0) return "less than 0.0001";
  return value.toFixed(4);
}

function formatCorrelation(value: number | null): string {
  return value === null ? "Not available" : signed(value, 2);
}

function SummaryTable({ summary, unit }: { summary: ReactionSummary; unit: string }) {
  const thinNote = summary.n < 10 ? " (fewer than 10 releases)" : "";
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Release reaction summary">
      <table className="reactions-summary-table">
        <caption className="sr-only">Summary statistics for release day yield moves</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Releases compared</th>
            <td className="num">{summary.n}</td>
          </tr>
          <tr>
            <th scope="row">10-year yield correlation</th>
            <td className="num">
              {formatCorrelation(summary.corr_10y)}
              {summary.corr_10y === null ? thinNote : ""}
            </td>
          </tr>
          <tr>
            <th scope="row">2-year yield correlation</th>
            <td className="num">
              {formatCorrelation(summary.corr_2y)}
              {summary.corr_2y === null ? thinNote : ""}
            </td>
          </tr>
          <tr>
            <th scope="row">10-year slope (bp per {unit})</th>
            <td className="num">
              {summary.slope_10y_bp_per_unit === null
                ? `Not available${thinNote}`
                : `${signed(summary.slope_10y_bp_per_unit, Math.abs(summary.slope_10y_bp_per_unit) > 0 && Math.abs(summary.slope_10y_bp_per_unit) < 0.1 ? 4 : 2)} bp per ${unit}`}
            </td>
          </tr>
          <tr>
            <th scope="row">Two sided p value (10-year slope)</th>
            <td className="num">
              {formatPValue(summary.p_10y)}
              {summary.p_10y === null ? thinNote : ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReleasesTable({ rows, unit }: { rows: ReactionRow[]; unit: string }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Release reactions table">
      <table className="arena-table reactions-table">
        <caption className="sr-only">Each release with its surprise and yield changes</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Release date</th>
            <th scope="col">First print ({unit})</th>
            <th scope="col">Benchmark ({unit})</th>
            <th scope="col">Surprise ({unit})</th>
            <th scope="col">10-year change (bp)</th>
            <th scope="col">2-year change (bp)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.period}>
              <th scope="row" className="num">{row.period}</th>
              <td data-label="Release date" className="num">{formatIsoDate(row.release_date)}</td>
              <td data-label={`First print (${unit})`} className="num">{formatNumber(row.first_print, 2)}</td>
              <td data-label={`Benchmark (${unit})`} className="num">
                {formatNumber(row.benchmark, 2)} ({row.benchmark_kind})
              </td>
              <td data-label={`Surprise (${unit})`} className="num">{signed(row.surprise, 2)}</td>
              <td data-label="10-year change (bp)" className="num">{signed(row.d10y_bp, 1)}</td>
              <td data-label="2-year change (bp)" className="num">{signed(row.d2y_bp, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Reactions() {
  const { state, retry } = useResource(loadReactions);
  const [targetId, setTargetId] = useState<TargetId>("gdp");
  const [yieldKey, setYieldKey] = useState<"d10y_bp" | "d2y_bp">("d10y_bp");

  if (state.kind !== "ready") {
    return (
      <div className="reactions-page page-fade">
        <p className="section-kicker">Reactions</p>
        <h1 className="t-h1">Do surprises move interest rates?</h1>
        {state.kind === "loading" ? (
          <p className="state-banner" role="status">Loading release reactions data.</p>
        ) : (
          <ResourceError
            title={
              state.message === REACTIONS_NOT_BUILT
                ? "Release reactions have not been built yet"
                : state.message.startsWith("Unsupported")
                  ? "Unsupported data format"
                  : "Release reactions could not be loaded"
            }
            message={state.message}
            onRetry={retry}
          />
        )}
      </div>
    );
  }

  const data = state.data;
  const targets: ArenaTarget[] = TARGET_META.map((meta) => ({
    id: meta.id,
    label: meta.label,
    unit: data.units[meta.id] ?? meta.defaultUnit,
    frequency: meta.frequency,
  }));
  const currentTarget = targets.find((target) => target.id === targetId) ?? targets[0]!;
  const rows = data.rows.filter((row) => row.target === currentTarget.id);
  const summary: ReactionSummary = data.summary.find((item) => item.target === currentTarget.id) ?? {
    target: currentTarget.id,
    n: rows.length,
    corr_2y: null,
    corr_10y: null,
    slope_10y_bp_per_unit: null,
    p_10y: null,
  };

  return (
    <RailPage sections={RAIL}>
      <div className="reactions-page page-fade">
        <header className="reactions-intro" id="reactions-top">
          <p className="section-kicker">Reactions</p>
          <h1 className="t-h1">Do surprises move interest rates?</h1>
          <p className="about-lead">
            On the day of each CPI, jobs and GDP release, how did the 2-year and 10-year Treasury yields move, and
            how did that move line up with the surprise against what forecasters and models expected?
          </p>
        </header>

        <PageGuide
          purpose="Compare first published macro surprises against same day changes in 2-year and 10-year Treasury yields."
          lookAt="The scatter plot for the chosen target, then the summary statistics, then the individual release rows below."
          limit="Cause or investment advice. There are few releases, other news hits on release day, no cause is shown, and nothing here is investment advice."
        />

        <TargetSwitch targets={targets} selected={currentTarget.id} onChange={setTargetId} />

        <section className="reactions-section" aria-labelledby="reactions-chart">
          <div className="reactions-chart-head">
            <h2 className="t-h3" id="reactions-chart">
              {currentTarget.label} surprise against Treasury yield change
            </h2>
            <div className="check-filter reactions-yield-switch" role="group" aria-label="Treasury yield">
              {(["d10y_bp", "d2y_bp"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={yieldKey === key}
                  onClick={() => setYieldKey(key)}
                >
                  {key === "d10y_bp" ? "10-year yield" : "2-year yield"}
                </button>
              ))}
            </div>
          </div>
          <ReactionsScatter
            rows={rows}
            unit={currentTarget.unit}
            targetLabel={currentTarget.label}
            yieldKey={yieldKey}
          />
        </section>

        <section className="reactions-section" aria-labelledby="reactions-summary">
          <h2 className="t-h3" id="reactions-summary">Summary for {currentTarget.label}</h2>
          <p className="muted">
            Correlations and least squares slopes are descriptive summaries only. Nothing here tests a trading rule or
            ranks any forecaster.
          </p>
          <SummaryTable summary={summary} unit={currentTarget.unit} />
        </section>

        {rows.length > 0 && (
          <section className="reactions-section" aria-labelledby="reactions-releases">
            <h2 className="t-h3" id="reactions-releases">Release table ({rows.length} releases)</h2>
            <ReleasesTable rows={rows} unit={currentTarget.unit} />
          </section>
        )}
      </div>
    </RailPage>
  );
}
