import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArenaIntro } from "./ArenaIntro";

const render = (contestantIds: string[]) =>
  renderToStaticMarkup(createElement(ArenaIntro, { informationDate: "2026-11-24", contestantIds }));

describe("ArenaIntro", () => {
  it("describes available periods without ranking or counting planned contestants", () => {
    const html = render(["naive", "ar", "ridge", "spf"]);
    expect(html).toContain("Results describe the periods available so far and rank nobody.");
    expect(html).not.toContain("planned contestants");
  });

  it("credits the survey and states it is not endorsed when the survey contestant is shown", () => {
    const html = render(["naive", "spf"]);
    expect(html).toContain("Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF)");
    expect(html).toContain("not sponsored, endorsed or approved");
    expect(render(["naive", "ar"])).not.toContain("Philadelphia");
  });

  it("says how many contestants have a score for each target", () => {
    const html = renderToStaticMarkup(createElement(ArenaIntro, {
      informationDate: "2026-11-24", contestantIds: ["naive", "ar"],
      perTarget: [{ label: "GDP growth", count: 6 }, { label: "Inflation", count: 2 }],
    }));
    expect(html).toContain("Results describe the periods available so far and rank nobody.");
    expect(html).toContain("Contestants with a score so far: GDP growth 6, Inflation 2.");
  });
});
