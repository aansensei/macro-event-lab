// Wave 1 shell: proves the real JSON loads and validates. The Event Explorer replaces it.

import { useEffect, useState } from "react";

import { loadManifest } from "./data/load";
import type { Manifest } from "./data/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; manifest: Manifest };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    loadManifest()
      .then((manifest) => setState({ kind: "ready", manifest }))
      .catch((err: Error) => setState({ kind: "error", message: err.message }));
  }, []);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Macro Event Lab</h1>
      {state.kind === "loading" && <p>Loading event data</p>}
      {state.kind === "error" && (
        <p role="alert">
          {state.message}. Build the data with <code>python -m macro_event_lab build</code>, then
          run <code>npm run sync-data</code>.
        </p>
      )}
      {state.kind === "ready" && (
        <>
          <p>
            {state.manifest.events.length} events, data through {state.manifest.data_through}.
          </p>
          <ul>
            {state.manifest.events.slice(-10).reverse().map((e) => (
              <li key={e.id}>
                {e.title}: first print {e.first_print ?? "not published"}, surprise{" "}
                {e.surprise_sd === null ? "n/a" : `${e.surprise_sd.toFixed(2)} SD`}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
