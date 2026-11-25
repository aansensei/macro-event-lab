interface Props {
  informationDate: string;
  contestantIds: string[];
  perTarget?: { label: string; count: number }[];
}

export function ArenaIntro({ informationDate, contestantIds, perTarget = [] }: Props) {
  return <header className="arena-intro" id="arena-top">
    <p className="section-kicker">Forecast arena</p>
    <h1 className="t-h1">How do forecasts compare with first-published numbers?</h1>
    <p className="about-lead">Forecasts are evaluated against each economic number as first published. The tables report forecast errors, available uncertainty intervals and the number of periods evaluated.</p>
    <p className="state-banner" role="note">
      Results describe the periods available so far and rank nobody.
      {perTarget.length > 0 && <> Contestants with a score so far: {perTarget.map((t) => `${t.label} ${t.count}`).join(", ")}.</>}
    </p>
    <p className="muted">Information cutoff: <time dateTime={informationDate}>{informationDate}</time>.</p>
    {contestantIds.includes("spf") && <p className="muted">
      Professional forecasts: Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF). Used for non-commercial education and research. This site is independent and is not sponsored, endorsed or approved by the Federal Reserve Bank of Philadelphia.
    </p>}
  </header>;
}
