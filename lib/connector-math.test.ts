import { describe, expect, it } from "vitest";
import { anchorPoint, elbowRoute, headShape, nearestAnchor, simplify } from "./connector-math";

const box = { left: 100, top: 100, width: 200, height: 100 };

describe("anchors", () => {
  it("are the side midpoints and the centre", () => {
    expect(anchorPoint(box, "top")).toEqual({ x: 200, y: 100 });
    expect(anchorPoint(box, "right")).toEqual({ x: 300, y: 150 });
    expect(anchorPoint(box, "center")).toEqual({ x: 200, y: 150 });
  });

  it("picks the nearest one within reach, or the nearest side when dropped on the shape", () => {
    expect(nearestAnchor(box, { x: 305, y: 148 }, 10)).toBe("right");
    expect(nearestAnchor(box, { x: 400, y: 400 }, 10)).toBeNull();
    expect(nearestAnchor(box, { x: 120, y: 190 }, 10)).toBe("bottom");
  });
});

describe("elbowRoute", () => {
  it("is a straight line when free ends are level", () => {
    expect(elbowRoute({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  });

  it("turns halfway between free ends, along the longer distance first", () => {
    expect(elbowRoute({ x: 0, y: 0 }, { x: 200, y: 100 })).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
  });

  it("leaves and enters attached sides straight, with only horizontal and vertical segments", () => {
    const route = elbowRoute({ x: 0, y: 0 }, { x: 200, y: 200 }, "right", "top", 20);
    // Out to the right of the start, down into the end from above.
    expect(route[1].y).toBe(0);
    expect(route[1].x).toBeGreaterThanOrEqual(20);
    expect(route[route.length - 2].x).toBe(200);
    expect(route[route.length - 2].y).toBeLessThanOrEqual(180);
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1];
      const b = route[i];
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
  });

  it("goes back round when the end is behind the start", () => {
    expect(elbowRoute({ x: 100, y: 0 }, { x: 0, y: 50 }, "right", "left", 20)).toEqual([
      { x: 100, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 25 },
      { x: -20, y: 25 },
      { x: -20, y: 50 },
      { x: 0, y: 50 },
    ]);
  });
});

describe("simplify", () => {
  it("drops repeats and straight-run middles", () => {
    expect(simplify([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }])).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ]);
  });
});

describe("headShape", () => {
  it("points an arrow along the line", () => {
    const { polygon } = headShape("arrow", { x: 100, y: 0 }, { x: 0, y: 0 }, 10);
    expect(polygon).toEqual([{ x: 100, y: 0 }, { x: 90, y: 5 }, { x: 90, y: -5 }]);
  });

  it("centres circles and squares on the end", () => {
    expect(headShape("circle", { x: 5, y: 5 }, { x: 0, y: 5 }, 8).circle).toEqual({ center: { x: 5, y: 5 }, radius: 4 });
    expect(headShape("square", { x: 0, y: 0 }, { x: -1, y: 0 }, 2).polygon).toHaveLength(4);
    expect(headShape("none", { x: 0, y: 0 }, { x: -1, y: 0 }, 2)).toEqual({});
  });
});
