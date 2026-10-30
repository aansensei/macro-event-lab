import { useEffect, useState } from "react";

import { loadSummary } from "../data/load";
import type { SeriesSummary, Summary } from "../data/types";
import { missSize, scoreFinding } from "../lib/scoreWords";
import { CountUp } from "../components/CountUp";
import { PitHistogram } from "../components/PitHistogram";
import { Term } from "../components/Term";
import { StoryNext, StoryPath } from "../components/Story";

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; summary: Summary };

function SkillBadge({ skill }: { skill: number | null }) {
  if (skill === null) return <span className="verdict">No benchmark</span>;
  const pct = Math.round(Math.abs(skill) * 100);
  return skill > 0
    ? <span className="verdict verdict-calibrated">Beats the naive guess by {pct}%</span>
    : <span className="verdict verdict-overconfident">Naive guess does as well</span>;
}

function SeriesCard({ s }: { s: SeriesSummary }) {
  const sc = s.scores;
  if (!sc) return null;
  return (
    <article className="score-card">
      <div className="finding-head">
        <span className="finding-label">{s.label}</span>
        <SkillBadge skill={sc.skill} />
      </div>
      <dl className="score-metrics">
        <div>
          <dt><Term id="brier">Brier</Term></dt>
          <dd className="num">{sc.brier === null ? "n/a" : <CountUp value={sc.brier} format={(v) => v.toFixed(3)} />}</dd>
        </div>
        <div>
          <dt><Term id="crps">CRPS</Term></dt>
          <dd className="num">{sc.crps === null ? "n/a" : <CountUp value={sc.crps} format={(v) => missSize(s.series, v)} />}</dd>
        </div>
        <div>
          <dt>Market miss</dt>
          <dd className="num">{sc.mae_market === null ? "n/a" : <CountUp value={sc.mae_market} format={(v) => missSize(s.series, v)} />}</dd>
        </div>
        <div>
          <dt>Naive miss</dt>
          <dd className="num">{sc.mae_naive === null ? "n/a" : <CountUp value={sc.mae_naive} format={(v) => missSize(s.series, v)} />}</dd>
        </div>
      </dl>
      <p>{scoreFinding(s.series, s.label, sc)}</p>
      <div className="score-pit">
        <div className="section-kicker">Where the real number landed (<Term id="pit">PIT</Term>)</div>
        <PitHistogram hist={sc.pit_hist} label={s.label} />
      </div>
      <p className="t-micro muted">Scored over {sc.n} releases at T&#8722;1h.</p>
    </article>
  );
}

// how good the market's forecasts were, scored the way forecasters are scored
export function Scorecard() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    loadSummary()
      .then((summary) => setLoad({ kind: "ready", summary }))
      .catch((err: Error) => setLoad({ kind: "error", message: err.message }));
  }, []);

  if (load.kind === "loading") return <p className="t-label page-fade">Loading the scorecard</p>;
  if (load.kind === "error") {
    return (
      <div className="state-banner" role="alert">
        <h1 className="t-h3">The scorecard could not be loaded</h1>
        <p>{load.message}</p>
      </div>
    );
  }

  const scored = load.summary.series.filter((s) => s.scores);
  return (
    <div className="compare-page page-fade">
      <StoryPath current="scorecard" />
      <h1 className="t-h1">Scorecard</h1>
      <p className="about-lead">
        How good were the market's forecasts an hour before each release? Scored with the tools
        professional forecasters use, and against the simplest guess: repeating the last number.
      </p>
      {scored.length === 0 ? (
        <p className="state-banner">Scores appear once the pipeline has scored the releases.</p>
      ) : (
        <div className="score-grid">
          {scored.map((s) => <SeriesCard key={s.series} s={s} />)}
        </div>
      )}
      <details className="how-to-read scorecard-how">
        <summary>How to read the scores</summary>
        <p>
          Brier and CRPS score the whole set of odds; lower is better. The market and naive misses
          compare single numbers: the market's median against simply repeating the previous
          release. The PIT chart shows where each real number landed within the market's odds; the
          dashed line is where a perfectly calibrated market would sit, so bars piled at the two
          ends mean the market was too confident, and a hump in the middle means it was too cautious.
        </p>
      </details>
      <StoryNext current="scorecard" />
    </div>
  );
}
