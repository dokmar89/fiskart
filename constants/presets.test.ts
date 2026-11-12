import { describe, expect, it } from "vitest";
import { DESIGN_PRESETS, findDesignPreset } from "./presets";
import { toPx } from "@/lib/units";

describe("design presets", () => {
  it("offers at least 40 formats with unique stable IDs", () => {
    expect(DESIGN_PRESETS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(DESIGN_PRESETS.map((preset) => preset.id)).size).toBe(DESIGN_PRESETS.length);
  });

  it("uses the requested social, education and print sizes", () => {
    expect(findDesignPreset("instagram-portrait")).toMatchObject({ width: 1080, height: 1350, unit: "px" });
    expect(findDesignPreset("facebook-feed")).toMatchObject({ width: 1200, height: 630, unit: "px" });
    expect(findDesignPreset("linkedin-post")).toMatchObject({ width: 1200, height: 627, unit: "px" });
    expect(findDesignPreset("classroom-header")).toMatchObject({ width: 1000, height: 250, unit: "px" });
    expect(findDesignPreset("a2")).toMatchObject({ width: toPx(420, "mm"), height: toPx(594, "mm"), unit: "mm" });
    expect(findDesignPreset("not-a-preset")).toBeUndefined();
  });

  it("stores A4 at 96 DPI, for a 300 DPI print export", () => {
    const a4 = findDesignPreset("a4");
    expect(a4?.width).toBeCloseTo(793.7, 1);
    expect(a4?.height).toBeCloseTo(1122.5, 1);
    expect(Math.round(a4!.width * 300 / 96)).toBe(2480);
    expect(Math.round(a4!.height * 300 / 96)).toBe(3508);
  });
});
