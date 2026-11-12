import { describe, expect, it } from "vitest";
import { arrowPath, starPoints } from "./shape-math";

describe("starPoints", () => {
  it("alternates outer and inner radius and starts at the top", () => {
    const points = starPoints(5, 100, 40);
    expect(points).toHaveLength(10);
    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].y).toBeCloseTo(-100);
    points.forEach((p, i) => {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(i % 2 === 0 ? 100 : 40);
    });
  });
});

describe("arrowPath", () => {
  it("ends the shaft and the head at the tip", () => {
    expect(arrowPath(200, 20)).toBe("M 0 0 L 200 0 M 180 -20 L 200 0 L 180 20");
  });
});
