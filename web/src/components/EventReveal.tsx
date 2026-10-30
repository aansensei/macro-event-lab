import { useState } from "react";

import { signed } from "../lib/format";
import type { releaseExamples } from "../lib/overview";
import { urlSearch, type RevealStage } from "../lib/url";

export function EventReveal({ examples }: { examples: ReturnType<typeof releaseExamples> }) {
  const [selected, setSelected] = useState(0);
  const [stage, setStage] = useState<RevealStage>(0);
  const example = examples[selected] ?? examples[0];
  if (!example) return <p className="muted">A release preview is not available in this dataset. Open Events to explore the available history.</p>;
  const { point } = example;
  const extent = Math.max(1, ...examples.map(({ point: p }) => Math.ceil(Math.abs(p.surprise_sd))));

  return <section className="event-reveal" aria-label="Uncover a real release">
    <div className="event-reveal-types" role="group" aria-label="Choose a release type">
      {examples.map(({ label, point: p }, i) => <button type="button" key={p.series}
        aria-pressed={example.point.series === p.series} onClick={() => { setSelected(i); setStage(0); }}>
        {label}
      </button>)}
    </div>
    <h2 className="t-h3">{point.title}</h2>
    <p className="event-snapshot">Extreme example. Snapshot: one hour before close.</p>
    <p className="event-phase"><span className="mono">0{stage + 1} / 03</span>
      {stage === 0 ? "Expectations" : stage === 1 ? "The first print" : "The day's yields"}</p>
    <div className="event-reveal-result" aria-live="polite" aria-atomic="true">
      {stage === 0 ? <>
        <h3>How far from expectations did the number land?</h3>
        <p className="event-number event-unrevealed" aria-hidden="true">?</p>
        <p className="event-result-note">Surprise is measured against the uncertainty traders priced in.</p>
      </> : stage === 1 ? <>
        <h3>The first print's surprise</h3>
        <p className="event-number num" key={point.id}>{signed(point.surprise_sd, 2)} <span>SD</span></p>
        <p className="event-result-note">{point.in_90 === null ? "The range comparison is unavailable."
          : point.in_90 ? "Inside the market's central 90% range." : "Outside the market's central 90% range."}</p>
      </> : <div className="event-yield-result">
        <h3>That day's yield change</h3>
        <dl><div><dt>2-year Treasury</dt><dd className="num">{signed(point.dgs2_bp!, 1)} <span>bp</span></dd></div>
          <div><dt>10-year Treasury</dt><dd className="num">{point.dgs10_bp === null ? "Unavailable" : signed(point.dgs10_bp, 1)}
            {point.dgs10_bp !== null && <span> bp</span>}</dd></div></dl>
        <p>Daily changes from FRED. Other news can also affect the day's move.</p>
      </div>}
    </div>
    <div className="event-reveal-actions">
      <button type="button" className="event-reveal-next" onClick={() => setStage(stage === 0 ? 1 : stage === 1 ? 2 : 0)}>
        {stage === 0 ? "Reveal the surprise" : stage === 1 ? "Show that day's yields" : "Start again"}
      </button>
      <a href={urlSearch(point.id, 1, stage)}>Open this release</a>
    </div>
    {stage > 0 && <div className="event-scale" role="img" aria-label={`First print: ${signed(point.surprise_sd, 2)} standard deviations from the market mean.`}>
      <div className="event-scale-line"><span className="event-mean" />
        {stage > 0 && <span className="event-actual" style={{ left: `${50 + point.surprise_sd / extent * 50}%` }} />}
      </div>
      <div className="event-scale-labels mono"><span>{signed(-extent, 0)} SD</span><span>0</span><span>{signed(extent, 0)} SD</span></div>
      <p className="event-scale-note">The dot is the first print. Zero is the market mean, in SD units.</p>
    </div>}
    <details className="event-example-note"><summary>About this example</summary>
      <p className="event-selection">Selected for the largest absolute surprise in this series with a recorded 2-year yield change.
        Sources: {point.series === "KXFED" ? "Kalshi and FRED" : "Kalshi, ALFRED and FRED"}.
        Surprise uses this release's own market standard deviation. Daily yield changes are not an intraday or causal estimate.</p>
    </details>
  </section>;
}
