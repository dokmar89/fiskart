import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  fitTransform,
  sceneToViewport,
  stepZoom,
  viewportToScene,
  wheelZoomFactor,
  zoomAtPoint,
  type Matrix,
} from "./viewport-math";

describe("fitTransform", () => {
  it("centres and fits a portrait artboard in a landscape viewport", () => {
    const vpt = fitTransform({ width: 1200, height: 800 }, { width: 1080, height: 1920 }, 40);
    expect(vpt[0]).toBeCloseTo((800 - 80) / 1920);
    const topLeft = sceneToViewport(vpt, { x: 0, y: 0 });
    const bottomRight = sceneToViewport(vpt, { x: 1080, y: 1920 });
    expect(topLeft.y).toBeCloseTo(40);
    expect(bottomRight.y).toBeCloseTo(760);
    expect((topLeft.x + bottomRight.x) / 2).toBeCloseTo(600);
  });
});

describe("zoomAtPoint", () => {
  it("keeps the scene point under the cursor in place", () => {
    const vpt: Matrix = [0.5, 0, 0, 0.5, 100, 40];
    const cursor = { x: 321, y: 187 };
    const before = viewportToScene(vpt, cursor);
    const next = zoomAtPoint(vpt, cursor, 1.7);
    expect(next[0]).toBeCloseTo(1.7);
    const after = viewportToScene(next, cursor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it("clamps the zoom and still keeps the point in place", () => {
    const vpt: Matrix = [1, 0, 0, 1, 0, 0];
    const cursor = { x: 50, y: 60 };
    const next = zoomAtPoint(vpt, cursor, 1000);
    expect(next[0]).toBe(MAX_ZOOM);
    expect(viewportToScene(next, cursor).x).toBeCloseTo(50);
    expect(zoomAtPoint(vpt, cursor, 0)[0]).toBe(MIN_ZOOM);
  });
});

describe("stepZoom", () => {
  it("moves to the next preset level", () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(0.6, 1)).toBe(0.75);
    expect(stepZoom(0.6, -1)).toBe(0.5);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in on negative delta and out on positive, symmetrically", () => {
    const zoomIn = wheelZoomFactor(-100, 0);
    const zoomOut = wheelZoomFactor(100, 0);
    expect(zoomIn).toBeGreaterThan(1);
    expect(zoomOut).toBeLessThan(1);
    expect(zoomIn * zoomOut).toBeCloseTo(1);
  });
});
