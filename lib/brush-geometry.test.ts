import { describe, expect, it } from "vitest";
import { chiselPath, snapDrawingPoint } from "./brush-geometry";

describe("drawing helpers", () => {
  it("snaps a Shift stroke to the nearer horizontal or vertical axis", () => {
    expect(snapDrawingPoint({ x: 10, y: 20 }, { x: 90, y: 24 })).toEqual({ x: 90, y: 20 });
    expect(snapDrawingPoint({ x: 10, y: 20 }, { x: 14, y: 80 })).toEqual({ x: 10, y: 80 });
  });
  it("makes a closed chisel outline whose thickness follows pressure", () => {
    const path = chiselPath([{ x: 0, y: 0, pressure: 0.2 }, { x: 40, y: 0, pressure: 1 }], 20);
    expect(path).toMatch(/^M /);
    expect(path).toMatch(/ Z$/);
    const nums = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    expect(Math.max(...nums) - Math.min(...nums)).toBeGreaterThan(20);
    expect(chiselPath([{ x: 0, y: 0, pressure: 1 }], 20)).toBe("");
  });
});
