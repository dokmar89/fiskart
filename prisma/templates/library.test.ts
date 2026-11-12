import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, validatePageData } from "../../lib/page-data";
import { isBuiltInFamily } from "../../lib/fonts";
import { BUILT_IN_TEMPLATES } from "./catalog";
import { generateLibraryTemplates } from "./library";

const library = BUILT_IN_TEMPLATES.filter((template) => template.slug.startsWith("library-"));
const luminance = (hex: string) => {
  const channels = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};
const contrast = (a: string, b: string) => {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + .05) / (dark + .05);
};

describe("large editable template library", () => {
  it("adds 40 layouts with three styles in each of the ten categories", () => {
    expect(library).toHaveLength(1_200);
    expect(new Set(library.map((template) => template.slug)).size).toBe(1_200);

    const categories = new Set(library.map((template) => template.category));
    expect(categories.size).toBe(10);
    for (const category of categories) {
      const items = library.filter((template) => template.category === category);
      expect(items).toHaveLength(120);
      for (const style of [1, 2, 3]) {
        const styled = items.filter((template) => template.slug.endsWith(`-s${style}`));
        expect(styled).toHaveLength(40);
        const geometries = styled.map((template) =>
          JSON.stringify(template.pages[0].objects.filter((object) => object.role !== "background").map((object) => [
            object.type, object.left, object.top, object.width, object.height, object.rx, object.ry,
          ])),
        );
        expect(new Set(geometries).size).toBe(40);
      }
    }
  });

  it("keeps every page editable, valid and independent of remote assets", () => {
    for (const template of library) {
      expect(template.pages).toHaveLength(1);
      const page = template.pages[0];
      expect(validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData: page })).toBeNull();
      expect(page.objects.length).toBeGreaterThanOrEqual(6);
      expect(page.objects.some((object) => object.type === "Textbox")).toBe(true);
      expect(page.objects.some((object) => object.name === "Nadpis")).toBe(true);
      expect(JSON.stringify(page)).not.toMatch(/https?:\/\//);
      for (const object of page.objects.filter((item) => item.name === "Nadpis")) {
        const x = Number(object.left), y = Number(object.top), w = Number(object.width);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(template.width + 1);
        expect(y).toBeLessThan(template.height);
      }
    }
  });

  it("is repeatable and gives every visible item and object a stable identity", () => {
    expect(generateLibraryTemplates()).toEqual(generateLibraryTemplates());
    expect(new Set(library.map((template) => template.title)).size).toBe(library.length);
    for (const template of library) {
      const ids = template.pages[0].objects.map((object) => object.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("keeps action text readable on its accent background", () => {
    for (const template of library) {
      const page = template.pages[0];
      const button = page.objects.find((object) => object.name === "Výzva – plocha");
      const label = page.objects.find((object) => object.name === "Výzva");
      if (!button || !label) continue;
      expect(contrast(String(button.fill), String(label.fill))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps each kicker readable against the page background", () => {
    for (const template of library) {
      const background = template.pages[0].objects.find((object) => object.role === "background");
      const kicker = template.pages[0].objects.find((object) => object.name === "Štítek");
      expect(contrast(String(background?.fill), String(kicker?.fill))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives promotional layouts a dominant heading, varied framing and graphic detail", () => {
    const promotional = library.filter((template) => !["Logo", "Životopis", "Vizitka", "Vzdělávání"].includes(template.category));
    for (const template of promotional) {
      const objects = template.pages[0].objects;
      const heading = objects.find((object) => object.name === "Nadpis");
      expect(Number(heading?.fontSize) / Math.min(template.width, template.height)).toBeGreaterThanOrEqual(.075);
      const frames = objects.filter((object) => object.frame);
      expect(frames.length).toBeGreaterThanOrEqual(1);
      expect(Math.max(...frames.map((object) => Number(object.width) * Number(object.height)))).toBeLessThanOrEqual(template.width * template.height * .26);
      expect(objects.filter((object) => ["Rect", "Ellipse", "Polygon"].includes(String(object.type)) && object.role !== "background").length).toBeGreaterThanOrEqual(4);
    }
    for (const category of new Set(promotional.map((template) => template.category))) {
      const shapes = new Set(promotional.filter((template) => template.category === category).flatMap((template) => template.pages[0].objects.filter((object) => object.frame).map((object) => object.frame)));
      expect(shapes.size).toBeGreaterThanOrEqual(4);
    }
  });

  it("provides useful content structure in resumes and worksheets", () => {
    for (const template of library.filter((item) => item.category === "Životopis")) {
      const names = template.pages[0].objects.map((object) => object.name);
      expect(names).toContain("Dovednosti");
      expect(names).toContain("Vzdělání");
    }
    for (const template of library.filter((item) => item.category === "Vzdělávání")) {
      const names = template.pages[0].objects.map((object) => String(object.name));
      expect(names.filter((name) => name.startsWith("Řádek odpovědi")).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses only font families bundled with the app", () => {
    for (const template of library) {
      for (const object of template.pages[0].objects) {
        if (typeof object.fontFamily === "string") expect(isBuiltInFamily(object.fontFamily)).toBe(true);
      }
    }
  });

  it("reserves vertical room for promotional text and its action", () => {
    for (const template of library.filter((item) => !["Logo", "Životopis", "Vizitka", "Vzdělávání"].includes(item.category))) {
      const objects = template.pages[0].objects;
      const named = (name: string) => objects.find((object) => object.name === name)!;
      const kicker = named("Štítek"), heading = named("Nadpis"), subtitle = named("Podnadpis"), action = named("Výzva – plocha");
      expect(Number(heading.top) - Number(kicker.top)).toBeGreaterThanOrEqual(Number(kicker.fontSize) * 1.25);
      expect(Number(subtitle.top) - Number(heading.top)).toBeGreaterThanOrEqual(Number(heading.fontSize) * 1.65);
      expect(Number(action.top) - Number(subtitle.top)).toBeGreaterThanOrEqual(Number(subtitle.fontSize) * 2.1);
    }
  });
});
