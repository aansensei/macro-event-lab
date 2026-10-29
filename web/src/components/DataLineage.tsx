import { Fragment } from "react";

import { MINUS } from "../lib/format";

type Layer = "silver" | "gold" | "web";

interface Table {
  name: string;
  layer: Layer;
  holds: string;
}

interface Stage {
  tables: Table[];
  // the method that turns this stage's tables into the next stage
  method?: string;
}

const STAGES: Stage[] = [
  {
    tables: [
      { name: "kalshi_markets", layer: "silver", holds: "Each contract, its strike and how it settled" },
      { name: "kalshi_candles", layer: "silver", holds: "Hourly bid, ask and last trade" },
    ],
    method: "Mid when the spread is 10¢ or less, else the last trade",
  },
  {
    tables: [{ name: "contract_prices", layer: "gold", holds: "One usable price per contract per hour" }],
    method: "Latest price known at each hour, weighted isotonic fit",
  },
  {
    tables: [{ name: "implied_survival", layer: "gold", holds: "P(X > k) at every strike, every hour" }],
    method: "Differences between neighbouring strikes",
  },
  {
    tables: [{ name: "implied_bins", layer: "gold", holds: "Probability of each outcome range" }],
    method: "Spread over publishable values: mean, SD, percentiles",
  },
  {
    tables: [
      { name: "implied_stats", layer: "gold", holds: "What the market expected, hour by hour" },
      { name: "alfred_observations", layer: "silver", holds: "Every vintage and daily yield, with known_from" },
    ],
    method: `First print by period, (print ${MINUS} mean) / SD, release-day yield change`,
  },
  {
    tables: [{ name: "event_surprise", layer: "gold", holds: "One row per release: surprise, reaction, scores" }],
    method: "Calibration, yield slopes and scores across events, rounded to JSON",
  },
  {
    tables: [{ name: "manifest, events, summary", layer: "web", holds: "The files this website reads" }],
  },
];

// every table in the pipeline as a box, with the method that turns it into the next table written on the arrow
export function DataLineage() {
  return (
    <figure className="method-figure lineage-figure">
      <div className="t-label">From table to table</div>
      <ol className="lineage" aria-label="Tables in the pipeline, each followed by the method that produces the next">
        {STAGES.map((stage, i) => (
          <Fragment key={stage.tables[0]?.name}>
            <li className={`lineage-row${stage.tables.length > 1 ? " is-pair" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
              {stage.tables.map((t) => (
                <div key={t.name} className={`lineage-table layer-${t.layer}`}>
                  <span className="lineage-layer">{t.layer}</span>
                  <span className="lineage-name">
                    {t.name.split("_").map((part, j) => (
                      // long names may wrap after an underscore instead of inside a word
                      <Fragment key={j}>{j > 0 && <>_<wbr /></>}{part}</Fragment>
                    ))}
                  </span>
                  <span className="lineage-holds">{t.holds}</span>
                </div>
              ))}
            </li>
            {stage.method && (
              <li className="lineage-step" style={{ animationDelay: `${i * 60 + 30}ms` }}>
                <span className="lineage-line" aria-hidden="true" />
                <span className="lineage-method">{stage.method}</span>
                <span className="lineage-line is-end" aria-hidden="true" />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
      <figcaption className="flow-caption">
        Silver tables are cleaned copies of the raw downloads, gold tables hold the analysis, and every table is
        rebuilt only from the ones above it.
      </figcaption>
    </figure>
  );
}
