import { describe, expect, it } from "vitest";
import { FONT_CATALOG, FONT_CATEGORIES, fontNeedsOf, isBuiltInFamily, normalizeWeight, searchFonts } from "./fonts";

describe("fontNeedsOf", () => {
  it("collects each face once with all its text, including inside groups", () => {
    const needs = fontNeedsOf([
      { type: "Textbox", fontFamily: "Inter", fontWeight: "bold", fontStyle: "normal", text: "Ahoj" },
      { type: "Rect" },
      {
        type: "Group",
        objects: [
          { type: "Textbox", fontFamily: "Inter", fontWeight: 700, text: " řeka" },
          { type: "Textbox", fontFamily: "Lora", fontWeight: "normal", fontStyle: "italic", text: "x" },
        ],
      },
    ]);
    expect(needs).toEqual([
      { family: "Inter", weight: "700", style: "normal", text: "Ahoj řeka" },
      { family: "Lora", weight: "400", style: "italic", text: "x" },
    ]);
  });
});

describe("normalizeWeight", () => {
  it("maps to the two bundled weights", () => {
    expect(normalizeWeight("bold")).toBe("700");
    expect(normalizeWeight("600")).toBe("700");
    expect(normalizeWeight(500)).toBe("400");
    expect(normalizeWeight("normal")).toBe("400");
  });
});

describe("font catalog", () => {
  it("has about sixty families, each with a category and its faces imported", async () => {
    const { readFileSync } = await import("node:fs");
    const faces = readFileSync("components/editor/font-faces.ts", "utf8");
    expect(FONT_CATALOG.length).toBeGreaterThanOrEqual(55);
    expect(new Set(FONT_CATALOG.map((f) => f.family)).size).toBe(FONT_CATALOG.length);
    for (const font of FONT_CATALOG) {
      expect(FONT_CATEGORIES.map((c) => c.id)).toContain(font.category);
      const id = font.family.toLowerCase().replace(/ /g, "-");
      expect(faces).toContain(`"@fontsource/${id}/400.css"`);
      expect(faces.includes(`"@fontsource/${id}/700.css"`)).toBe(font.bold);
    }
  });

  it("searches by name within a category", () => {
    expect(searchFonts(FONT_CATALOG, "robo", null).map((f) => f.family)).toEqual(["Roboto", "Roboto Slab", "Roboto Mono"]);
    expect(searchFonts(FONT_CATALOG, "robo", "monospace").map((f) => f.family)).toEqual(["Roboto Mono"]);
    expect(searchFonts(FONT_CATALOG, "", "script").length).toBeGreaterThan(5);
    expect(isBuiltInFamily(" inter ")).toBe(true);
    expect(isBuiltInFamily("Comic Sans MS")).toBe(false);
  });

  it("asks for list markers and upper-cased text", () => {
    const [need] = fontNeedsOf([{ fontFamily: "Inter", text: "řeka", textCase: "upper", listStyle: "number" }]);
    expect(need.text.startsWith("ŘEKA")).toBe(true);
    expect(need.text).toContain("•");
    expect(need.text).toContain("9");
  });
});
