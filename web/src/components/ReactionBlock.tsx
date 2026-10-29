import type { Reaction } from "../data/types";
import { formatBp, formatIsoDate } from "../lib/format";
import type { EventStatus } from "../lib/snapshots";

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

  let title = "Measured after the release day";
  let summary = "The yield change appears once the release day's closing yields are in.";
  if (status === "not_published") {
    title = "No release day to measure";
    summary = "This release did not come out, so there is no release-day reaction.";
  }
  // an upcoming event can already have a release day, but no closing yields for it yet
  if (status !== "upcoming" && reaction && (!has2 || !has10)) {
    title = "No yield data for the release day";
    summary = `There is no closing yield for ${formatIsoDate(reaction.date)}, for example because the bond market was closed.`;
  }
  if (status !== "upcoming" && reaction && has2 && has10) {
    const two = reaction.dgs2_bp as number;
    const ten = reaction.dgs10_bp as number;
    title = `2-year yield ${direction(two)}, 10-year ${direction(ten)}`;
    summary =
      `Close on ${formatIsoDate(reaction.date)} against the close on ` +
      `${reaction.prev_date ? formatIsoDate(reaction.prev_date) : "the previous trading day"}.` +
      (isFomc
        ? " The statement came out at 14:00 ET, so this daily change also includes trading before the decision."
        : " The number came out at 08:30 ET, before trading opened, so the whole day reflects it.");
  }

  return (
    <section className="chart-figure reaction-block" aria-labelledby="reaction-title">
      <div className="section-kicker">Market reaction on release day</div>
      <h2 className="t-h3" id="reaction-title">{title}</h2>
      <p className="chart-summary num">{summary}</p>
      {status !== "upcoming" && reaction && has2 && has10 && (
        <div className="yield-pair num">
          <span><span className="yield-label">2Y</span>{formatBp(reaction.dgs2_bp as number)}</span>
          <span><span className="yield-label">10Y</span>{formatBp(reaction.dgs10_bp as number)}</span>
        </div>
      )}
      <div className="chart-footer">
        <span className="t-micro muted">
          Source: FRED DGS2 and DGS10, daily Treasury constant maturity yields. Sector ETF returns are planned.
        </span>
      </div>
    </section>
  );
}
