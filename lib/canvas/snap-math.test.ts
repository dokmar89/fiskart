import { describe, expect, it } from "vitest";
import { snap, snapTargets } from "./snap-math";

const page = { width: 1000, height: 800 };

describe("snap", () => {
  it("snaps an edge to the page edge within the threshold", () => {
    const r = snap({ left: 4, top: 300, width: 100, height: 50 }, snapTargets([], page), 6);
    expect(r.dx).toBe(-4);
    expect(r.dy).toBe(0);
    expect(r.guides).toContainEqual({ orientation: "vertical", pos: 0, start: 0, end: 800 });
  });

  it("snaps the centre to the page centre on both axes", () => {
    const r = snap({ left: 447, top: 377, width: 100, height: 50 }, snapTargets([], page), 6);
    expect(r.dx).toBe(3);
    expect(r.dy).toBe(-2);
    expect(r.guides.map((g) => g.orientation).sort()).toEqual(["horizontal", "vertical"]);
  });

  it("does nothing beyond the threshold", () => {
    const r = snap({ left: 20, top: 300, width: 100, height: 50 }, snapTargets([], page), 6);
    expect(r).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it("snaps to another object's edges and draws the guide across both", () => {
    const other = { left: 600, top: 100, width: 200, height: 100 };
    // Moving box's left edge is 3 px right of the other's right edge (800).
    const r = snap({ left: 803, top: 500, width: 50, height: 50 }, snapTargets([other], page), 6);
    expect(r.dx).toBe(-3);
    const guide = r.guides.find((g) => g.orientation === "vertical" && g.pos === 800)!;
    expect(guide.start).toBe(100);
    expect(guide.end).toBe(550);
  });

  it("prefers the nearest line", () => {
    const others = [{ left: 105, top: 0, width: 10, height: 10 }];
    const r = snap({ left: 103, top: 300, width: 50, height: 50 }, snapTargets(others, page), 6);
    expect(r.dx).toBe(2);
  });
});
