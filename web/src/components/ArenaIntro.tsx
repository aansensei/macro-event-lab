const PLANNED_CONTESTANTS = 8;

interface Props {
  informationDate: string;
  contestantIds: string[];
}

export function ArenaIntro({ informationDate, contestantIds }: Props) {
  const isPreliminary = contestantIds.length < PLANNED_CONTESTANTS;
  return <header className="arena-intro">
    <p className="section-kicker">Forecast arena</p>
    <h1 className="t-h1">How do forecasts compare with first-published numbers?</h1>
    <p className="about-lead">Forecasts are evaluated against each economic number as first published. The tables report forecast errors, available uncertainty intervals and the number of periods evaluated.</p>
    {isPreliminary && <p className="state-banner" role="note">
      Preliminary results. {contestantIds.length} of the {PLANNED_CONTESTANTS} planned contestants have run so far, and the numbers are still being checked independently. Read them as a first look, not as a final ranking.
    </p>}
    <p className="muted">Information cutoff: <time dateTime={informationDate}>{informationDate}</time>.</p>
    {contestantIds.includes("spf") && <p className="muted">
      Professional forecasts: Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF). Used for non-commercial education and research. This site is independent and is not sponsored, endorsed or approved by the Federal Reserve Bank of Philadelphia.
    </p>}
  </header>;
}
