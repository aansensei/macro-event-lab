import { useCallback, useEffect, useState } from "react";

type Resource<T> = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: T };

export function useResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<Resource<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    Promise.resolve().then(loader).then((data) => {
      if (active) setState({ kind: "ready", data });
    }).catch((error: unknown) => {
      if (active) setState({ kind: "error", message: error instanceof Error ? error.message : "The data request failed." });
    });
    return () => { active = false; };
  }, [loader, attempt]);
  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  }, []);
  return { state, retry };
}
