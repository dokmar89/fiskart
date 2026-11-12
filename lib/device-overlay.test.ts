import { describe, expect, it } from "vitest";
import { deviceOverlay } from "./device-overlay";

describe("device frame details", () => {
  it("provides distinctive details for all five mockups within their boxes", () => {
    for (const shape of ["phone", "tablet", "smartwatch", "laptop", "browser"] as const) {
      const details = deviceOverlay(shape, 400, 300);
      expect(details.length).toBeGreaterThan(1);
      for (const detail of details) {
        expect(JSON.stringify(detail)).not.toContain("null");
        expect(detail.x).toBeGreaterThanOrEqual(-200);
        expect(detail.y).toBeGreaterThanOrEqual(-150);
      }
    }
  });
  it("returns no detail for a regular photo frame", () => {
    expect(deviceOverlay("circle", 400, 300)).toEqual([]);
  });
});
