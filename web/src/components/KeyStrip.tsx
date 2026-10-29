import type { EventFile, Snapshot } from "../data/types";
import {
  formatBp,
  formatDelta,
  formatNumber,
  formatValue,
  hourLabel,
  pct,
  signed,
  unitParts,
} from "../lib/format";
import { releaseWhen, type EventStatus } from "../lib/snapshots";
import { CountUp } from "./CountUp";
import { Term } from "./Term";

function Hero({ value, unit, className }: { value: number; unit: string | null; className: string }) {
  const { lead, rest } = unitParts(unit);
  return (
    <div className={`t-hero ${className}`}>
      <span className="hero-num"><CountUp value={value} format={(v) => formatNumber(v, unit)} />{lead}</span>
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
        <div className="key-label">
          Market expected (<Term id="t-1h">{anchor ? hourLabel(anchor.h) : "n/a"}</Term>)
        </div>
        {anchor && anchor.p50 !== null ? (
          <>
            <Hero value={anchor.p50} unit={unit} className="val-market" />
            {anchor.p25 !== null && anchor.p75 !== null && (
              <div className="key-sub num">
                <Term id="range">50% range</Term> {precise(anchor.p25)} to {precise(anchor.p75)}
              </div>
            )}
            {anchor.mean !== null && anchor.sd !== null && (
              <div className="key-sub-micro num">
                <Term id="median">Median</Term> shown. Mean {precise(anchor.mean)},{" "}
                <Term id="sd">SD</Term> {precise(anchor.sd)}
              </div>
            )}
          </>
        ) : anchor && anchor.survival.length > 0 ? (
          <>
            <div className="t-hero val-market">
              <CountUp value={(anchor.survival[0] as [number, number, number])[2]} format={(v) => pct(v)} />
            </div>
            <div className="key-sub num">
              chance of above {formatValue((anchor.survival[0] as [number, number, number])[0], unit)}
            </div>
            <div className="key-sub-micro">
              {anchor.survival.length === 1 ? "Only one contract was listed" : `Only ${anchor.survival.length} contracts were listed`}
            </div>
          </>
        ) : (
          <TextHero>No estimate</TextHero>
        )}
      </div>

      <div className="key-block">
        <div className="key-label"><Term id="first-print">First print</Term></div>
        {status === "published" && event.first_print !== null ? (
          <>
            <Hero value={event.first_print} unit={unit} className="val-actual" />
            <div className="key-sub">
              {event.first_print_source === "alfred" ? (
                <>First release, from <Term id="alfred">ALFRED</Term></>
              ) : (
                "Kalshi settlement value"
              )}
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
        <div className="key-label"><Term id="surprise">Surprise</Term></div>
        {event.surprise_sd !== null && event.surprise !== null ? (
          <>
            <div className={`t-hero ${event.surprise_sd >= 0 ? "val-surprise-up" : "val-surprise-down"}`}>
              <CountUp value={event.surprise_sd} format={(v) => signed(v, 1, " SD")} />
            </div>
            <div className="key-sub">
              {Math.abs(event.surprise_sd) < 0.05 ? "in line with" : event.surprise_sd > 0 ? "above" : "below"} the
              T&#8722;1h implied mean
            </div>
            <div className="key-sub-micro num">Print minus mean: {formatDelta(event.surprise, unit)}</div>
            {event.reaction?.dgs2_bp != null && event.reaction.dgs10_bp != null && (
              <div className="key-sub-micro num">
                Release day: <Term id="yield">2y</Term> {formatBp(event.reaction.dgs2_bp)}, 10y{" "}
                {formatBp(event.reaction.dgs10_bp)}
              </div>
            )}
          </>
        ) : (
          <>
            <TextHero>{status === "upcoming" ? "Pending" : "N/A"}</TextHero>
            <div className="key-sub">
              {status === "upcoming"
                ? "measured once the number is out"
                : anchor && anchor.p50 === null && anchor.survival.length > 0
                  ? "needs a full set of odds"
                  : "nothing to compare with"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
