import { describe, expect, it } from "vitest";
import { ICONIFY_CATEGORIES, iconifyCategory, iconifySearchTerm } from "./iconify-categories";

describe("Iconify discovery", () => {
  it("offers the requested browse categories with meaningful queries", () => {
    expect(ICONIFY_CATEGORIES.map((category) => category.label)).toEqual([
      "Vše", "Minimalistické", "Biznis & Finance", "Sociální sítě", "Šipky & Odznaky",
      "Technologie", "Jídlo & Nápoje", "Cestování", "Příroda", "Emoji (Twemoji)", "Abstraktní dekorace",
    ]);
    for (const category of ICONIFY_CATEGORIES) expect(iconifySearchTerm("", category.id).length).toBeGreaterThan(1);
  });

  it("searches all sets by default and uses a restricted emoji collection", () => {
    expect(iconifyCategory("all").prefixes).toBeUndefined();
    expect(iconifyCategory("emoji").prefixes).toContain("twemoji");
    expect(iconifyCategory("bogus").id).toBe("all");
    expect(iconifySearchTerm("  kočka  ", "emoji")).toBe("kočka");
  });
});
