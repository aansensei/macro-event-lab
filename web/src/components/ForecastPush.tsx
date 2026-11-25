import { useState } from "react";
import type { LiveForecastRow } from "../data/arena";
import { featureName } from "../lib/featureNames";
import { HowToRead } from "./HowToRead";

export function ForecastPush({ row, unit }: { row: LiveForecastRow; unit: string }) {
  const [selected, setSelected] = useState("ridge");
  const ids = ["ridge", "lasso"].filter((id) => row.contributions?.[id]);
  const id = ids.includes(selected) ? selected : ids[0];
  const parts = id ? row.contributions?.[id] : undefined;
  if (!parts) return null;
  const ordered = [...parts.terms].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const bars = [{ feature: "Baseline", value: parts.baseline }, ...ordered.slice(0, 6).map((term) => ({ ...term, feature: featureName(term.feature) }))];
  if (ordered.length > 6) bars.push({ feature: "Other indicators", value: ordered.slice(6).reduce((sum, term) => sum + term.value, 0) });
  const scale = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1e-12);
  const format = (value: number) => value.toFixed(row.target === "cpi" ? 3 : 2);
  const total = parts.baseline + parts.terms.reduce((sum, term) => sum + term.value, 0);
  return <section className="forecast-push" aria-label="What pushes the forecast">
    <h4 className="release-odds-title">What pushes the forecast</h4>
    <p className="t-micro muted">The model's starting level and the indicators that move it. Units: {unit}.</p>
    <div className="release-odds-chips" role="group" aria-label="Forecast explanation model">
      {ids.map((model) => <button key={model} type="button" className="release-odds-chip" aria-pressed={model === id} onClick={() => setSelected(model)}>{model === "ridge" ? "Ridge" : "LASSO"}</button>)}
    </div>
    <ul className="forecast-push-bars">{bars.map((bar) => <li key={bar.feature}>
      <div className="forecast-push-label"><span>{bar.feature}</span><span className="num">{format(bar.value)}</span></div>
      <svg viewBox="0 0 300 14" preserveAspectRatio="none" aria-hidden="true">
        <line x1="150" x2="150" y1="0" y2="14" stroke="var(--border-control)" />
        <rect x={bar.value < 0 ? 150 - Math.abs(bar.value) / scale * 146 : 150} y="3" height="8" rx="2" width={Math.abs(bar.value) / scale * 146} fill={bar.value < 0 ? "var(--text-muted)" : "var(--accent)"} />
      </svg><span className="t-micro muted">{bar.feature === "Baseline" ? "Starting level" : bar.value < 0 ? "Lowers the forecast" : bar.value > 0 ? "Raises the forecast" : "No change"}</span>
    </li>)}</ul>
    <div className="forecast-push-total"><strong>Forecast</strong><span className="num">{format(row.values[id!] ?? total)} ({unit})</span></div>
    <p className="t-micro muted">Baseline plus the terms equals the forecast. Displayed values are rounded.</p>
    <HowToRead><p>The baseline is the fitted model's average starting level before today's indicators move it.</p>
      <p>Each bar is a coefficient times how unusual that indicator is today compared with its training history.</p>
      <p>This is a linear model's reading of correlations, not a cause. The figures change as indicators arrive.</p></HowToRead>
  </section>;
}
