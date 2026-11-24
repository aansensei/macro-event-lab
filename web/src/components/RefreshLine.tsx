import { useMemo } from "react";

import { loadStatus, type StatusData } from "../data/status";
import { useResource } from "../hooks/useResource";
import { refreshLine, type RefreshStatus } from "../lib/refreshLine";
import { ExternalLink } from "./ExternalLink";
import { Icon } from "./Icon";

interface RefreshLineProps {
  status?: RefreshStatus | null;
  nowIso?: string;
}

function RefreshLineView({ status, nowIso }: { status: RefreshStatus | null; nowIso: string }) {
  const line = refreshLine(status, nowIso);
  if (line.state === "missing") {
    return <p className="refresh-line refresh-line-missing">{line.text}</p>;
  }
  return (
    <p className="refresh-line">
      <span className={`refresh-state refresh-state-${line.state}`}>
        <Icon name={line.state === "current" ? "circle-check" : "circle-alert"} size={14} />
        {line.state}
      </span>
      <span className="refresh-line-text">{line.text}</span>
      {line.runUrl !== null && (
        <ExternalLink className="refresh-line-link" href={line.runUrl}>Build log</ExternalLink>
      )}
    </p>
  );
}

function LoadedRefreshLine({ nowIso }: { nowIso: string }) {
  const { state } = useResource<StatusData>(loadStatus);
  if (state.kind === "loading") return null;
  const status = state.kind === "ready" ? state.data : null;
  return <RefreshLineView status={status} nowIso={nowIso} />;
}

// displays when public data was last rebuilt, its freshness state and an optional build log link
export function RefreshLine({ status, nowIso }: RefreshLineProps) {
  const effectiveNow = useMemo(() => nowIso ?? new Date().toISOString(), [nowIso]);
  if (status !== undefined) {
    return <RefreshLineView status={status} nowIso={effectiveNow} />;
  }
  return <LoadedRefreshLine nowIso={effectiveNow} />;
}
