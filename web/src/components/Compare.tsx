import { useEffect, useState } from "react";

import { loadSummary } from "../data/load";
import type { Summary } from "../data/types";
import { seriesFinding, verdict, type Verdict } from "../lib/compareWords";
import { fixed } from "../lib/format";
import { ols } from "../lib/stats";
import { CalibrationBars } from "./CalibrationBars";
import { SurpriseScatter } from "./SurpriseScatter";
import { Term } from "./Term";
import { StoryNext, StoryPath } from "./Story";

const VERDICT_LABEL: Record<Verdict, string> = {
  calibrated: "Well calibrated",
  overconfident: "A little overconfident",
  cautious: "A little cautious",
  "priced-in": "Priced in ahead",
  unknown: "Not enough data",
};

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; summary: Summary };

// every release side by side: how well markets judged their own uncertainty, and how yields answered surprises
export function Compare() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [series, setSeries] = useState("KXCPI");
  const [yieldKey, setYieldKey] = useState<"dgs2_bp" | "dgs10_bp">("dgs2_bp");

  useEffect(() => {
    loadSummary()
      .then((summary) => setLoad({ kind: "ready", summary }))
      .catch((err: Error) => setLoad({ kind: "error", message: err.message }));
  }, []);

  if (load.kind === "loading") return <p className="t-label page-fade">Loading the comparison</p>;
  if (load.kind === "error") {
    return (
      <div className="state-banner" role="alert">
        <h1 className="t-h3">The comparison could not be loaded</h1>
        <p>{load.message}</p>
      </div>
    );
  }

  const { summary } = load;
  const chosen = summary.series.find((s) => s.series === series) ?? summary.series[0];
  const points = summary.points.filter((p) => p.series === chosen?.series);
  const fit = ols(
    points.filter((p) => p[yieldKey] !== null).map((p) => [p.surprise_sd, p[yieldKey] as number]),
  );
  const biggest = [...summary.points]
    .sort((a, b) => Math.abs(b.surprise_sd) - Math.abs(a.surprise_sd))
    .slice(0, 8);
  const labelOf = (ticker: string) => summary.series.find((s) => s.series === ticker)?.label ?? ticker;

  return (
    <div className="compare-page page-fade">
      <StoryPath current="compare" />
      <h1 className="t-h1">Compare</h1>
      <p className="about-lead">
        Every release side by side: how well the market judged its own uncertainty, and how bond
        yields answered when the number surprised.
      </p>

      <section className="about-section" aria-labelledby="findings-title">
        <h2 className="t-h2" id="findings-title">What the data says</h2>
        <div className="findings">
          {summary.series.map((s) => (
            <article key={s.series} className="finding">
              <div className="finding-head">
                <span className="finding-label">{s.label}</span>
                <span className={`verdict verdict-${verdict(s)}`}>{VERDICT_LABEL[verdict(s)]}</span>
              </div>
              <p>{seriesFinding(s)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" aria-labelledby="calibration-title">
        <h2 className="t-h2" id="calibration-title"><Term id="calibration">Calibration</Term></h2>
        <p className="chart-summary">
          How often the real number landed inside the market's <Term id="range">50% and 90% ranges</Term>{" "}
          an hour before the release. The tick marks the ideal: a market that judges its own
          uncertainty well catches the number 50% and 90% of the time.
        </p>
        <CalibrationBars series={summary.series} />
      </section>

      <section className="about-section" aria-labelledby="scatter-title">
        <h2 className="t-h2" id="scatter-title">Surprises and the bond market</h2>
        <div className="chart-tools compare-tools">
          <div className="toggle-pair" role="group" aria-label="Release type">
            {summary.series.map((s) => (
              <button key={s.series} type="button" aria-pressed={chosen?.series === s.series} onClick={() => setSeries(s.series)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="toggle-pair" role="group" aria-label="Treasury yield">
            {(["dgs2_bp", "dgs10_bp"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={yieldKey === k} onClick={() => setYieldKey(k)}>
                {k === "dgs2_bp" ? "2-year" : "10-year"}
              </button>
            ))}
          </div>
        </div>
        <p className="chart-summary num">
          Each dot is one {chosen?.label} release: its <Term id="surprise">surprise</Term> across, and how
          far the {yieldKey === "dgs2_bp" ? "2-year" : "10-year"} <Term id="yield">Treasury yield</Term>{" "}
          moved that day up.
          {fit && ` The dashed line is the best straight fit: about ${fixed(fit.slope, 1)} bp per 1 SD of surprise, correlation ${fixed(fit.r, 2)}, over ${fit.n} releases.`}
          {" "}Select a dot to open that release.
        </p>
        <SurpriseScatter points={points} yieldKey={yieldKey} fit={fit} />
      </section>

      <section className="about-section" aria-labelledby="biggest-title">
        <h2 className="t-h2" id="biggest-title">Biggest surprises</h2>
        <ol className="biggest-list">
          {biggest.map((p) => (
            <li key={p.id}>
              <a href={`?event=${p.id}`}>{p.title}</a>
              <span className="muted"> {labelOf(p.series)}</span>
              <span className={`num ${p.surprise_sd > 0 ? "val-surprise-up" : "val-surprise-down"}`}>
                {" "}{p.surprise_sd > 0 ? "+" : "−"}{Math.abs(p.surprise_sd).toFixed(1)} SD
              </span>
            </li>
          ))}
        </ol>
      </section>
      <StoryNext current="compare" />
    </div>
  );
}
