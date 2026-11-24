export function ArenaIntro({ informationDate }: { informationDate: string }) {
  return <header className="arena-intro">
    <p className="section-kicker">Forecast arena</p>
    <h1 className="t-h1">How do forecasts compare with first-published numbers?</h1>
    <p className="about-lead">Forecasts are evaluated against each economic number as first published. The tables report forecast errors, available uncertainty intervals and the number of periods evaluated.</p>
    <p className="muted">Information cutoff: <time dateTime={informationDate}>{informationDate}</time>.</p>
  </header>;
}
