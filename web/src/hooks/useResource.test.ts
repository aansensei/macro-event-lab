// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ResourceError } from "../components/ResourceError";
import { useResource } from "./useResource";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

function Reading({ loader }: { loader: () => Promise<string> }) {
  const { state, retry } = useResource(loader);
  return createElement("main", { tabIndex: -1 },
    state.kind === "error" ? createElement(ResourceError, { title: "Could not load the reading", message: state.message, onRetry: retry })
      : createElement("output", null, state.kind === "loading" ? "Loading" : state.data),
    createElement("button", { "data-retry": true, onClick: retry }, "Reload"));
}

beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("recovers from an error through its designed retry control", async () => {
  const loader = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error("Source unavailable")).mockResolvedValue("Recovered");
  await act(async () => root.render(createElement(Reading, { loader })));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Source unavailable");
  const button = host.querySelector<HTMLButtonElement>('[role="alert"] button')!;
  expect(button.textContent).toBe("Try again");
  button.focus();
  await act(async () => button.click());
  expect(host.querySelector("output")?.textContent).toBe("Recovered");
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(document.activeElement).toBe(host.querySelector("main"));
  expect(loader).toHaveBeenCalledTimes(2);
});

it("ignores an older response after a retry", async () => {
  let finish!: (value: string) => void;
  const loader = vi.fn<() => Promise<string>>().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
    .mockResolvedValue("Current");
  await act(async () => root.render(createElement(Reading, { loader })));
  expect(host.querySelector("output")?.textContent).toBe("Loading");
  await act(async () => host.querySelector<HTMLButtonElement>("[data-retry]")!.click());
  await act(async () => finish("Outdated"));
  expect(host.querySelector("output")?.textContent).toBe("Current");
});

it("ignores an old rejection after the loader changes", async () => {
  let reject!: (error: Error) => void;
  const old = () => new Promise<string>((_, fail) => { reject = fail; });
  const current = async () => "Current";
  await act(async () => root.render(createElement(Reading, { loader: old })));
  await act(async () => root.render(createElement(Reading, { loader: current })));
  await act(async () => reject(new Error("Old failure")));
  expect(host.querySelector("output")?.textContent).toBe("Current");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it("handles synchronous and non-Error failures without an unhandled rejection", async () => {
  const loader = vi.fn<() => Promise<string>>().mockImplementationOnce(() => { throw new Error("Synchronous failure"); })
    .mockRejectedValueOnce(null).mockResolvedValue("Recovered");
  await act(async () => root.render(createElement(Reading, { loader })));
  expect(host.textContent).toContain("Synchronous failure");
  await act(async () => host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
  expect(host.textContent).toContain("The data request failed.");
  await act(async () => host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
  expect(host.querySelector("output")?.textContent).toBe("Recovered");
});

it("discards an in-flight result after the consumer unmounts", async () => {
  let finish!: (value: string) => void;
  const loader = () => new Promise<string>((resolve) => { finish = resolve; });
  await act(async () => root.render(createElement(Reading, { loader })));
  await act(async () => root.render(null));
  await act(async () => finish("Late result"));
  expect(host.textContent).toBe("");
});
