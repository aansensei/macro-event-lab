import { ARENA_NOT_BUILT } from "../data/arena";

export function ArenaPending({ onRetry }: { onRetry: () => void }) {
  return <section className="state-banner" role="status" aria-labelledby="arena-pending-title">
    <h2 id="arena-pending-title" className="t-h3">Forecast results are not available yet</h2>
    <p>{ARENA_NOT_BUILT}. Historical forecasts and scores have not been published.</p>
    <p>Explore <a href="?page=revisions">Revisions</a> or the <a href="?page=models">GDP nowcast</a> while results are unavailable.</p>
    <button type="button" className="play-btn" onClick={(event) => {
      event.currentTarget.closest<HTMLElement>("main")?.focus({ preventScroll: true });
      onRetry();
    }}>Check again</button>
  </section>;
}
