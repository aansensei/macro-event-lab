import { useId, useState, type FormEvent } from "react";

import { ArenaPending } from "../components/ArenaPending";
import { Icon } from "../components/Icon";
import { PageGuide } from "../components/PageGuide";
import { ResourceError } from "../components/ResourceError";
import { RailPage, type RailSection } from "../components/SectionRail";
import { ARENA_NOT_BUILT, loadArena, type ArenaTarget } from "../data/arena";
import { useResource } from "../hooks/useResource";
import { buildRounds, loadProgress, parseGuess, saveProgress, scoreRound, summarize, type PlayRound } from "../lib/play";
import { periodLabel } from "../lib/revisionWords";
import { pageSearch } from "../lib/url";

const ROUNDS_PER_GAME = 5;

const RAIL: RailSection[] = [
  { id: "play-top", label: "Top" },
  { id: "play-round", label: "Round" },
  { id: "play-guide", label: "How it works" },
];

type RoundResult = ReturnType<typeof scoreRound>;

function readSeed(): number {
  if (typeof window !== "undefined") {
    const raw = new URLSearchParams(window.location.search).get("seed");
    if (raw !== null && /^-?\d+$/.test(raw.trim())) {
      const parsed = Number(raw.trim());
      if (Number.isSafeInteger(parsed)) return parsed;
    }
  }
  return Math.floor(Date.now() / 1000);
}

function readStoredProgress(): RoundResult[] {
  if (typeof window === "undefined") return [];
  return loadProgress(window.localStorage);
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function guessProblem(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Enter a numeric guess to lock it in.";
  if ((trimmed.match(/\./g) ?? []).length > 1) return "Use at most one decimal point.";
  if (trimmed.includes(",") && !/^([+\-\u2212])?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmed)) {
    return "Commas may only separate groups of three digits.";
  }
  return "Use digits with an optional sign, comma thousands separators, and one decimal point.";
}

function HistoryChart({ round, target }: { round: PlayRound; target: ArenaTarget | undefined }) {
  const points = round.history;
  if (points.length === 0) {
    return <p className="muted">No earlier first published figures are recorded for this target.</p>;
  }
  const width = 480;
  const height = 160;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (index: number) => padLeft + (points.length === 1 ? 0.5 : index / (points.length - 1)) * (width - padLeft - padRight);
  const y = (value: number) => padTop + (1 - (value - low) / span) * (height - padTop - padBottom);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`).join(" ");
  const label = target?.label ?? round.target;

  return <div className="play-history-wrap">
    <svg className="play-history-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Recent first published history for ${label} before ${periodLabel(round.target, round.period)}`}>
      <line x1={padLeft} x2={width - padRight} y1={y(low)} y2={y(low)} stroke="var(--border)" />
      {low !== high && <line x1={padLeft} x2={width - padRight} y1={y(high)} y2={y(high)} stroke="var(--border)" />}
      {low !== high && <text x={padLeft - 6} y={y(high) + 4} textAnchor="end" fill="var(--text-muted)" fontSize="11">{formatNumber(high)}</text>}
      <text x={padLeft - 6} y={y(low) + 4} textAnchor="end" fill="var(--text-muted)" fontSize="11">{formatNumber(low)}</text>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((point, index) => <circle key={point.period} cx={x(index)} cy={y(point.value)} r="3.5" fill="var(--accent)" />)}
      <text x={x(0)} y={height - 6} textAnchor="start" fill="var(--text-muted)" fontSize="11">{periodLabel(round.target, points[0]!.period)}</text>
      {points.length > 1 && <text x={x(points.length - 1)} y={height - 6} textAnchor="end" fill="var(--text-muted)" fontSize="11">{periodLabel(round.target, points[points.length - 1]!.period)}</text>}
    </svg>
    <ul className="play-history-list" aria-label="History values">
      {points.map((point) => <li key={point.period}>
        <span className="muted">{periodLabel(round.target, point.period)}</span>
        <span className="num">{formatNumber(point.value)}</span>
      </li>)}
    </ul>
  </div>;
}

export function Play() {
  const { state, retry } = useResource(loadArena);
  const [seed, setSeed] = useState<number>(readSeed);
  const [roundIndex, setRoundIndex] = useState(0);
  const [guessText, setGuessText] = useState("");
  const [lockedResult, setLockedResult] = useState<RoundResult | null>(null);
  const [gameResults, setGameResults] = useState<RoundResult[]>([]);
  const [savedResults, setSavedResults] = useState<RoundResult[]>(readStoredProgress);
  const inputId = useId();
  const hintId = useId();

  if (state.kind !== "ready") {
    return <div className="play-page page-fade">
      <p className="section-kicker">Beat the forecasters</p>
      <h1 className="t-h1">Can you beat the forecasters on real releases?</h1>
      {state.kind === "loading" ? <p className="state-banner" role="status">Loading forecast arena data.</p>
        : state.message === ARENA_NOT_BUILT ? <ArenaPending onRetry={retry} />
        : <ResourceError title={state.message.startsWith("Unsupported") ? "Unsupported data format" : "Forecast arena data could not be loaded"} message={state.message} onRetry={retry} />}
    </div>;
  }

  const data = state.data;
  const rounds = buildRounds(data, seed, ROUNDS_PER_GAME);
  const activeRound = rounds[roundIndex];
  const parsedGuess = parseGuess(guessText);
  const problem = parsedGuess === null ? guessProblem(guessText) : null;
  const targetInfo = activeRound ? data.targets.find((target) => target.id === activeRound.target) : undefined;
  const isFinished = rounds.length > 0 && roundIndex >= rounds.length;
  const summary = summarize(gameResults);

  function handleLockIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRound || parsedGuess === null || lockedResult !== null) return;
    const scored = scoreRound(activeRound, parsedGuess);
    setLockedResult(scored);
    setGameResults((previous) => [...previous, scored]);
    setSavedResults((previous) => {
      const next = [...previous, scored];
      if (typeof window !== "undefined") saveProgress(window.localStorage, next);
      return next;
    });
  }

  function handleNextRound() {
    setRoundIndex((index) => index + 1);
    setGuessText("");
    setLockedResult(null);
  }

  function handlePlayAgain() {
    const nowSeconds = Math.floor(Date.now() / 1000);
    setSeed((current) => (nowSeconds === current ? current + 1 : nowSeconds));
    setRoundIndex(0);
    setGuessText("");
    setLockedResult(null);
    setGameResults([]);
  }

  return <RailPage sections={RAIL}><div className="play-page page-fade">
    <header className="play-intro" id="play-top">
      <p className="section-kicker">Beat the forecasters</p>
      <h1 className="t-h1">Can you beat the forecasters on real releases?</h1>
      <p className="about-lead">
        Step into a past release with only the numbers published before it happened, type your own forecast, and compare your error with the contestants.
      </p>
      <div className="play-meta">
        <span className="num">Rounds played so far: {savedResults.length}</span>
        <span className="num">Seed: {seed} (<a href={`?page=play&seed=${seed}`}>Repeat with ?seed={seed}</a>)</span>
      </div>
    </header>

    <PageGuide
      purpose="Experience the forecasting problem using only data published before each release."
      lookAt="The target, its units, the recent first published history, and the information cutoff date before entering a number."
      limit="Forecasting skill. A five round game is mostly luck, and the results do not establish a ranking of forecasters." />

    <section className="play-section" aria-labelledby="play-round">
      {rounds.length === 0 ? <p className="state-banner" id="play-round">No past releases with enough forecasts are available yet.</p>
        : isFinished ? <div className="play-card" id="play-round">
          <h2 className="t-h3">Game summary</h2>
          <p>You played {summary.rounds} rounds. A game this short is mostly luck.</p>
          <p className="num">Your mean absolute error: {summary.yourMeanAbsError === null ? "Not available" : formatNumber(summary.yourMeanAbsError)}</p>
          <div className="play-table-wrap">
            <table className="play-table">
              <thead>
                <tr>
                  <th scope="col">Contestant</th>
                  <th scope="col">Mean absolute error</th>
                  <th scope="col">Comparison</th>
                </tr>
              </thead>
              <tbody>
                {summary.entries.map((entry) => <tr key={entry.id}>
                  <th scope="row">{entry.label}</th>
                  <td data-label="Mean absolute error">{formatNumber(entry.meanAbsError)}</td>
                  <td data-label="Comparison">
                    <span className={`play-mark ${entry.youWon ? "play-mark-beat" : "play-mark-miss"}`}>
                      <Icon name={entry.youWon ? "circle-check" : "circle-x"} size={16} />
                      <span>{entry.youWon ? "Lower error than contestant" : "Higher or equal error"}</span>
                    </span>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="play-actions">
            <button type="button" className="play-btn" onClick={handlePlayAgain}>Play again</button>
            <a href={pageSearch("arena")}>See the full forecast arena</a>
          </div>
        </div>
        : activeRound && <div className="play-card" id="play-round">
          <div className="play-round-head">
            <h2 className="t-h3">{targetInfo?.label ?? activeRound.target} ({periodLabel(activeRound.target, activeRound.period)})</h2>
            <span className="num muted">Round {roundIndex + 1} of {rounds.length}</span>
          </div>
          <p className="muted">Unit: {activeRound.unit}</p>
          <p className="play-cutoff">Information as of {activeRound.madeOn}</p>
          <HistoryChart round={activeRound} target={targetInfo} />

          {lockedResult === null ? <form className="play-form" onSubmit={handleLockIn}>
            <div className="play-field">
              <label htmlFor={inputId}>Your forecast ({activeRound.unit})</label>
              <input
                id={inputId}
                className="play-input"
                type="text"
                inputMode="decimal"
                value={guessText}
                onChange={(event) => setGuessText(event.target.value)}
                aria-invalid={problem !== null}
                aria-describedby={problem !== null ? hintId : undefined}
              />
            </div>
            {problem !== null && <p className="play-hint" id={hintId}>{problem}</p>}
            <div className="play-actions">
              <button type="submit" className="play-btn" disabled={parsedGuess === null}>Lock in my guess</button>
            </div>
          </form> : <div className="play-outcome" aria-live="polite">
            <dl className="play-outcome-grid">
              <div><dt>First published actual</dt><dd>{formatNumber(lockedResult.actual)}</dd></div>
              <div><dt>Your guess</dt><dd>{formatNumber(lockedResult.guess)}</dd></div>
              <div><dt>Your absolute error</dt><dd>{formatNumber(lockedResult.absError)}</dd></div>
            </dl>
            <div className="play-table-wrap">
              <table className="play-table">
                <thead>
                  <tr>
                    <th scope="col">Contestant</th>
                    <th scope="col">Forecast</th>
                    <th scope="col">Absolute error</th>
                    <th scope="col">Comparison</th>
                  </tr>
                </thead>
                <tbody>
                  {lockedResult.entries.map((entry) => {
                    const forecast = activeRound.forecasts.find((item) => item.id === entry.id);
                    return <tr key={entry.id}>
                      <th scope="row">{entry.label}</th>
                      <td data-label="Forecast">{forecast ? formatNumber(forecast.value) : "Not available"}</td>
                      <td data-label="Absolute error">{formatNumber(entry.absError)}</td>
                      <td data-label="Comparison">
                        <span className={`play-mark ${entry.youBeat ? "play-mark-beat" : "play-mark-miss"}`}>
                          <Icon name={entry.youBeat ? "circle-check" : "circle-x"} size={16} />
                          <span>{entry.youBeat ? "You beat" : "Closer or tied"}</span>
                        </span>
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="play-actions">
              <button type="button" className="play-btn" onClick={handleNextRound}>Next round</button>
            </div>
          </div>}
        </div>}
    </section>

    <section className="play-section play-guide" aria-labelledby="play-guide">
      <h2 id="play-guide" className="t-h3">How it works</h2>
      <p>
        Each round draws a release from the public arena record and displays only earlier first published values from the same target. Results describe the supplied sample and do not establish a ranking of forecasters.
      </p>
      {data.contestants.some((contestant) => contestant.id === "spf") && <p className="muted">
        Professional forecasts: Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF). Used for non-commercial education and research. This site is independent and is not sponsored, endorsed or approved by the Federal Reserve Bank of Philadelphia.
      </p>}
    </section>
  </div></RailPage>;
}
