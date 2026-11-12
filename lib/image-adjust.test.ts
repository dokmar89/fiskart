import { describe, expect, it } from "vitest";
import { adjustmentsOf, FILTER_PRESETS, filtersFor, hasAdjustments, NO_ADJUSTMENTS } from "./image-adjust";

describe("filtersFor", () => {
  it("is empty without adjustments", () => {
    expect(filtersFor(NO_ADJUSTMENTS)).toEqual([]);
    expect(hasAdjustments(NO_ADJUSTMENTS)).toBe(false);
  });

  it("puts the preset first and scales the sliders into Fabric's ranges", () => {
    expect(filtersFor({ ...NO_ADJUSTMENTS, brightness: 50, contrast: -100, saturation: 0, blur: 20, preset: "sepia" })).toEqual([
      { type: "Sepia" },
      { type: "Brightness", brightness: 0.25 },
      { type: "Contrast", contrast: -0.6 },
      { type: "Blur", blur: 0.05 },
    ]);
  });

  it("clamps out-of-range values", () => {
    expect(filtersFor({ ...NO_ADJUSTMENTS, blur: -40, saturation: 300 })).toEqual([{ type: "Saturation", saturation: 1 }]);
  });

  it("provides at least twelve working colour grades including duotone", () => {
    expect(FILTER_PRESETS.length - 1).toBeGreaterThanOrEqual(12);
    for (const preset of FILTER_PRESETS) {
      if (preset === "none") continue;
      const result = filtersFor({ ...NO_ADJUSTMENTS, preset });
      expect(result.length).toBeGreaterThan(0);
      expect(adjustmentsOf(result).preset).toBe(preset);
    }
    expect(filtersFor({ ...NO_ADJUSTMENTS, preset: "cyberpunk" })).toEqual(expect.arrayContaining([expect.objectContaining({ type: "ColorMatrix" })]));
  });

  it("turns white balance, sharpen and vignette into reversible filters", () => {
    const settings = { ...NO_ADJUSTMENTS, temperature: 48, tint: -20, sharpness: 30, vignette: 55 };
    const filters = filtersFor(settings);
    expect(filters.map((filter) => filter.type)).toEqual(["ColorMatrix", "Convolute", "Vignette"]);
    expect(adjustmentsOf(filters)).toEqual(settings);
  });
});

describe("adjustmentsOf", () => {
  it("reads back what filtersFor wrote", () => {
    const adjustments = { ...NO_ADJUSTMENTS, brightness: -30, contrast: 12, saturation: -100, blur: 64, preset: "vintage" as const };
    expect(adjustmentsOf(filtersFor(adjustments))).toEqual(adjustments);
  });

  it.each(FILTER_PRESETS)("reads back the %s preset as a Fabric filter", (preset) => {
    const filters = filtersFor({ ...NO_ADJUSTMENTS, preset });
    if (preset !== "none") expect(filters[0].type).toMatch(/^[A-Z][a-zA-Z]+$/);
    expect(adjustmentsOf(filters).preset).toBe(preset);
  });

  it("ignores unknown filters and junk", () => {
    expect(adjustmentsOf([{ type: "Pixelate", blocksize: 4 }, null, 3, { type: "Grayscale", mode: "average" }])).toEqual({
      ...NO_ADJUSTMENTS,
      preset: "grayscale",
    });
    expect(adjustmentsOf(undefined)).toEqual(NO_ADJUSTMENTS);
  });
});
