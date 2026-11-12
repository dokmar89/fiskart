import { describe, expect, it } from "vitest";
import { cropAxis } from "./crop-math";

describe("cropAxis", () => {
  const full = { crop: 0, size: 400 };

  it("dragging the end edge in shortens the visible part and keeps the origin", () => {
    // Shown at scale 0.5; dragged to 0.25 → half the width.
    expect(cropAxis(full, 0.5, 0.25, "end", 400)).toEqual({ crop: 0, size: 200 });
  });

  it("dragging the start edge in moves the origin and keeps the end", () => {
    expect(cropAxis(full, 0.5, 0.375, "start", 400)).toEqual({ crop: 100, size: 300 });
  });

  it("cannot reveal more than the image has", () => {
    expect(cropAxis({ crop: 100, size: 200 }, 1, 3, "end", 400)).toEqual({ crop: 100, size: 300 });
    expect(cropAxis({ crop: 100, size: 200 }, 1, 3, "start", 400)).toEqual({ crop: 0, size: 300 });
  });

  it("can uncrop back out", () => {
    expect(cropAxis({ crop: 100, size: 200 }, 1, 1.25, "start", 400)).toEqual({ crop: 50, size: 250 });
  });

  it("never shrinks below one pixel", () => {
    expect(cropAxis(full, 1, 0, "end", 400).size).toBe(1);
    expect(cropAxis(full, 1, -2, "start", 400)).toEqual({ crop: 399, size: 1 });
  });
});
