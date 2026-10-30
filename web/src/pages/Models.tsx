import { useEffect, useState } from "react";
import { loadNowcast, nowcastErrors, type Nowcast } from "../data/nowcast";
import { ExternalLink } from "../components/ExternalLink";
import { NowcastChart } from "../components/NowcastChart";

const LABELS: Record<string, string> = { INDPRO: "Industrial production", PCEC96: "Real consumer spending",
  RRSFS: "Real retail sales", HOUST: "Housing starts", PAYEMS: "Payroll employment",
  UNRATE: "Unemployment rate", GDP_PREV: "Previous GDP growth" };

export function Models() {
  const [data, setData] = useState<Nowcast | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadNowcast().then((value) => { if (active) setData(value); })
      .catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  const errors = data && nowcastErrors(data.points);
  return <div className="models-page page-fade">
    <p className="section-kicker">Supplementary research</p><h1 className="t-h1">Reading GDP before release day</h1>
    <p className="t-label muted">A separate ALFRED study. The main market-expectations story starts on <a href="?page=events">Events</a>.</p>
    <p className="about-lead">A simple model uses the economic numbers already published to estimate the first GDP release.</p>
    <p className="muted">Data source: <ExternalLink href="https://alfred.stlouisfed.org/">ALFRED, Federal Reserve Bank of St. Louis</ExternalLink>. This page uses official economic data only.</p>
    {error && <p role="alert">The nowcast could not be loaded: {error}</p>}
    {!data && !error && <p role="status">Loading the GDP model</p>}
    {data && <>
      <section className="about-section" aria-labelledby="model-performance">
        <h2 className="t-h3" id="model-performance">Forecast versus first print</h2>
        <p>Every dashed point is a forecast made from vintages available by the day before the advance release. The solid line is what was first published.</p>
        {errors && <p className="model-readout">Across <strong>{errors.n} quarters</strong>, the model's forecast error (RMSE) was <strong>{errors.model.toFixed(2)} percentage points</strong>, compared with <strong>{errors.naive.toFixed(2)}</strong> for repeating the previous first print.</p>}
        <p className="t-micro muted">RMSE is the square root of the average squared error. Both scores use the same quarters, including the pandemic collapse and rebound.</p>
        <NowcastChart points={data.points} />
        <details className="model-data"><summary>Show forecast data</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="GDP forecast data">
          <table><caption>GDP growth, annualized percent</caption><thead><tr><th scope="col">Quarter</th><th scope="col">Data cutoff</th><th scope="col">Nowcast</th><th scope="col">First print</th></tr></thead>
            <tbody>{data.points.map((p) => <tr key={p.reference_period}><th scope="row">{p.reference_period}</th><td>{p.as_of}</td><td>{p.nowcast.toFixed(2)}</td><td>{p.first_print.toFixed(2)}</td></tr>)}</tbody></table>
        </div></details>
      </section>
      <section className="about-section" aria-labelledby="model-coefficients"><h2 className="t-h3" id="model-coefficients">What the model listens to</h2>
        <p>Each coefficient describes the change in predicted GDP growth for a one standard deviation move in an indicator, holding the others fixed. An interval crossing zero leaves the direction uncertain.</p>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="GDP model coefficients"><table>
          <caption>Percentage points per original sample standard deviation</caption>
          <thead><tr><th scope="col">Indicator</th><th scope="col">Coefficient</th><th scope="col">95% interval</th></tr></thead>
          <tbody>{data.coefficients.map((c) => <tr key={c.feature}><th scope="row">{LABELS[c.feature] ?? c.feature}</th><td>{c.coef.toFixed(2)}</td><td>{c.lo.toFixed(2)} to {c.hi.toFixed(2)}</td></tr>)}</tbody>
        </table></div>
        <p className="t-micro muted">Coefficients exclude 2020 Q2 and Q3. Block bootstrap intervals condition on the chosen penalty and exclusions. They describe associations, not causal effects.</p>
      </section>
    </>}
    <section className="about-section"><h2 className="t-h3">How it works, in plain words</h2>
      <p>Monthly figures describe jobs, production, spending, retail sales, housing and unemployment. The model combines their quarterly changes with the previous quarter's GDP. If a month was not yet published, it uses only the months available at that time.</p>
      <p>Ridge regression keeps individual indicators from receiving extreme weights. For each forecast, the model learns from earlier releases only. It chooses how much to shrink the weights by testing on earlier quarters inside that training period.</p>
      <p>The model is a historical evaluation, not a live forecast or a causal explanation. A missing month can change what the quarterly average represents. Pandemic observations also make error measures much larger.</p>
    </section>
  </div>;
}
