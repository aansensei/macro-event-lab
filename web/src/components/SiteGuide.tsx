export const GUIDE = [
  ["Choose a release", "Open Events and pick CPI, jobs, GDP or a Fed decision."],
  ["Get the story first", "In plain words explains the expectation, first print, surprise and yield move."],
  ["Rewind expectations", "Move the time slider or press Play to follow the changing odds."],
  ["See the wider pattern", "Continue to Compare, Scorecard and Revisions when you want more context."],
] as const;

export function SiteGuide() {
  return <section className="overview-guide" id="overview-guide" aria-labelledby="guide-title">
    <div className="guide-heading"><p className="section-kicker">Your way into the data</p>
      <h2 className="t-h2" id="guide-title">Go at your own pace.</h2>
      <p className="muted">Every event begins with a plain-language reading. The charts and methods are there when you want to go deeper.</p>
      <a href="?page=events" className="overview-link">Pick a release</a>
    </div>
    <ol className="guide-steps">{GUIDE.map(([title, text], i) => <li key={title} style={{ animationDelay: `${i * 60}ms` }}>
      <span className="guide-number" aria-hidden="true">0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div>
    </li>)}</ol>
    <details className="guide-tools"><summary>A few useful controls</summary>
      <div><p><strong>Inspect a chart.</strong> Hover or tap a bar for exact odds. Press Escape to clear a pinned value. The outcome and threshold charts include tables and reading notes.</p>
        <p><strong>Look up a term.</strong> Dotted terms show a short meaning on hover or focus and link to the <a href="?page=glossary">Glossary</a>.</p>
        <p><strong>Share a moment.</strong> On Events, the address includes the release and selected hour. Copy it to share the same view.</p></div>
    </details>
  </section>;
}
