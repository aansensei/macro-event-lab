import type { RevealStage } from "../lib/url";

export function OutcomeControls({ stage, onChange }: { stage: RevealStage; onChange: (stage: RevealStage) => void }) {
  return <section className="outcome-controls" aria-label="Read before the result">
    <div><h2 className="t-h3">{stage === 0 ? "Read the market first." : stage === 1 ? "Now compare the first print." : "Explore the release in your own order."}</h2>
      <p aria-live="polite">{stage === 0 ? "The result, surprise and yield changes are hidden. Move the slider to inspect the priced odds."
        : stage === 1 ? "The first print is visible. Daily yield changes stay hidden until you reveal them."
          : "Hide the result to focus on the odds, then reveal the first print and daily yields."}</p></div>
    <div className="outcome-actions">
      <button type="button" className="outcome-primary" onClick={() => onChange(stage === 2 ? 0 : stage === 0 ? 1 : 2)}>
        {stage === 2 ? "Read without the result" : stage === 0 ? "Reveal first print" : "Reveal daily yields"}
      </button>
      {stage < 2 && <button type="button" className="text-btn" onClick={() => onChange(stage === 0 ? 2 : 0)}>
        {stage === 0 ? "Show all results" : "Hide first print"}
      </button>}
    </div>
  </section>;
}
