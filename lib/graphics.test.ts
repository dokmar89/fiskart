import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GRAPHIC_CATEGORIES, GRAPHICS, searchGraphics } from "./graphics";
import { svgColors } from "./svg-colors";

describe("graphics library", () => {
  it("has about a hundred graphics in several categories, each with a file", () => {
    expect(GRAPHICS.length).toBeGreaterThanOrEqual(100);
    expect(GRAPHIC_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(GRAPHICS.map((g) => g.id)).size).toBe(GRAPHICS.length);
    for (const g of GRAPHICS) expect(existsSync(path.join(__dirname, "..", "public", "graphics", `${g.id}.svg`))).toBe(true);
  });

  it("paints every graphic with plain colours, so each can be recoloured", () => {
    for (const g of GRAPHICS) {
      const svg = readFileSync(path.join(__dirname, "..", "public", "graphics", `${g.id}.svg`), "utf8");
      expect(svgColors(svg).length, g.id).toBeGreaterThan(0);
      expect(svg).toMatch(/<svg[^>]+width="\d+" height="\d+"/);
    }
  });
});

describe("searchGraphics", () => {
  it("finds by name, tag and category, name matches first", () => {
    const stars = searchGraphics("hvezda");
    expect(stars.length).toBeGreaterThan(5);
    expect(stars[0].name.toLowerCase()).toContain("hvězda");
    expect(searchGraphics("star").length).toBeGreaterThan(5);
    expect(searchGraphics("arrow curve").map((g) => g.id)).toContain("arrow-curved");
    expect(searchGraphics("")).toHaveLength(GRAPHICS.length);
    expect(searchGraphics("xylophone")).toEqual([]);
  });
});
