import { describe, expect, it } from "vitest";
import { BUILT_IN_TEMPLATES } from "./catalog";
import { generateTemplates } from "./generated";

describe("generated template library", () => {
  it("has 20 concepts with two stable treatments and a unique slug", () => {
    const first = generateTemplates();
    expect(first).toHaveLength(40);
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(55);
    expect(new Set(first.map((template) => template.slug)).size).toBe(first.length);
    expect(generateTemplates()).toEqual(first);
  });

  it("includes editable image frames, layered backgrounds and Czech copy", () => {
    for (const template of generateTemplates()) {
      const objects = template.pages[0].objects;
      expect(objects[0]).toMatchObject({ type: "Rect", role: "background" });
      expect(objects.filter((object) => object.type === "Textbox").length, template.slug).toBeGreaterThanOrEqual(3);
      expect(objects.some((object) => object.type === "Path" && object.frame), template.slug).toBe(true);
      expect(objects.length, template.slug).toBeGreaterThanOrEqual(8);
    }
    const slugs = generateTemplates().map((template) => template.slug);
    for (const topic of ["sale", "podcast", "quote", "property", "fitness", "gaming", "coding", "finance", "webinar", "hiring", "timetable", "worksheet", "mind-map", "pricing"]) {
      expect(slugs.some((slug) => slug.includes(topic)), topic).toBe(true);
    }
  });
});
