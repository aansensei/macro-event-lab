import { useMemo, useState } from "react";

import { useWidth } from "../hooks/useWidth";

import type { Arena, TargetId } from "../data/arena";
import type { Revisions } from "../data/types";
import { formatReleaseValue, pickReleaseCase, releaseSentence, type ReleaseStage } from "../lib/releaseFile";
import { periodLabel } from "../lib/revisionWords";
import { pageSearch } from "../lib/url";
import { HowToRead } from "./HowToRead";
import { TargetSwitch } from "./TargetSwitch";

const MAX_WIDTH = 720;
const MIN_WIDTH = 280;
const PAD = 28;

function bare(target: TargetId, value: number): string {
  return formatReleaseValue(target, value).replace(/ annualized| m\/m/, "");
}

// one real release laid out on a number line: what forecasters and models expected, the first print, and today's figure
export function ReleaseFile({ arena, revisions }: { arena: Arena; revisions: Revisions }) {
  const targets = useMemo(
    () => arena.targets.filter((t) => pickReleaseCase(arena, revisions, t.id) !== null),
    [arena, revisions],
  );
  const [target, setTarget] = useState<TargetId>(targets[0]?.id ?? "gdp");
  const [stage, setStage] = useState<ReleaseStage>(0);
  const [lineRef, measured] = useWidth<HTMLDivElement>();
  const WIDTH = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, measured || 640));
  const chosen = targets.some((t) => t.id === target) ? target : targets[0]?.id;
  const release = useMemo(
    () => (chosen ? pickReleaseCase(arena, revisions, chosen) : null),
    [arena, revisions, chosen],
  );
  if (!release || !chosen) return null;
  const marks = [
    ...release.entries.map((e) => e.value),
    ...(stage >= 1 ? [release.actual] : []),
    ...(stage >= 2 && release.latest !== null ? [release.latest] : []),
  ];
  const low = Math.min(...marks);
  const high = Math.max(...marks);
  const span = high - low || 1;
  const x = (value: number) => PAD + ((value - low) / span) * (WIDTH - 2 * PAD);
  const summary = releaseSentence(release, stage);
  const advance = () => setStage(stage === 0 ? 1 : stage === 1 && release.latest !== null ? 2 : 0);
  const advanceLabel = stage === 0 ? "Reveal the first published number"
    : stage === 1 && release.latest !== null ? "Show what it became" : "Start again";
  return <section className="release-file" aria-labelledby="release-file-title">
    <p className="section-kicker">The release file</p>
    <h2 className="t-h2" id="release-file-title">Everyone forecasts the number. Who was close, and what did it become?</h2>
    <p className="muted release-lead">
      A real release from the public record, picked because its first published number landed farthest from
      what forecasters and models expected.
    </p>
    <TargetSwitch targets={targets} selected={chosen} onChange={(next) => { setTarget(next); setStage(0); }} />
    <p className="release-sentence" aria-live="polite">{summary}</p>
    <div ref={lineRef}>
    <svg className="release-line" width={WIDTH} height="84" viewBox={`0 0 ${WIDTH} 84`} role="img" aria-label={summary}>
      <line x1={PAD} x2={WIDTH - PAD} y1="44" y2="44" className="release-axis" />
      {release.entries.map((e) => <circle key={e.id} cx={x(e.value)} cy="44" r="6" className="release-forecast" />)}
      {stage >= 2 && release.latest !== null && <circle cx={x(release.latest)} cy="44" r="9" className="release-today" />}
      {stage >= 1 && <path d={`M ${x(release.actual)} 30 l 9 14 l -9 14 l -9 -14 Z`} className="release-first" />}
      <text x={PAD} y="80" className="release-tick">{bare(chosen, low)}</text>
      <text x={WIDTH - PAD} y="80" textAnchor="end" className="release-tick">{bare(chosen, high)}</text>
    </svg>
    </div>
    <ul className="release-legend t-micro muted">
      <li><span className="release-key release-key-forecast" aria-hidden="true" /> Forecasts</li>
      <li><span className="release-key release-key-first" aria-hidden="true" /> First published</li>
      <li><span className="release-key release-key-today" aria-hidden="true" /> Today</li>
    </ul>
    <div className="release-actions">
      <button type="button" className="release-reveal" onClick={advance}>{advanceLabel}</button>
      <span className="t-micro muted">Step {stage + 1} of {release.latest === null ? 2 : 3}</span>
    </div>
    <HowToRead>
      <p>
        Read the line from left to right: the further right a mark sits, the higher the number. The small
        circles are the forecasts made before the release. The diamond is the number first published. The large
        ring is today's figure after later revisions. A diamond far from the circles means the release surprised
        the forecasters, and a ring far from the diamond means the figure was revised a lot. The two ends of the
        line show the lowest and highest value drawn, so the scale changes with each release. This is one case
        picked for its size, not a typical one.
      </p>
    </HowToRead>
    <ol className="release-steps">
      <li className="release-step">
        <span className="release-step-number num">01</span>
        <h3 className="t-h3">Expected</h3>
        <ul className="release-list">
          {release.entries.map((e) => <li key={e.id}>
            <span>{e.label}</span> <span className="num">{formatReleaseValue(chosen, e.value)}</span>
          </li>)}
        </ul>
      </li>
      <li className="release-step">
        <span className="release-step-number num">02</span>
        <h3 className="t-h3">First published</h3>
        {stage >= 1
          ? <p className="release-big num">{formatReleaseValue(chosen, release.actual)}</p>
          : <p className="release-big release-sealed" aria-label="Sealed until you reveal it"><span className="release-seal" aria-hidden="true">Sealed</span></p>}
        <p className="muted">{periodLabel(chosen, release.period)}</p>
      </li>
      <li className="release-step">
        <span className="release-step-number num">03</span>
        <h3 className="t-h3">Since then</h3>
        {release.latest === null
          ? <p className="muted">No later figure is available yet.</p>
          : stage < 2
            ? <p className="muted">Hidden until the first published number has been shown and you ask what it became.</p>
            : <>
            <p className="release-big num">{formatReleaseValue(chosen, release.latest)}</p>
            <p className="muted">
              {release.next === null ? "Today's figure." : `After the next report: ${formatReleaseValue(chosen, release.next)}.`}
            </p>
          </>}
      </li>
    </ol>
    <p className="muted t-micro">
      Forecasts come from the preliminary forecast arena. <a href={pageSearch("arena")}>See every contestant and the scoring rules</a>.
    </p>
  </section>;
}
