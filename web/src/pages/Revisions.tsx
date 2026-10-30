import { useEffect, useState } from "react";

import { loadRevisions } from "../data/load";
import type { Revisions as RevisionData, RevisionSeries } from "../data/types";
import { formatIsoDate, pct } from "../lib/format";
import { periodLabel, printValue, revisionFinding, revisionSize, signedSize } from "../lib/revisionWords";
import { CountUp } from "../components/CountUp";
import { ExternalLink } from "../components/ExternalLink";
import { RevisionChart } from "../components/RevisionChart";
import { Term } from "../components/Term";
import { StoryNext, StoryPath } from "../components/Story";

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: RevisionData };

// jobs open first: their revisions are the largest and the easiest to see
const DEFAULT_SERIES = "KXPAYROLLS";

function SeriesButton({ s, selected, onSelect }: { s: RevisionSeries; selected: boolean; onSelect: () => void }) {
  const share = s.mean_abs_revision !== null && s.mean_abs_first ? s.mean_abs_revision / s.mean_abs_first : null;
  return (
    <button type="button" className="rev-pick" aria-pressed={selected} onClick={onSelect}>
      <span className="rev-pick-label">{s.label}</span>
      <span className="rev-pick-value num">{s.mean_abs_revision === null ? "n/a" : revisionSize(s.unit, s.mean_abs_revision)}</span>
      <span className="rev-pick-sub">
        typical revision{share === null ? "" : `, ${Math.round(share * 100)}% of a typical print`}
      </span>
    </button>
  );
}

function SeriesDetail({ s, settledMonths }: { s: RevisionSeries; settledMonths: number }) {
  const since = s.points[0]?.period.slice(0, 4) ?? "";
  return (
    <section className="rev-detail" aria-labelledby="rev-detail-title">
      <h2 className="t-h2" id="rev-detail-title">{s.label}: how first prints changed</h2>
      <dl className="score-metrics rev-metrics">
        <div>
          <dt>Typical total revision</dt>
          <dd className="num">{s.mean_abs_revision === null ? "n/a" : <CountUp value={s.mean_abs_revision} format={(v) => revisionSize(s.unit, v)} />}</dd>
        </div>
        <div>
          <dt>By the next report</dt>
          <dd className="num">{s.mean_abs_next === null ? "n/a" : <CountUp value={s.mean_abs_next} format={(v) => revisionSize(s.unit, v)} />}</dd>
        </div>
        <div>
          <dt>Revised up</dt>
          <dd className="num val-surprise-up">{s.share_up === null ? "n/a" : <CountUp value={s.share_up} format={(v) => pct(v)} />}</dd>
        </div>
        <div>
          <dt>Revised down</dt>
          <dd className="num val-surprise-down">{s.share_down === null ? "n/a" : <CountUp value={s.share_down} format={(v) => pct(v)} />}</dd>
        </div>
      </dl>
      <p className="rev-finding">{revisionFinding(s, since)}</p>

      <figure className="chart-figure rev-figure" aria-labelledby="rev-chart-title">
        <div className="chart-header">
          <h3 className="t-h3" id="rev-chart-title">Today's number minus the first print</h3>
        </div>
        <p className="chart-summary">
          One bar per {s.series === "KXGDP" ? "quarter" : "month"} since {since}. Orange bars were revised up, rose bars
          down. Hover, tap or use the arrow keys to read a period.
        </p>
        <RevisionChart series={s.series} unit={s.unit} points={s.points} />
        <div className="chart-footer">
          <div className="chart-footer-top t-micro">
            <span>Source: <Term id="alfred">ALFRED</Term>, every vintage through {formatIsoDate(s.latest_vintage)}</span>
          </div>
          <details className="how-to-read">
            <summary>How to read this chart</summary>
            <p>
              Each bar compares the number in today's data with the number published on release day. Faded bars
              are less than {settledMonths} months old and can still be revised, so they are left out of the
              averages. The scale covers 98% of revisions; the few larger ones are cut at the edge and marked with a
              small triangle, and the line above the chart gives their full size.
            </p>
          </details>
        </div>
      </figure>

      {s.biggest.length > 0 && (
        <>
          <h3 className="t-h3">Biggest revisions</h3>
          <div className="data-table-wrap">
            <table className="data-table rev-table">
              <thead>
                <tr><th scope="col">Period</th><th scope="col">First print</th><th scope="col">Today</th><th scope="col">Revision</th></tr>
              </thead>
              <tbody>
                {s.biggest.map((b) => (
                  <tr key={b.period}>
                    <th scope="row">{periodLabel(s.series, b.period)}</th>
                    <td className="num">{printValue(s.unit, b.first)}</td>
                    <td className="num">{printValue(s.unit, b.latest)}</td>
                    <td className={`num ${b.latest > b.first ? "val-surprise-up" : "val-surprise-down"}`}>
                      {signedSize(s.unit, b.latest - b.first)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

// how much official numbers changed after release day, from ALFRED vintages alone
export function Revisions() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [selected, setSelected] = useState(DEFAULT_SERIES);

  useEffect(() => {
    loadRevisions()
      .then((data) => setLoad({ kind: "ready", data }))
      .catch((err: Error) => setLoad({ kind: "error", message: err.message }));
  }, []);

  if (load.kind === "loading") return <p className="t-label page-fade">Loading revisions</p>;
  if (load.kind === "error") {
    return (
      <div className="state-banner" role="alert">
        <h1 className="t-h3">Revisions could not be loaded</h1>
        <p>{load.message}</p>
      </div>
    );
  }

  const { series, settled_months: settledMonths } = load.data;
  const current = series.find((s) => s.series === selected) ?? series[0];
  return (
    <div className="compare-page page-fade">
      <StoryPath current="revisions" />
      <h1 className="t-h1">Revisions</h1>
      <p className="about-lead">
        The first number published is rarely the last word. How much did CPI, jobs and GDP numbers change after
        release day, and when did the changes arrive?
      </p>

      <div className="rev-picks" role="group" aria-label="Choose a release type">
        {series.map((s) => (
          <SeriesButton key={s.series} s={s} selected={s === current} onSelect={() => setSelected(s.series)} />
        ))}
      </div>

      {current && <SeriesDetail key={current.series} s={current} settledMonths={settledMonths} />}

      <aside className="rev-note">
        <strong>Why this matters here.</strong> Macro Event Lab judges every market against the{" "}
        <Term id="first-print">first print</Term>, because that is the number traders saw on release day. The
        revisions on this page arrive later and are never used for a surprise. All numbers come from{" "}
        <ExternalLink href="https://alfred.stlouisfed.org">ALFRED</ExternalLink>, which keeps every published
        version of each series.
      </aside>
      <StoryNext current="revisions" />
    </div>
  );
}
