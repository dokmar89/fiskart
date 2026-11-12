import { describe, expect, it } from "vitest";
import { shadeVignette, vignetteFactor } from "./vignette";

describe("vignette", () => {
  it("darkens image corners while preserving the centre", () => {
    expect(vignetteFactor(50, 50, 101, 101, 1)).toBeCloseTo(1);
    expect(vignetteFactor(0, 0, 101, 101, 1)).toBeLessThan(0.5);
    expect(vignetteFactor(0, 0, 101, 101, 0)).toBe(1);
  });

  it("keeps transparency untouched", () => {
    const pixels = new Uint8ClampedArray([200, 100, 50, 0, 200, 100, 50, 255, 200, 100, 50, 255, 200, 100, 50, 255]);
    shadeVignette(pixels, 2, 2, 1);
    expect(pixels[3]).toBe(0);
    expect(pixels[7]).toBe(255);
    expect(pixels[4]).toBeLessThan(200);
  });
});
