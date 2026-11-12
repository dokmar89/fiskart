import { describe, expect, it } from "vitest";
import { GRID_LAYOUTS, gridCells } from "./photo-grid";

const area = { left: 100, top: 100, width: 820, height: 410 };

describe("gridCells", () => {
  it("offers at least 24 distinct working layouts", () => {
    expect(GRID_LAYOUTS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(GRID_LAYOUTS.map((layout) => layout.id)).size).toBe(GRID_LAYOUTS.length);
    for (const layout of GRID_LAYOUTS) {
      const cells = gridCells(layout.id, area, 12);
      expect(cells).toHaveLength(layout.cells);
      for (const cell of cells) {
        expect(cell.width).toBeGreaterThan(0);
        expect(cell.height).toBeGreaterThan(0);
        expect(cell.left).toBeGreaterThanOrEqual(area.left);
        expect(cell.top).toBeGreaterThanOrEqual(area.top);
        expect(cell.left + cell.width).toBeLessThanOrEqual(area.left + area.width + 0.001);
        expect(cell.top + cell.height).toBeLessThanOrEqual(area.top + area.height + 0.001);
      }
    }
  });

  it("includes hero, bento and nine-cell compositions", () => {
    const top = gridCells("3-hero-top", { left: 0, top: 0, width: 300, height: 300 }, 10);
    expect(top).toHaveLength(3);
    expect(top[0].width).toBe(300);
    expect(top[0].height).toBeGreaterThan(top[1].height);
    const bento = gridCells("5-bento-left", { left: 0, top: 0, width: 300, height: 300 }, 10);
    expect(bento).toHaveLength(5);
    expect(Math.max(...bento.map((cell) => cell.width))).toBeGreaterThan(Math.min(...bento.map((cell) => cell.width)));
    expect(gridCells("9-grid", area, 10)).toHaveLength(9);
  });

  it("keeps cells positive in a small area with excessive spacing", () => {
    const cells = gridCells("9-grid", { left: 0, top: 0, width: 30, height: 30 }, 40);
    expect(cells).toHaveLength(9);
    expect(cells.every((cell) => cell.width > 0 && cell.height > 0)).toBe(true);
  });
  it("has the advertised number of cells for every layout", () => {
    for (const layout of GRID_LAYOUTS) expect(gridCells(layout.id, area, 20)).toHaveLength(layout.cells);
  });

  it("spaces cells evenly and fills the area", () => {
    const cells = gridCells("4-grid", area, 20);
    expect(cells[0]).toEqual({ left: 100, top: 100, width: 400, height: 195 });
    expect(cells[3]).toEqual({ left: 520, top: 315, width: 400, height: 195 });
  });

  it("gives the feature cell twice the width", () => {
    const [big, small] = gridCells("3-feature", { left: 0, top: 0, width: 320, height: 100 }, 20);
    expect(big.width).toBe(200);
    expect(small.width).toBe(100);
    expect(big.height).toBe(100);
    expect(small.height).toBe(40);
  });

  it("is empty for an unknown layout", () => {
    expect(gridCells("7-star", area, 0)).toEqual([]);
  });
});
