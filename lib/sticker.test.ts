import { describe, expect, it } from "vitest";
import { outlineMask, readSticker } from "./sticker";

describe("sticker outline", () => {
  it("follows opaque pixels instead of the rectangular image bounds", () => {
    const alpha = new Uint8ClampedArray(25);
    alpha[2 + 2 * 5] = 255;
    const mask = outlineMask(alpha, 5, 5, 1);
    expect(mask.width).toBe(7);
    expect(mask.height).toBe(7);
    const at = (x: number, y: number) => mask.alpha[y * mask.width + x];
    expect(at(3, 3)).toBe(255);
    expect(at(2, 3)).toBe(255);
    expect(at(2, 2)).toBe(0);
    expect(at(0, 0)).toBe(0);
  });

  it("normalizes stored settings and rejects unsafe colours", () => {
    expect(readSticker({ color: "#ff0066", thickness: 12, shadowBlur: 6, shadowOpacity: 0.4 })).toEqual({ color: "#ff0066", thickness: 12, shadowBlur: 6, shadowOpacity: 0.4 });
    expect(readSticker({ color: "url(javascript:bad)", thickness: 500, shadowBlur: -2, shadowOpacity: 5 })).toEqual({ color: "#ffffff", thickness: 32, shadowBlur: 0, shadowOpacity: 1 });
    expect(readSticker(null)).toBeNull();
  });
});
