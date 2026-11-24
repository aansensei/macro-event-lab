export function StatusIntro({ generatedAt, informationDate }: { generatedAt: string; informationDate: string }) {
  return <header className="status-intro" id="status-top">
    <p className="section-kicker">Data status</p>
    <h1 className="t-h1">Data freshness and quality checks</h1>
    <p className="about-lead">Source update dates and the checks available in this build.</p>
    <p className="muted">Built <time dateTime={generatedAt}>{generatedAt.slice(0, 10)} at {generatedAt.slice(11, 19)} UTC</time>.
      {" "}Information cutoff: <time dateTime={informationDate}>{informationDate}</time>.</p>
  </header>;
}
