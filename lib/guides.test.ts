import { describe, expect, it } from "vitest";
import { NO_GUIDES, readGuides, rulerTicks, withGuide } from "./guides";

describe("readGuides", () => {
  it("keeps valid lists and drops junk", () => {
    expect(readGuides({ vertical: [10, 20.5], horizontal: [3] })).toEqual({ vertical: [10, 20.5], horizontal: [3] });
    expect(readGuides({ vertical: [1, "x"], horizontal: null })).toEqual(NO_GUIDES);
    expect(readGuides(undefined)).toEqual(NO_GUIDES);
  });
});

describe("withGuide", () => {
  it("adds, moves and removes", () => {
    const added = withGuide(NO_GUIDES, "vertical", null, 100.123);
    expect(added).toEqual({ vertical: [100.12], horizontal: [] });
    expect(withGuide(added, "vertical", 0, 50)).toEqual({ vertical: [50], horizontal: [] });
    expect(withGuide(added, "vertical", 0, null)).toEqual(NO_GUIDES);
  });
});

describe("rulerTicks", () => {
  it("labels round pixel values at a readable distance", () => {
    // At 50 % zoom, 60 screen px are 120 page px: labels every 200 px, ticks every 50.
    const ticks = rulerTicks(0, 0.5, 300, "px");
    const labelled = ticks.filter((t) => t.label !== null);
    expect(labelled.slice(0, 3)).toEqual([
      { at: 0, label: "0" },
      { at: 100, label: "200" },
      { at: 200, label: "400" },
    ]);
    expect(ticks[1]).toEqual({ at: 25, label: null });
  });

  it("starts where the view starts, with negative positions left of the page", () => {
    const labelled = rulerTicks(-150, 1, 400, "px").filter((t) => t.label !== null);
    expect(labelled[0]).toEqual({ at: 50, label: "-100" });
    expect(labelled[1]).toEqual({ at: 150, label: "0" });
  });

  it("uses the display unit", () => {
    // 1 in = 96 px; at zoom 1 labels every inch.
    const labelled = rulerTicks(0, 1, 200, "in").filter((t) => t.label !== null);
    expect(labelled.map((t) => [Math.round(t.at), t.label])).toEqual([
      [0, "0"],
      [96, "1"],
      [192, "2"],
    ]);
    // Millimetres at a high zoom get fractional labels.
    expect(rulerTicks(0, 40, 400, "mm").find((t) => t.label === "0.5")).toBeDefined();
  });
});
