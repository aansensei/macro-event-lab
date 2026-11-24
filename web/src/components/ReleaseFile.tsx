import { useMemo, useState } from "react";

import type { Arena, TargetId } from "../data/arena";
import type { Revisions } from "../data/types";
import { formatReleaseValue, pickReleaseCase, releaseSentence } from "../lib/releaseFile";
import { periodLabel } from "../lib/revisionWords";
import { pageSearch } from "../lib/url";
import { TargetSwitch } from "./TargetSwitch";

const WIDTH = 640;
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
  const chosen = targets.some((t) => t.id === target) ? target : targets[0]?.id;
  const release = useMemo(
    () => (chosen ? pickReleaseCase(arena, revisions, chosen) : null),
    [arena, revisions, chosen],
  );
  if (!release || !chosen) return null;
  const marks = [
    ...release.entries.map((e) => e.value), release.actual,
    ...(release.latest === null ? [] : [release.latest]),
  ];
  const low = Math.min(...marks);
  const high = Math.max(...marks);
  const span = high - low || 1;
  const x = (value: number) => PAD + ((value - low) / span) * (WIDTH - 2 * PAD);
  const summary = releaseSentence(release);
  return <section className="release-file" aria-labelledby="release-file-title">
    <p className="section-kicker">The release file</p>
    <h2 className="t-h2" id="release-file-title">Everyone forecasts the number. Who was close, and what did it become?</h2>
    <p className="muted release-lead">
      A real release from the public record, picked because its first published number landed farthest from
      what forecasters and models expected.
    </p>
    <TargetSwitch targets={targets} selected={chosen} onChange={setTarget} />
    <p className="release-sentence" aria-live="polite">{summary}</p>
    <svg className="release-line" viewBox={`0 0 ${WIDTH} 84`} role="img" aria-label={summary}>
      <line x1={PAD} x2={WIDTH - PAD} y1="44" y2="44" className="release-axis" />
      {release.entries.map((e) => <circle key={e.id} cx={x(e.value)} cy="44" r="5" className="release-forecast" />)}
      {release.latest !== null && <circle cx={x(release.latest)} cy="44" r="9" className="release-today" />}
      <path d={`M ${x(release.actual)} 30 l 9 14 l -9 14 l -9 -14 Z`} className="release-first" />
      <text x={PAD} y="80" className="release-tick">{bare(chosen, low)}</text>
      <text x={WIDTH - PAD} y="80" textAnchor="end" className="release-tick">{bare(chosen, high)}</text>
    </svg>
    <ul className="release-legend t-micro muted">
      <li><span className="release-key release-key-forecast" aria-hidden="true" /> Forecasts</li>
      <li><span className="release-key release-key-first" aria-hidden="true" /> First published</li>
      <li><span className="release-key release-key-today" aria-hidden="true" /> Today</li>
    </ul>
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
        <p className="release-big num">{formatReleaseValue(chosen, release.actual)}</p>
        <p className="muted">{periodLabel(chosen, release.period)}</p>
      </li>
      <li className="release-step">
        <span className="release-step-number num">03</span>
        <h3 className="t-h3">Since then</h3>
        {release.latest === null
          ? <p className="muted">No later figure is available yet.</p>
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
