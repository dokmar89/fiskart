import { describe, expect, it } from "vitest";
import { distanceToPolyline, pathPoints, sweep } from "./erase-math";

describe("pathPoints", () => {
  it("collects end and control points in order", () => {
    expect(pathPoints([["M", 0, 0], ["Q", 5, 5, 10, 0], ["L", 20, 0]])).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
  });
});

describe("distanceToPolyline", () => {
  const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  it("measures to the nearest segment", () => {
    expect(distanceToPolyline(line, { x: 50, y: 10 })).toBe(10);
    expect(distanceToPolyline(line, { x: 110, y: 50 })).toBe(10);
    expect(distanceToPolyline(line, { x: -3, y: -4 })).toBe(5);
  });
  it("handles single points and empty paths", () => {
    expect(distanceToPolyline([{ x: 0, y: 0 }], { x: 3, y: 4 })).toBe(5);
    expect(distanceToPolyline([], { x: 0, y: 0 })).toBe(Infinity);
  });
});

describe("sweep", () => {
  it("fills in points along a fast move", () => {
    const points = sweep({ x: 0, y: 0 }, { x: 30, y: 0 }, 10);
    expect(points.map((p) => p.x)).toEqual([0, 10, 20, 30]);
  });
});
