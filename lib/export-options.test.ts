import { describe, expect, it } from "vitest";
import { exportFileName, exportScale, fitsCanvas, outputSize, pdfPageSize } from "./export-options";
import { toPx } from "./units";

const a4 = { width: toPx(210, "mm"), height: toPx(297, "mm") };

describe("export sizes", () => {
  it("renders a 1080 px page at 2× as exactly 2160 px", () => {
    expect(outputSize({ width: 1080, height: 1080 }, exportScale("png", 2, 96))).toEqual({ width: 2160, height: 2160 });
  });

  it("renders A4 at 300 DPI as about 2480 × 3508 px", () => {
    expect(outputSize(a4, exportScale("pdf", 1, 300))).toEqual({ width: 2480, height: 3508 });
  });

  it("gives an A4 page the A4 size in points", () => {
    const size = pdfPageSize(a4);
    expect(size.width).toBeCloseTo(595.28, 1);
    expect(size.height).toBeCloseTo(841.89, 1);
  });

  it("ignores the raster scale for PDF and SVG", () => {
    expect(exportScale("pdf", 3, 150)).toBeCloseTo(1.5625);
    expect(exportScale("svg", 3, 300)).toBe(1);
    expect(exportScale("jpeg", 3, 300)).toBe(3);
  });

  it("refuses canvases browsers cannot draw", () => {
    expect(fitsCanvas({ width: 5760, height: 3240 })).toBe(true);
    expect(fitsCanvas({ width: 24_000, height: 100 })).toBe(false);
    expect(fitsCanvas({ width: 12_000, height: 12_000 })).toBe(false);
  });
});

describe("exportFileName", () => {
  it("keeps the title, numbers pages and drops unsafe characters", () => {
    expect(exportFileName("Plakát: jaro/léto", "png")).toBe("Plakát jaro léto.png");
    expect(exportFileName("Deck", "png", 3)).toBe("Deck-3.png");
    expect(exportFileName("  ...  ", "pdf")).toBe("návrh.pdf");
  });
});
