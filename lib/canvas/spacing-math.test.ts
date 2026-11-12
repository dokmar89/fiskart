import { describe, expect, it } from "vitest";
import { spacingSnap } from "./spacing-math";

const box = (left: number, top: number, width = 100, height = 100) => ({ left, top, width, height });

describe("spacingSnap", () => {
  it("centres a box between its neighbours in a row", () => {
    // Neighbours end at 100 and start at 500: a 100 wide box fits with 150 on each side at 250.
    const r = spacingSnap(box(246, 0), [box(0, 0), box(500, 0)], "x", 6);
    expect(r.shift).toBe(4);
    expect(r.marks).toEqual([
      { axis: "x", start: 100, end: 250, at: 50 },
      { axis: "x", start: 350, end: 500, at: 50 },
    ]);
  });

  it("repeats the gap of the two boxes before it", () => {
    // Gap 50 between the first two; the third goes 50 after the second (at 300).
    const r = spacingSnap(box(303, 20), [box(0, 0), box(150, 0)], "x", 6);
    expect(r.shift).toBe(-3);
    expect(r.marks).toHaveLength(2);
    expect(r.marks[1]).toMatchObject({ start: 250, end: 300 });
  });

  it("repeats the gap of the two boxes after it", () => {
    const r = spacingSnap(box(-48, 0), [box(100, 0), box(250, 0)], "x", 6);
    expect(r.shift).toBe(-2);
  });

  it("ignores boxes outside the row", () => {
    expect(spacingSnap(box(246, 0), [box(0, 300), box(500, 0)], "x", 6)).toEqual({ shift: 0, marks: [] });
  });

  it("works on columns", () => {
    const r = spacingSnap(box(0, 252), [box(0, 0), box(0, 500)], "y", 6);
    expect(r.shift).toBe(-2);
    expect(r.marks[0]).toMatchObject({ axis: "y", start: 100, end: 250 });
  });

  it("does nothing beyond the threshold", () => {
    expect(spacingSnap(box(230, 0), [box(0, 0), box(500, 0)], "x", 6).shift).toBe(0);
  });
});
