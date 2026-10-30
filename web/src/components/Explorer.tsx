import { useEffect, useMemo, useRef, useState } from "react";

import { loadEvent } from "../data/load";
import type { EventFile, ManifestEvent } from "../data/types";
import {
  binLabel,
  fixed,
  formatEt,
  formatValue,
  hourLabel,
  pct,
  signed,
  MINUS,
} from "../lib/format";
import {
  binIndexOf,
  daysClosedBefore,
  defaultHour,
  eventStatus,
  hourBounds,
  matchBins,
  modeIndex,
  releaseWhen,
  snapshotAt,
} from "../lib/snapshots";
import { oddsSeries } from "../lib/charts";
import { BinChart } from "./BinChart";
import { KeyStrip } from "./KeyStrip";
import { PlainWords } from "./PlainWords";
import { ReactionBlock } from "./ReactionBlock";
import { FanChart, OddsChart } from "./OverTimeChart";
import { ThresholdChart, type ThresholdMode } from "./ThresholdChart";
import { TimeControls } from "./TimeControls";
import { StoryNext } from "./Story";

const PLAY_STEP_HOURS = 4;
const PLAY_TICK_MS = 250;
const REDUCED_STEP_HOURS = 12;

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; event: EventFile };

interface Props {
  entry: ManifestEvent;
  dataThrough: string | null;
  // hour from the shared link, used once for the first event shown
  initialHour: number | null;
  onHourChange: (h: number) => void;
}

const cache = new Map<string, EventFile>();

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Explorer({ entry, dataThrough, initialHour, onHourChange }: Props) {
  const [load, setLoad] = useState<Load>(() => {
    const cached = cache.get(entry.id);
    return cached ? { kind: "ready", event: cached } : { kind: "loading" };
  });
  const [attempt, setAttempt] = useState(0);
  const [h, setH] = useState<number | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>("fit");
  const [showThresholdTable, setShowThresholdTable] = useState(false);
  const firstHour = useRef(initialHour);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(entry.id);
    if (cached) {
      setLoad({ kind: "ready", event: cached });
    } else {
      setLoad({ kind: "loading" });
      loadEvent(entry)
        .then((event) => {
          cache.set(entry.id, event);
          if (!cancelled) setLoad({ kind: "ready", event });
        })
        .catch((err: Error) => {
          if (!cancelled) setLoad({ kind: "error", message: err.message });
        });
    }
    setPinned(null);
    setHovered(null);
    setPlaying(false);
    return () => {
      cancelled = true;
    };
  }, [entry, attempt]);

  const event = load.kind === "ready" ? load.event : null;
  const bounds = useMemo(() => (event ? hourBounds(event.snapshots) : null), [event]);

  // a new event starts at T-1h, or at the hour in the shared link when it falls inside the event
  useEffect(() => {
    if (!event || !bounds) return;
    const wanted = firstHour.current;
    setH(wanted !== null && wanted <= bounds.max && wanted >= bounds.min ? wanted : defaultHour(event.snapshots));
  }, [event, bounds]);

  useEffect(() => {
    if (h !== null) onHourChange(h);
  }, [h, onHourChange]);

  useEffect(() => {
    if (!playing || !bounds) return;
    const timer = window.setInterval(() => {
      setH((cur) => {
        const next = Math.max(bounds.min, (cur ?? bounds.max) - PLAY_STEP_HOURS);
        if (next === bounds.min) setPlaying(false);
        return next;
      });
    }, PLAY_TICK_MS);
    return () => window.clearInterval(timer);
  }, [playing, bounds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const status = eventStatus(entry, dataThrough);
  const when = releaseWhen(entry);
  // a past FOMC meeting always ended in a decision, even when this data has no number for it
  const verb =
    status === "upcoming" ? "Scheduled"
    : entry.series === "KXFED" ? "Decided"
    : status === "published" ? "Released"
    : "Scheduled";

  const heading = (
    <div className="event-top-bar">
      <h1 className="t-h1">{entry.title}</h1>
      <div className="t-label event-meta-sub">
        {verb} {when.date}, {when.time}
        {daysClosedBefore(entry) > 0 && (
          <>. Trading closed {formatEt(entry.close)}, {daysClosedBefore(entry) === 1 ? "the evening before" : `${daysClosedBefore(entry)} days before`}</>
        )}
      </div>
    </div>
  );

  if (load.kind === "loading" || (event && (h === null || !bounds))) {
    return (
      <div className="page-fade" aria-live="polite">
        {heading}
        <p className="t-label">Loading event data</p>
        <div className="skeleton-box" style={{ height: 112, marginBottom: 24 }} />
        <div className="skeleton-box" style={{ height: 280 }} />
      </div>
    );
  }

  if (load.kind === "error") {
    return (
      <div className="page-fade">
        {heading}
        <div className="state-banner" role="alert">
          <h2 className="t-h3" style={{ marginBottom: 8 }}>This event could not be loaded</h2>
          <p>{load.message}</p>
          <button type="button" className="play-btn" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
        </div>
      </div>
    );
  }

  const ev = load.event;
  const hour = h as number;
  const { max, min } = bounds as { max: number; min: number };
  const snap = snapshotAt(ev.snapshots, hour);
  const anchor = snapshotAt(ev.snapshots, Math.max(1, min));
  const weekAgo = snapshotAt(ev.snapshots, 168);
  const bins = snap?.bins ?? [];
  const labels = bins.map((b) => binLabel(b, ev.unit, ev.resolution));
  const ghost = weekAgo && weekAgo !== snap ? matchBins(bins, weekAgo.bins) : bins.map(() => null);
  const printIndex = status === "published" ? binIndexOf(bins, ev.first_print) : -1;
  const keys = bins.map((b) => `${b[0]}|${b[1]}`);
  const activeKey = pinned ?? hovered;
  const activeIndex = activeKey === null ? null : keys.indexOf(activeKey);
  const mode = modeIndex(bins);
  const asOf = snap ? `As of ${formatEt(snap.ts)} (${hourLabel(snap.h)})` : "";
  const precise = (v: number) => formatValue(v, ev.unit, true);

  function binReadout(i: number): string {
    const b = bins[i];
    if (!b) return "";
    const g = ghost[i] ?? null;
    const before = g === null ? "not listed at T−7d" : `${pct(g, 1)} at T−7d`;
    return `${labels[i]}: ${pct(b[2], 1)} implied probability (${before})${i === printIndex ? ", the bin of the first print" : ""}.`;
  }

  let readout = "No market estimate at this hour.";
  if (activeIndex !== null && activeIndex >= 0) readout = binReadout(activeIndex);
  else if (snap && snap.mean !== null && snap.p25 !== null && snap.p75 !== null && snap.p05 !== null && snap.p95 !== null) {
    readout = `Implied mean ${precise(snap.mean)} (50% interval ${precise(snap.p25)} to ${precise(snap.p75)}, 90% interval ${precise(snap.p05)} to ${precise(snap.p95)}).`;
  } else if (bins.length > 0) {
    readout = `${bins.map((b, i) => `${labels[i]} at ${pct(b[2], 1)}`).join(", ")}.`;
  }

  function setHour(next: number) {
    const found = snapshotAt(ev.snapshots, next);
    setH(found ? found.h : next);
  }

  function togglePlay() {
    if (prefersReducedMotion()) {
      setPlaying(false);
      setHour(hour <= min ? max : Math.max(min, hour - REDUCED_STEP_HOURS));
      return;
    }
    if (!playing && hour <= min) setH(max);
    setPlaying(!playing);
  }

  const modeBin = bins[mode];
  const modeGhost = ghost[mode] ?? null;
  const title = modeBin ? `Market put ${pct(modeBin[2])} on ${labels[mode]}` : "No outcome bins at this hour";
  const summary = modeBin
    ? `At ${hourLabel(hour)} the most likely outcome was ${labels[mode]} at ${pct(modeBin[2])}` +
      (modeGhost === null
        ? "."
        : pct(modeGhost) === pct(modeBin[2])
          ? `, unchanged from a week earlier.`
          : `, ${modeBin[2] >= modeGhost ? "up" : "down"} from ${pct(modeGhost)} a week earlier.`)
    : "";
  const source = ev.first_print_source === "alfred" ? "first print from ALFRED" : "outcome from the Kalshi settlement";

  const isFomc = ev.series === "KXFED";
  // one or two listed contracts give a few outcome odds but no median, so they are drawn as odds lines
  const fewContracts = anchor !== null && anchor.p50 === null && anchor.survival.length > 0 && anchor.survival.length < 3;
  const oddsLines = isFomc || fewContracts;
  const earliest = snapshotAt(ev.snapshots, max);
  const width = (v: number) => (ev.unit === "jobs" ? formatValue(v, ev.unit) : `${fixed(v, 2)} pp`);
  let timeTitle = "How the market's view moved over the final week";
  let timeSummary = "";
  if (oddsLines && anchor) {
    const anchorMode = anchor.bins[modeIndex(anchor.bins)];
    const series = oddsSeries(ev.snapshots).find((s) => anchorMode && s.key === `${anchorMode[0]}|${anchorMode[1]}`);
    const start = series?.points.find((pt) => pt[1] !== null)?.[1];
    if (anchorMode && start !== undefined && start !== null) {
      const label = binLabel(anchorMode, ev.unit, ev.resolution);
      timeTitle =
        pct(start) === pct(anchorMode[2])
          ? `Odds on ${label} held at ${pct(start)}`
          : `Odds on ${label} ${anchorMode[2] >= start ? "rose" : "fell"} from ${pct(start)} to ${pct(anchorMode[2])}`;
    }
    timeSummary = !fewContracts
      ? "Each line is one rate outcome that reached 10% at some hour, from its first listing to the close."
      : "Each line is one side of the listed contract, from its first listing to the close.";
  } else if (earliest && anchor && earliest.p05 !== null && earliest.p95 !== null && anchor.p05 !== null && anchor.p95 !== null) {
    const w0 = earliest.p95 - earliest.p05;
    const w1 = anchor.p95 - anchor.p05;
    timeTitle = `90% range ${w1 <= w0 ? "narrowed" : "widened"} from ${width(w0)} to ${width(w1)}`;
    if (earliest.p50 !== null && anchor.p50 !== null) {
      timeSummary = `The median moved from ${precise(earliest.p50)} at ${hourLabel(earliest.h)} to ${precise(anchor.p50)} at ${hourLabel(anchor.h)}.`;
    }
  }

  const survival = snap?.survival ?? [];
  const adjusted = survival.filter(([, raw, fit]) => Math.abs(raw - fit) > 0.0005).length;

  return (
    <div className="page-fade">
      {heading}

      {status === "upcoming" && (
        <div className="state-banner">
          <strong>Upcoming.</strong> The {entry.series === "KXFED" ? "decision" : "number"} is due {when.date},{" "}
          {when.time}. Snapshots run through{" "}
          {hourLabel(min)}, the last hour in the current data.
        </div>
      )}
      {status === "not_published" && (
        <div className="state-banner">
          <strong>No outcome on record.</strong> This data has neither a first print nor a numeric
          settlement for this event, so there is no surprise to measure. The market snapshots before
          the close are shown as they were.
        </div>
      )}

      {status === "published" && fewContracts && anchor && (
        <div className="state-banner">
          <strong>{anchor.survival.length === 1 ? "One contract." : `${anchor.survival.length} contracts.`}</strong> Early Kalshi
          markets listed {anchor.survival.length === 1 ? "a single contract" : "only a couple of contracts"} for this{" "}
          {isFomc ? "decision" : "release"}, not a full ladder. The odds are shown as traded, but there is no distribution, so no median,
          range or surprise.
        </div>
      )}

      <PlainWords event={ev} status={status} expectedMedian={anchor?.p50 ?? null} survival={anchor?.survival ?? null} />

      <KeyStrip event={ev} status={status} anchor={anchor} />

      <div className="readout-strip" aria-live="polite">
        <div>
          <span className="t-label">{asOf}: </span>
          <span className="readout-text num">{readout}</span>
        </div>
        {pinned !== null && (
          <button type="button" className="readout-unpin" onClick={() => setPinned(null)}>Clear pin (Esc)</button>
        )}
      </div>

      <div className="main-chart-row">
      <figure className="chart-figure chart-col-time" aria-labelledby="time-chart-title">
        <div className="chart-header">
          <h2 className="t-h3" id="time-chart-title">{timeTitle}</h2>
        </div>
        <p className="chart-summary num">{timeSummary} Click or drag on the chart to move in time.</p>
        {oddsLines ? (
          <OddsChart
            snaps={ev.snapshots} h={hour} maxH={max} minH={min}
            unit={ev.unit} resolution={ev.resolution}
            onHour={(next) => { setPlaying(false); setHour(next); }}
          />
        ) : (
          <FanChart
            snaps={ev.snapshots} h={hour} maxH={max} minH={min} unit={ev.unit}
            firstPrint={status === "published" ? ev.first_print : null}
            onHour={(next) => { setPlaying(false); setHour(next); }}
          />
        )}
        <div className="chart-footer">
          <div className="chart-footer-top t-micro">
            <span>Source: Kalshi {ev.event_ticker}, hourly snapshots</span>
          </div>
          <details className="how-to-read">
            <summary>How to read this chart</summary>
            <p>
              {oddsLines
                ? "Each line follows the probability of one outcome across the final week, ordered from the lowest value up. A line starts when Kalshi first listed that outcome. The vertical line marks the selected hour."
                : "The dark line is the implied median for every hour of the final week. The darker band holds the middle 50% of outcomes and the lighter band the middle 90%. The dashed line is the number first published. The vertical line marks the selected hour."}
            </p>
          </details>
        </div>
      </figure>

      <figure className="chart-figure chart-col-bin" aria-labelledby="bin-chart-title">
        <div className="chart-header">
          <div>
            <div className="t-micro chart-kicker">{asOf}</div>
            <h2 className="t-h3" id="bin-chart-title">{title}</h2>
          </div>
          <button type="button" className="text-btn" aria-expanded={showTable} onClick={() => setShowTable(!showTable)}>
            {showTable ? "Hide data table" : "Show data table"}
          </button>
        </div>
        <p className="chart-summary num">{summary}</p>
        <BinChart
          bins={bins}
          labels={labels}
          ghost={ghost}
          firstPrintIndex={printIndex}
          activeIndex={activeIndex !== null && activeIndex >= 0 ? activeIndex : null}
          onHover={(i) => setHovered(i === null ? null : keys[i] ?? null)}
          onPin={(i) => setPinned(i === null ? null : keys[i] ?? null)}
        />
        {showTable && (
          <div className="data-table-wrap">
            <table className="mel-table">
              <caption className="sr-only">Outcome probabilities at {hourLabel(hour)} and a week earlier</caption>
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th className="r">{hourLabel(hour)}</th>
                  <th className="r">T{MINUS}7d</th>
                  <th className="r">Change</th>
                </tr>
              </thead>
              <tbody>
                {bins.map((b, i) => {
                  const g = ghost[i] ?? null;
                  return (
                    <tr key={keys[i]}>
                      <td>{labels[i]}{i === printIndex ? " (first print)" : ""}</td>
                      <td className="r">{pct(b[2], 1)}</td>
                      <td className="r">{g === null ? "n/a" : pct(g, 1)}</td>
                      <td className="r">{g === null ? "n/a" : signed((b[2] - g) * 100, 1, " pp")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="chart-footer">
          <div className="chart-footer-top t-micro">
            <span>Source: Kalshi {ev.event_ticker}, hourly snapshots; {source}</span>
            {snap && <span className="mono">as_of: {snap.ts}</span>}
          </div>
          <details className="how-to-read">
            <summary>How to read this chart</summary>
            <p>
              Each bar is the probability the market gave one outcome at the selected hour, read from
              Kalshi contracts of the form "above k" and made consistent so the bars add up to 100%. The
              dashed outline is the same outcome a week before the close, where that outcome was already
              listed. The bar with a dark frame holds the number first published. Labels name the printed
              values a bin covers; the open ends cover everything below or above the listed strikes.
            </p>
          </details>
        </div>
      </figure>
      </div>

      <TimeControls
        h={hour}
        ts={snap?.ts ?? null}
        max={max}
        min={min}
        playing={playing}
        onHour={(next) => {
          setPlaying(false);
          setHour(next);
        }}
        onPlay={togglePlay}
      />

      <figure className="chart-figure" aria-labelledby="threshold-chart-title">
        <div className="chart-header chart-header-wrap">
          <div>
            <div className="t-micro chart-kicker">{asOf}</div>
            <h2 className="t-h3" id="threshold-chart-title">Probability above each strike, P(X &gt; k)</h2>
          </div>
          <div className="chart-tools">
            <div className="toggle-pair" role="group" aria-label="Fitted or raw probabilities">
              {(["fit", "raw"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={thresholdMode === m} onClick={() => setThresholdMode(m)}>
                  {m === "fit" ? "Fit" : "Raw"}
                </button>
              ))}
            </div>
            <button
              type="button" className="text-btn" aria-expanded={showThresholdTable}
              onClick={() => setShowThresholdTable(!showThresholdTable)}
            >
              {showThresholdTable ? "Hide data table" : "Show data table"}
            </button>
          </div>
        </div>
        <p className="chart-summary num">
          {thresholdMode === "fit"
            ? `The fit never rises from one strike to the next, and its drops are the bars above. ${
                adjusted === 0
                  ? "At this hour it matches the raw price at every strike."
                  : `At this hour it moved ${adjusted} of ${survival.length} strikes away from the raw price.`
              }`
            : "Raw prices of each \"above k\" contract at this hour, before the fit. The dashed line is the fit."}
        </p>
        <ThresholdChart survival={survival} unit={ev.unit} mode={thresholdMode} />
        {showThresholdTable && (
          <div className="data-table-wrap">
            <table className="mel-table">
              <caption className="sr-only">Raw and fitted probability above each strike at {hourLabel(hour)}</caption>
              <thead>
                <tr>
                  <th>Strike</th>
                  <th className="r">Raw</th>
                  <th className="r">Fit</th>
                </tr>
              </thead>
              <tbody>
                {survival.map(([k, raw, fit]) => (
                  <tr key={k}>
                    <td className="num">Above {formatValue(k, ev.unit)}</td>
                    <td className="r">{pct(raw, 1)}</td>
                    <td className="r">{pct(fit, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="chart-footer">
          <details className="how-to-read">
            <summary>How to read this chart</summary>
            <p>
              Kalshi lists contracts that pay if the number comes out above a strike k, so each price
              is a probability P(X &gt; k). Raw prices can rise from one strike to the next, which no real
              distribution allows. The fit, a weighted isotonic regression that trusts tighter quotes
              more, removes those rises. The probability of a bin is the drop between two neighbouring
              strikes.
            </p>
          </details>
        </div>
      </figure>

      <ReactionBlock reaction={ev.reaction} status={status} isFomc={isFomc} />

      <StoryNext current="events" />
    </div>
  );
}
