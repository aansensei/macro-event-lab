import { useState } from "react";
import type { revisionHook } from "../lib/overview";

export function RevisionReveal({ example }: { example: NonNullable<ReturnType<typeof revisionHook>> }) {
  const [revealed, setRevealed] = useState(false);
  const period = new Date(`${example.period}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
  const number = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}`;
  return <figure className="revision-reveal">
    <figcaption><span className="section-kicker">One report. Two vintages.</span>
      <span className="reveal-period">US jobs, {period}</span></figcaption>
    <div className="reveal-first"><span className="t-label muted">First published</span>
      <strong className="reveal-number num">{number(example.first)}</strong></div>
    <div className={`reveal-latest${revealed ? " is-revealed" : ""}`} aria-live="polite" aria-atomic="true">
      <span className="t-label muted">{revealed ? "Latest vintage" : "What does the record say now?"}</span>
      {revealed ? <strong className="reveal-number num" key="answer">{number(example.latest)}</strong>
        : <span className="reveal-hidden" aria-hidden="true">?</span>}
    </div>
    <button className="reveal-button" aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>
      {revealed ? "Replay the reveal" : "Show the revision"}
    </button>
    <p className="reveal-caption">{revealed ? "Same month. A different number. Only the first was available on release day."
      : "The first number is only the first version. Reveal what came later."}</p>
    <p className="t-micro muted">Source: ALFRED. Latest vintage: {example.vintage}. Largest upward jobs revision among settled reports in this dataset.</p>
  </figure>;
}
