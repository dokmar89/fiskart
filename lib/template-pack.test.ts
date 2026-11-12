import { describe, expect, it } from "vitest";
import { importTemplatePack, parseTemplatePack, type PackTemplate } from "./template-pack";

const sample = {
  version: 1,
  packId: "ceske-pozvanky",
  templates: [{
    slug: "modra-oslava",
    title: "Modrá oslava",
    category: "Pozvánka",
    width: 1080,
    height: 1080,
    unit: "px",
    tags: ["oslava", "česky"],
    pages: [{ objects: [{ type: "Textbox", left: 80, top: 80, width: 800, height: 110, text: "Přijďte slavit" }] }],
  }],
};

describe("parseTemplatePack", () => {
  it("prepares editable pages under a stable pack slug", () => {
    const pack = parseTemplatePack(sample);
    expect(pack.packId).toBe("ceske-pozvanky");
    expect(pack.templates[0].slug).toBe("pack-ceske-pozvanky-modra-oslava");
    expect(pack.templates[0].pages[0].objects[0].text).toBe("Přijďte slavit");
  });

  it("rejects duplicate template slugs before any import can start", () => {
    expect(() => parseTemplatePack({ ...sample, templates: [sample.templates[0], sample.templates[0]] })).toThrow(/duplicit/i);
  });

  it("rejects malformed pages and unsupported dimensions", () => {
    expect(() => parseTemplatePack({ ...sample, templates: [{ ...sample.templates[0], pages: [{ objects: "bad" }] }] })).toThrow(/stránk/i);
    expect(() => parseTemplatePack({ ...sample, templates: [{ ...sample.templates[0], pages: [{ objects: [{}] }] }] })).toThrow(/objekt/i);
    expect(() => parseTemplatePack({ ...sample, templates: [{ ...sample.templates[0], width: 9000 }] })).toThrow(/rozměr/i);
  });

  it("rejects an empty or unsafe pack identifier", () => {
    expect(() => parseTemplatePack({ ...sample, packId: "../escape" })).toThrow(/packId/i);
    expect(() => parseTemplatePack({ ...sample, templates: [] })).toThrow(/šablon/i);
  });
});

it("imports a pack repeatedly without duplicates, then updates only its changed template", async () => {
  const rows = new Map<string, PackTemplate & { id: string; isBuiltIn: boolean }>();
  rows.set("user-owned", { ...parseTemplatePack(sample).templates[0], slug: "user-owned", id: "saved-1", isBuiltIn: false });
  let nextId = 1;
  const repository = {
    findBySlug: async (slug: string) => rows.get(slug) ?? null,
    create: async (template: PackTemplate) => { rows.set(template.slug, { ...template, id: `new-${nextId++}`, isBuiltIn: true }); },
    update: async (id: string, template: PackTemplate) => { rows.set(template.slug, { ...template, id, isBuiltIn: true }); },
  };
  const pack = parseTemplatePack(sample);
  expect(await importTemplatePack(pack, repository)).toEqual({ added: 1, updated: 0, unchanged: 0 });
  expect(await importTemplatePack(pack, repository)).toEqual({ added: 0, updated: 0, unchanged: 1 });
  const originalId = rows.get(pack.templates[0].slug)?.id;
  const changed = parseTemplatePack({ ...sample, templates: [{ ...sample.templates[0], pages: [{ objects: [{ ...sample.templates[0].pages[0].objects[0], text: "Jiný text" }] }] }] });
  expect(await importTemplatePack(changed, repository)).toEqual({ added: 0, updated: 1, unchanged: 0 });
  expect(rows.get(pack.templates[0].slug)?.id).toBe(originalId);
  expect(rows.get("user-owned")?.id).toBe("saved-1");
});
