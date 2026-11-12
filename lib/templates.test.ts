import { describe, expect, it } from "vitest";
import { fitObjectsToArtboard, foldText, parseTags, searchTemplates, templateCategories } from "./templates";

const list = [
  { title: "Business promo", category: "Příspěvek na Instagram", tags: ["marketing", "agency"] },
  { title: "Résumé – clean", category: "Životopis", tags: ["cv", "job"] },
  { title: "Summer sale", category: "Příspěvek na Instagram", tags: ["shop", "discount"] },
  { title: "Club night", category: "Flyers", tags: [] },
];

describe("searchTemplates", () => {
  it("matches title and tags, ignoring case and accents, every word", () => {
    expect(searchTemplates(list, "RESUME", null).map((t) => t.title)).toEqual(["Résumé – clean"]);
    expect(searchTemplates(list, "discount", null).map((t) => t.title)).toEqual(["Summer sale"]);
    expect(searchTemplates(list, "summer shop", null).map((t) => t.title)).toEqual(["Summer sale"]);
    expect(searchTemplates(list, "summer cv", null)).toEqual([]);
    expect(searchTemplates(list, "", "Příspěvek na Instagram")).toHaveLength(2);
    expect(searchTemplates(list, "sale", "Životopis")).toEqual([]);
  });

  it("folds text", () => {
    expect(foldText("Žluťoučký KŮŇ")).toBe("zlutoucky kun");
  });
});

describe("templateCategories", () => {
  it("lists built-in categories in order, then others", () => {
    expect(templateCategories(list)).toEqual(["Příspěvek na Instagram", "Životopis", "Flyers"]);
  });
});

describe("parseTags", () => {
  it("splits, trims and removes duplicates", () => {
    expect(parseTags("sale, Shop ,, sale\nSHOP, new")).toEqual(["sale", "Shop", "new"]);
    expect(parseTags(["a", 3, " b "])).toEqual(["a", "b"]);
  });
});

describe("fitObjectsToArtboard", () => {
  const square = { width: 1000, height: 1000 };

  it("leaves objects alone at the same size", () => {
    const objects = [{ left: 10, top: 20 }];
    expect(fitObjectsToArtboard(objects, square, square)).toBe(objects);
  });

  it("scales uniformly, centres the content and stretches backgrounds", () => {
    const objects = [
      { role: "background", left: 0, top: 0, width: 1000, height: 1000 },
      { left: 100, top: 200, scaleX: 2, scaleY: 2, width: 50, height: 50 },
    ];
    const [bg, box] = fitObjectsToArtboard(objects, square, { width: 2000, height: 1000 });
    expect(bg).toMatchObject({ left: 0, top: 0, scaleX: 2, scaleY: 1 });
    // Scale 1 (limited by the height), shifted right by half the extra width.
    expect(box).toMatchObject({ left: 600, top: 200, scaleX: 2, scaleY: 2 });

    const [, small] = fitObjectsToArtboard(objects, square, { width: 500, height: 800 });
    expect(small).toMatchObject({ left: 50, top: 250, scaleX: 1, scaleY: 1 });
  });
});
