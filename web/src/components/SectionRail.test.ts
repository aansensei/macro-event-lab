// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { RailPage } from "./SectionRail";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const sections = [{ id: "a", label: "First" }, { id: "b", label: "Missing" }, { id: "c", label: "Third" }];
const rail = (children: ReturnType<typeof createElement>) => createElement(RailPage, { sections, children });

it("lists only the sections that exist on the page", async () => {
  await act(async () => root.render(rail(
    createElement("div", null, createElement("h2", { id: "a" }, "A"), createElement("h2", { id: "c" }, "C")))));
  const labels = [...host.querySelectorAll(".section-rail a")].map((a) => a.textContent);
  expect(labels).toEqual(["First", "Third"]);
  expect(host.querySelector(".with-rail")).not.toBeNull();
});

it("adds a section to the rail once it appears", async () => {
  await act(async () => root.render(rail(createElement("h2", { id: "a" }, "A"))));
  expect([...host.querySelectorAll(".section-rail a")].map((a) => a.textContent)).toEqual(["First"]);
  await act(async () => root.render(rail(
    createElement("div", null, createElement("h2", { id: "a" }, "A"), createElement("h2", { id: "b" }, "B")))));
  expect([...host.querySelectorAll(".section-rail a")].map((a) => a.textContent)).toEqual(["First", "Missing"]);
});
