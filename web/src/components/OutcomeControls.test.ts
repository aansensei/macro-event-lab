// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { OutcomeControls } from "./OutcomeControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("supports the ordered reveal, restart and optional skip without controlling the snapshot hour", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const onChange = vi.fn();
  try {
    for (const [stage, next] of [[2, 0], [0, 1], [1, 2]] as const) {
      await act(async () => root.render(createElement(OutcomeControls, { stage, onChange })));
      await act(async () => host.querySelector<HTMLButtonElement>(".outcome-primary")!.click());
      expect(onChange).toHaveBeenLastCalledWith(next);
    }
    await act(async () => host.querySelector<HTMLButtonElement>(".text-btn")!.click());
    expect(onChange).toHaveBeenLastCalledWith(0);
    await act(async () => root.render(createElement(OutcomeControls, { stage: 0, onChange })));
    await act(async () => host.querySelector<HTMLButtonElement>(".text-btn")!.click());
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(host.querySelector('[aria-live="polite"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); }
});
