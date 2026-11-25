import { useState } from "react";

import { ArenaChart } from "../components/ArenaChart";
import { ArenaIntro } from "../components/ArenaIntro";
import { ArenaLeaderboard } from "../components/ArenaLeaderboard";
import { ArenaPending } from "../components/ArenaPending";
import { LeakageTable } from "../components/LeakageTable";
import { MoreScoresTable } from "../components/MoreScoresTable";
import { NestedTestsTable } from "../components/NestedTestsTable";
import { PageGuide } from "../components/PageGuide";
import { CoverageCalibration } from "../components/CoverageCalibration";
import { PlayInvite } from "../components/PlayInvite";
import { RailPage, type RailSection } from "../components/SectionRail";
import { StoryNext, StoryPath } from "../components/Story";
import { LiveForecast } from "../components/LiveForecast";
import { ResourceError } from "../components/ResourceError";
import { Select } from "../components/Select";
import { TargetSwitch } from "../components/TargetSwitch";
import { WindowToggle } from "../components/WindowToggle";
import { ARENA_NOT_BUILT, loadArena, type ArenaWindow, type TargetId } from "../data/arena";
import { useResource } from "../hooks/useResource";
import { contestantsPerTarget, leaderboardRows } from "../lib/arenaStats";
import { ARENA_GUIDE } from "../lib/arenaWords";

const RAIL: RailSection[] = [
  { id: "arena-top", label: "Top" },
  { id: "arena-leaderboard", label: "Leaderboard" },
  { id: "arena-history", label: "History" },
  { id: "arena-leakage", label: "Leakage" },
  { id: "arena-live", label: "Next release" },
  { id: "arena-guide", label: "How to read" },
];

export function Arena() {
  const { state, retry } = useResource(loadArena);
  const [targetId, setTarget] = useState<TargetId>("gdp");
  const [window, setWindow] = useState<ArenaWindow>("all");
  const [contestantId, setContestant] = useState<string | null>(null);
  if (state.kind !== "ready") return <div className="arena-page page-fade">
    <p className="section-kicker">Forecast arena</p><h1 className="t-h1">How do forecasts compare with first-published numbers?</h1>
    {state.kind === "loading" ? <p className="state-banner" role="status">Loading forecast arena data.</p>
      : state.message === ARENA_NOT_BUILT ? <ArenaPending onRetry={retry} />
      : <ResourceError title={state.message.startsWith("Unsupported") ? "Unsupported data format" : "Forecast arena data could not be loaded"} message={state.message} onRetry={retry} />}
  </div>;
  const data = state.data;
  const target = data.targets.find((target) => target.id === targetId) ?? data.targets[0];
  const rows = target ? leaderboardRows(data, target.id, window) : [];
  const contestant = data.contestants.find((entry) => entry.id === contestantId)
    ?? data.contestants.find((entry) => entry.kind === "classical" || entry.kind === "foundation") ?? data.contestants[0];
  return <RailPage sections={RAIL}><div className="arena-page page-fade">
    <StoryPath current="arena" />
    <ArenaIntro informationDate={data.information_date} contestantIds={data.contestants.map((c) => c.id)} perTarget={contestantsPerTarget(data)} />
    <PageGuide
      purpose="See how close each forecaster and model came to the number first published, release after release."
      lookAt="The leaderboard first (a lower RMSE means closer), then the history chart for one contestant, then the worst period share."
      limit="Which method is best. The results are preliminary, the periods are few, and one extreme period can drive an average." />
    <PlayInvite />
    {!target ? <p className="state-banner">No economic targets are available yet.</p> : <>
      <TargetSwitch targets={data.targets} selected={target.id} onChange={setTarget} />
      <section className="arena-section" aria-labelledby="arena-leaderboard">
        <h2 className="t-h3" id="arena-leaderboard">Forecast leaderboard</h2>
        <WindowToggle value={window} onChange={setWindow} />
        {window === "clean" && <p className="muted">Clean periods follow each contestant's training cutoff, or include all periods when it has no cutoff. Period sets can differ and may be short.</p>}
        <ArenaLeaderboard rows={rows} target={target} />
        <MoreScoresTable rows={rows} target={target} />
        <NestedTestsTable tests={data.nested_tests ?? []} contestants={data.contestants} target={target} window={window} />
        <CoverageCalibration rows={data.calibration ?? []} contestants={data.contestants} target={target} />
      </section>
      <section className="arena-section" aria-labelledby="arena-history">
        <h2 className="t-h3" id="arena-history">First published number against forecasts</h2>
        {contestant && <div className="arena-contestant-select"><Select label="Chart contestant" value={contestant.id} options={data.contestants.map((entry) => ({ value: entry.id, label: entry.label }))} onChange={setContestant} /></div>}
        <ArenaChart key={`${target.id}:${contestant?.id ?? "none"}`} target={target} points={data.forecasts.filter((point) => point.target === target.id)} contestant={contestant} />
      </section>
      <LeakageTable contestants={data.contestants} leakage={data.leakage} />
      <LiveForecast target={target} contestants={data.contestants} rows={data.live} />
      <section className="arena-section" aria-labelledby="arena-guide"><h2 id="arena-guide" className="t-h3">How to read this page</h2>
        <p>{ARENA_GUIDE}</p><p className="muted">Rankings and relative errors describe the supplied records. A short evaluation window and dependence between economic releases limit inference. The table does not establish a winning method.</p>
      </section>
      <StoryNext current="arena" />
    </>}
  </div></RailPage>;
}
