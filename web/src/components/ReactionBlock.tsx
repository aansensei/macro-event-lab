import type { Reaction } from "../data/types";
import { formatBp, formatIsoDate } from "../lib/format";
import type { EventStatus } from "../lib/snapshots";
import { ExternalLink } from "./ExternalLink";

interface Props {
  reaction: Reaction | null;
  status: EventStatus;
  isFomc: boolean;
}

function direction(bp: number): string {
  if (Math.abs(bp) < 0.5) return "was unchanged";
  return bp > 0 ? `rose ${formatBp(bp).slice(1)}` : `fell ${formatBp(bp).slice(1)}`;
}

// how the 2 and 10 year Treasury yields moved on the release day, from daily closes
export function ReactionBlock({ reaction, status, isFomc }: Props) {
  const has2 = reaction?.dgs2_bp !== null && reaction?.dgs2_bp !== undefined;
  const has10 = reaction?.dgs10_bp !== null && reaction?.dgs10_bp !== undefined;

  let title = "Daily yields unavailable";
  let summary = "Comparable daily Treasury yield observations are not available in this data.";
  if (status === "upcoming") {
    title = "Measured after the release day";
    summary = "The daily yield change appears once the release day's observations are available.";
  } else if (status === "not_published") {
    title = "No recorded release outcome";
    summary = "This dataset has no published result for the event, so a release-day comparison is not shown.";
  } else if (reaction && (has2 || has10)) {
    title = [has2 ? `2-year yield ${direction(reaction.dgs2_bp as number)}` : "2-year yield unavailable",
      has10 ? `10-year ${direction(reaction.dgs10_bp as number)}` : "10-year yield unavailable"].join(", ");
    summary = `Daily reading for ${formatIsoDate(reaction.date)} minus the reading for ` +
      `${reaction.prev_date ? formatIsoDate(reaction.prev_date) : "the previous available trading day"}. ` +
      (isFomc ? "This change also includes trading before the Fed announcement. " : "") +
      "Other news and trading during the day also contribute. This comparison does not isolate the announcement's effect.";
  }

  return (
    <section className="chart-figure reaction-block" aria-labelledby="reaction-title">
      <div className="section-kicker">Daily Treasury yield changes</div>
      <h2 className="t-h3" id="reaction-title">{title}</h2>
      <p className="chart-summary num">{summary}</p>
      {status === "published" && reaction && (has2 || has10) && (
        <div className="yield-pair num">
          {has2 && <span><span className="yield-label">2Y</span>{formatBp(reaction.dgs2_bp as number)}</span>}
          {has10 && <span><span className="yield-label">10Y</span>{formatBp(reaction.dgs10_bp as number)}</span>}
        </div>
      )}
      <div className="chart-footer">
        <span className="t-micro muted">
          Source: FRED DGS2 and DGS10, daily Treasury constant maturity yields. See the{" "}
          <ExternalLink href="https://www.federalreserve.gov/releases/h15/">Federal Reserve H.15 notes</ExternalLink>.
        </span>
      </div>
    </section>
  );
}
