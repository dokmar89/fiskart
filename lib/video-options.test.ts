import { describe, expect, it } from "vitest";
import { framesFor, gifDelay, pageStarts, videoSize } from "./video-options";

describe("videoSize", () => {
  it("gives the shorter side the resolution", () => {
    expect(videoSize({ width: 1920, height: 1080 }, 720)).toEqual({ width: 1280, height: 720 });
    expect(videoSize({ width: 1080, height: 1920 }, 1080)).toEqual({ width: 1080, height: 1920 });
    expect(videoSize({ width: 1080, height: 1080 }, 720)).toEqual({ width: 720, height: 720 });
  });

  it("keeps both sides even", () => {
    // A4 portrait: 794 × 1123 px.
    const size = videoSize({ width: 793.7, height: 1122.5 }, 720);
    expect(size.width % 2).toBe(0);
    expect(size.height % 2).toBe(0);
    expect(size.width).toBe(720);
  });
});

describe("frames", () => {
  it("counts frames per page and where pages start", () => {
    expect(framesFor(10_000)).toBe(300);
    expect(framesFor(10)).toBe(1);
    expect(pageStarts([10_000, 5_000, 15_000])).toEqual([0, 10_000, 15_000]);
    expect(pageStarts([1000, 1000], 30)).toEqual([0, 1000]);
  });

  it("rounds GIF delays to hundredths", () => {
    expect(gifDelay(30)).toBe(3);
    expect(gifDelay(100)).toBe(2);
  });
});
