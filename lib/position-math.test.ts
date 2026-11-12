import { describe, expect, it } from "vitest";
import { normalizeAngle, resizeBox } from "./position-math";

describe("normalizeAngle", () => {
  it("brings angles into 0 to 360", () => {
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(725)).toBe(5);
    expect(normalizeAngle(-30)).toBe(330);
  });
});

describe("resizeBox", () => {
  it("keeps the ratio when locked", () => {
    expect(resizeBox({ width: 200, height: 100 }, { width: 100 }, true)).toEqual({ width: 100, height: 50 });
    expect(resizeBox({ width: 200, height: 100 }, { height: 300 }, true)).toEqual({ width: 600, height: 300 });
  });

  it("changes one side when unlocked and never goes below the minimum", () => {
    expect(resizeBox({ width: 200, height: 100 }, { width: 120 }, false)).toEqual({ width: 120, height: 100 });
    expect(resizeBox({ width: 200, height: 100 }, { height: -5 }, false)).toEqual({ width: 200, height: 1 });
  });
});
