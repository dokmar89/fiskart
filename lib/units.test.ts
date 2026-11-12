import { describe, expect, it } from "vitest";
import { formatSize, fromPx, toPx } from "./units";

describe("units", () => {
  it("converts A4 in millimetres to pixels at 96 DPI", () => {
    expect(toPx(210, "mm")).toBeCloseTo(793.7, 1);
    expect(toPx(297, "mm")).toBeCloseTo(1122.5, 1);
  });

  it("round-trips through pixels", () => {
    expect(fromPx(toPx(8.5, "in"), "in")).toBeCloseTo(8.5, 10);
    expect(fromPx(toPx(123, "mm"), "mm")).toBeCloseTo(123, 10);
    expect(fromPx(toPx(12.5, "cm"), "cm")).toBeCloseTo(12.5, 10);
  });

  it("formats sizes in the display unit", () => {
    expect(formatSize(1080, 1080, "px")).toBe("1080 × 1080 px");
    expect(formatSize(toPx(210, "mm"), toPx(297, "mm"), "mm")).toBe("210 × 297 mm");
    expect(formatSize(816, 1056, "in")).toBe("8.5 × 11 in");
    expect(formatSize(toPx(12.5, "cm"), toPx(20, "cm"), "cm")).toBe("12.5 × 20 cm");
  });
});
