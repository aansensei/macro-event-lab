export const GUIDE = [
  ["Choose a release", "Open Events and pick a CPI, jobs, GDP or Fed release. On a phone, use the two dropdowns at the top."],
  ["Get the story first", "Start with In plain words. It explains expectations, the first print, the surprise and the day's Treasury yield move."],
  ["Rewind expectations", "Drag the time slider, choose a preset or press Play. Watch the odds change hour by hour before the release."],
  ["Put it in perspective", "Compare looks across releases. Scorecard checks forecast quality. Revisions shows how the official answer changed later."],
] as const;

export function SiteGuide() {
  return <section className="overview-guide" id="overview-guide" aria-labelledby="guide-title">
    <div className="guide-heading"><p className="section-kicker">Your way into the data</p>
      <h2 className="t-h2" id="guide-title">Start with one release.<br />Follow the questions.</h2>
      <p className="muted">You do not need an economics background. Begin with the explanation, then go deeper at your own pace.</p>
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
