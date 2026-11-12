import { describe, expect, it } from "vitest";
import { FRAME_SHAPES, frameCrop, framePath, frameZoom, isFrameShape, panCrop, pathExtent } from "./frames";

describe("framePath", () => {
  it("offers at least 35 distinct usable masks", () => {
    expect(FRAME_SHAPES.length).toBeGreaterThanOrEqual(35);
    expect(new Set(FRAME_SHAPES).size).toBe(FRAME_SHAPES.length);
  });

  it("rounds a photo grid cell when a corner fraction is supplied", () => {
    expect(framePath("square", 100, 80, 0.2)).toContain("C ");
    expect(pathExtent(framePath("square", 100, 80, 0.2))).toEqual({ minX: -50, maxX: 50, minY: -40, maxY: 40 });
  });
  it.each(FRAME_SHAPES)("%s fills its box, centred on the origin", (shape) => {
    const extent = pathExtent(framePath(shape, 300, 200));
    expect(extent.minX).toBeCloseTo(-150);
    expect(extent.maxX).toBeCloseTo(150);
    expect(extent.minY).toBeCloseTo(-100);
    expect(extent.maxY).toBeCloseTo(100);
  });

  it("is a closed path", () => {
    for (const shape of FRAME_SHAPES) expect(framePath(shape, 10, 10).trim().endsWith("Z")).toBe(true);
  });
});

describe("isFrameShape", () => {
  it("accepts known shapes only", () => {
    expect(isFrameShape("circle")).toBe(true);
    expect(isFrameShape("blob")).toBe(false);
    expect(isFrameShape(3)).toBe(false);
  });
});

describe("frameCrop", () => {
  it("fills a square frame from a landscape image, centred", () => {
    expect(frameCrop({ width: 400, height: 200 }, 1, 1)).toEqual({ x: 100, y: 0, width: 200, height: 200 });
  });

  it("zooms in around a centre and stays inside the image", () => {
    expect(frameCrop({ width: 400, height: 200 }, 1, 2, { x: 200, y: 100 })).toEqual({ x: 150, y: 50, width: 100, height: 100 });
    expect(frameCrop({ width: 400, height: 200 }, 1, 2, { x: 390, y: 5 })).toEqual({ x: 300, y: 0, width: 100, height: 100 });
  });

  it("never zooms out past filling the frame", () => {
    expect(frameCrop({ width: 400, height: 200 }, 2, 0.5).width).toBe(400);
  });
});

describe("frameZoom", () => {
  it("is the inverse of frameCrop", () => {
    const natural = { width: 1200, height: 800 };
    expect(frameZoom(natural, frameCrop(natural, 0.75, 2.5))).toBeCloseTo(2.5);
  });
});

describe("panCrop", () => {
  it("moves the region and stops at the image edges", () => {
    const crop = { x: 100, y: 0, width: 200, height: 200 };
    expect(panCrop(crop, { width: 400, height: 200 }, 50, 10)).toEqual({ x: 150, y: 0, width: 200, height: 200 });
    expect(panCrop(crop, { width: 400, height: 200 }, 500, 0).x).toBe(200);
    expect(panCrop(crop, { width: 400, height: 200 }, -500, 0).x).toBe(0);
  });
});
