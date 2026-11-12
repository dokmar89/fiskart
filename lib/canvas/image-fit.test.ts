import { describe, expect, it } from "vitest";
import { placeLargestFit } from "./image-fit";

describe("placeLargestFit", () => {
  const page = { width: 1080, height: 1080 };

  it("keeps small images at natural size", () => {
    expect(placeLargestFit({ width: 200, height: 100 }, page)).toBe(1);
  });

  it("shrinks large images to 60% of the tighter page side", () => {
    expect(placeLargestFit({ width: 4000, height: 3000 }, page)).toBeCloseTo(648 / 4000);
    expect(placeLargestFit({ width: 1000, height: 6000 }, page)).toBeCloseTo(648 / 6000);
  });

  it("does not divide by zero", () => {
    expect(placeLargestFit({ width: 0, height: 0 }, page)).toBe(1);
  });
});
