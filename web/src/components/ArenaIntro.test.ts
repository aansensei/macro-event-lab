import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArenaIntro } from "./ArenaIntro";

const render = (contestantIds: string[]) =>
  renderToStaticMarkup(createElement(ArenaIntro, { informationDate: "2026-11-24", contestantIds }));

describe("ArenaIntro", () => {
  it("marks results as preliminary while fewer than eight contestants have run", () => {
    const html = render(["naive", "ar", "ridge", "spf"]);
    expect(html).toContain("Preliminary results. 4 of the 8 planned contestants");
  });

  it("drops the preliminary notice once all eight contestants have run", () => {
    const ids = ["naive", "ar", "ridge", "factor_ridge", "lasso", "foundation_a", "foundation_b", "spf"];
    expect(render(ids)).not.toContain("Preliminary");
  });

  it("credits the survey and states it is not endorsed when the survey contestant is shown", () => {
    const html = render(["naive", "spf"]);
    expect(html).toContain("Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF)");
    expect(html).toContain("not sponsored, endorsed or approved");
    expect(render(["naive", "ar"])).not.toContain("Philadelphia");
  });
});
