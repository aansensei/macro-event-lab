import type { EventFile, Snapshot } from "../data/types";
import {
  formatDelta,
  formatNumber,
  formatValue,
  hourLabel,
  signed,
  unitParts,
} from "../lib/format";
import { releaseWhen, type EventStatus } from "../lib/snapshots";

function Hero({ value, unit, className }: { value: number; unit: string | null; className: string }) {
  const { lead, rest } = unitParts(unit);
  return (
    <div className={`t-hero ${className}`}>
      <span className="hero-num">{formatNumber(value, unit)}{lead}</span>
      {rest && <span className="hero-unit">{rest}</span>}
    </div>
  );
}

function TextHero({ children }: { children: string }) {
  return <div className="t-hero is-text">{children}</div>;
}

interface Props {
  event: EventFile;
  status: EventStatus;
  // the snapshot the surprise is measured against: T-1h, or the newest one for an open market
  anchor: Snapshot | null;
}

export function KeyStrip({ event, status, anchor }: Props) {
  const unit = event.unit;
  const precise = (v: number) => formatValue(v, unit, true);
  const when = releaseWhen(event);

  return (
    <div className="key-strip" aria-label="Summary figures">
      <div className="key-block">
        <div className="key-label">Market expected ({anchor ? hourLabel(anchor.h) : "n/a"})</div>
        {anchor && anchor.p50 !== null ? (
          <>
            <Hero value={anchor.p50} unit={unit} className="val-market" />
            {anchor.p25 !== null && anchor.p75 !== null && (
              <div className="key-sub num">50% range {precise(anchor.p25)} to {precise(anchor.p75)}</div>
            )}
            {anchor.mean !== null && anchor.sd !== null && (
              <div className="key-sub-micro num">
                Median shown. Mean {precise(anchor.mean)}, SD {precise(anchor.sd)}
              </div>
            )}
          </>
        ) : (
          <TextHero>No estimate</TextHero>
        )}
      </div>

      <div className="key-block">
        <div className="key-label">First print</div>
        {status === "published" && event.first_print !== null ? (
          <>
            <Hero value={event.first_print} unit={unit} className="val-actual" />
            <div className="key-sub">
              {event.first_print_source === "alfred" ? "First release, from ALFRED" : "Kalshi settlement value"}
            </div>
            {event.first_print_source === "alfred" && event.settled_value !== null && (
              <div className="key-sub-micro num">
                {Math.abs(event.settled_value - event.first_print) < 1e-9
                  ? "Kalshi settled on the same value"
                  : `Kalshi settled on ${formatValue(event.settled_value, unit)}`}
              </div>
            )}
          </>
        ) : status === "upcoming" ? (
          <>
            <TextHero>{`Due ${when.date.replace(/ \d{4}$/, "")}`}</TextHero>
            <div className="key-sub">{when.time}</div>
          </>
        ) : (
          <>
            <TextHero>No outcome</TextHero>
            <div className="key-sub">None on record in this data</div>
          </>
        )}
      </div>

      <div className="key-block">
        <div className="key-label">Surprise</div>
        {event.surprise_sd !== null && event.surprise !== null ? (
          <>
            <div className={`t-hero ${event.surprise_sd >= 0 ? "val-surprise-up" : "val-surprise-down"}`}>
              {signed(event.surprise_sd, 1, " SD")}
            </div>
            <div className="key-sub">
              {event.surprise_sd > 0 ? "above" : event.surprise_sd < 0 ? "below" : "in line with"} the
              T&#8722;1h implied mean
            </div>
            <div className="key-sub-micro num">Print minus mean: {formatDelta(event.surprise, unit)}</div>
          </>
        ) : (
          <>
            <TextHero>{status === "upcoming" ? "Pending" : "N/A"}</TextHero>
            <div className="key-sub">
              {status === "upcoming" ? "measured once the number is out" : "nothing to compare with"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
