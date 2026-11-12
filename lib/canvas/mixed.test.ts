import { describe, expect, it } from "vitest";
import { MIXED, merge } from "./mixed";

describe("merge", () => {
  it("returns the shared value", () => {
    expect(merge(["#fff", "#fff"])).toBe("#fff");
    expect(merge([0.5, 0.5000001])).toBe(0.5);
    expect(merge([{ type: "linear", angle: 0 }, { type: "linear", angle: 0 }])).toEqual({ type: "linear", angle: 0 });
  });

  it("returns MIXED when values differ", () => {
    expect(merge(["#fff", "#000"])).toBe(MIXED);
    expect(merge([1, 2])).toBe(MIXED);
    expect(merge([null, "#000"])).toBe(MIXED);
  });

  it("returns undefined for an empty selection", () => {
    expect(merge([])).toBeUndefined();
  });
});
