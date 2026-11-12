import { SCHEMA_VERSION, validatePageData, type CanvasData } from "./page-data";
import { isValidDesignSize } from "./presets";
import { MAX_TAGS, MAX_TEMPLATE_PAGES } from "./templates";
import { isUnit, type Unit } from "./units";

export type PackTemplate = {
  slug: string;
  title: string;
  category: string;
  width: number;
  height: number;
  unit: Unit;
  tags: string[];
  pages: CanvasData[];
};

export type TemplatePack = { packId: string; templates: PackTemplate[] };

export type StoredPackTemplate = PackTemplate & { id: string; isBuiltIn: boolean };
export type TemplatePackRepository = {
  findBySlug: (slug: string) => Promise<StoredPackTemplate | null>;
  create: (template: PackTemplate) => Promise<void>;
  update: (id: string, template: PackTemplate) => Promise<void>;
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FABRIC_TYPES = new Set(["textbox", "itext", "text", "rect", "circle", "ellipse", "triangle", "line", "polygon", "polyline", "path", "image", "group"]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function label(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) throw new Error(`Neplatné pole ${name}`);
  return value.trim();
}

function identifier(value: unknown, name: string, maxLength: number): string {
  const text = label(value, name, maxLength);
  if (!ID.test(text)) throw new Error(`Neplatné pole ${name}: použijte malá písmena, číslice a pomlčky`);
  return text;
}

function isEditableObject(value: unknown): boolean {
  if (!record(value) || typeof value.type !== "string" || !FABRIC_TYPES.has(value.type.toLowerCase())) return false;
  if (![value.left, value.top, value.width, value.height].every((dimension) => typeof dimension === "number" && Number.isFinite(dimension))) return false;
  if ((value.width as number) < 0 || (value.height as number) < 0) return false;
  const type = value.type.toLowerCase();
  if (["textbox", "itext", "text"].includes(type) && typeof value.text !== "string") return false;
  if (type === "path" && typeof value.path !== "string" && !Array.isArray(value.path)) return false;
  if (type === "image" && typeof value.src !== "string" && typeof value.assetId !== "string") return false;
  if (type === "group" && (!Array.isArray(value.objects) || value.objects.length === 0 || !value.objects.every(isEditableObject))) return false;
  return true;
}

/** Validate a complete local pack before the importer writes any template to the database. */
export function parseTemplatePack(input: unknown): TemplatePack {
  if (!record(input) || input.version !== 1) throw new Error("Balík musí mít version: 1");
  const packId = identifier(input.packId, "packId", 48);
  if (!Array.isArray(input.templates) || input.templates.length === 0 || input.templates.length > 5000) {
    throw new Error("Balík musí obsahovat 1 až 5000 šablon");
  }

  const seen = new Set<string>();
  const templates = input.templates.map((value, index): PackTemplate => {
    if (!record(value)) throw new Error(`Šablona ${index + 1} musí být objekt`);
    const localSlug = identifier(value.slug, `slug šablony ${index + 1}`, 70);
    const slug = `pack-${packId}-${localSlug}`;
    if (seen.has(slug)) throw new Error(`Duplicitní slug šablony: ${slug}`);
    seen.add(slug);

    const title = label(value.title, `title šablony ${index + 1}`, 120);
    const category = label(value.category, `category šablony ${index + 1}`, 80);
    if (!isValidDesignSize(value.width) || !isValidDesignSize(value.height)) throw new Error(`Neplatný rozměr šablony ${index + 1}`);
    if (!isUnit(value.unit)) throw new Error(`Nepodporovaná jednotka šablony ${index + 1}`);
    if (!Array.isArray(value.tags) || value.tags.length > MAX_TAGS || !value.tags.every((tag) => typeof tag === "string" && tag.trim().length > 0 && tag.trim().length <= 40)) {
      throw new Error(`Neplatné štítky šablony ${index + 1}`);
    }
    if (!Array.isArray(value.pages) || value.pages.length === 0 || value.pages.length > MAX_TEMPLATE_PAGES) {
      throw new Error(`Šablona ${index + 1} musí mít 1 až ${MAX_TEMPLATE_PAGES} stránek`);
    }
    const pages = value.pages as CanvasData[];
    for (const [pageIndex, page] of pages.entries()) {
      const error = validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData: page });
      if (error || page.objects.length === 0) throw new Error(`Neplatná stránka ${pageIndex + 1} šablony ${index + 1}: ${error ?? "bez editovatelných objektů"}`);
      if (!page.objects.every(isEditableObject)) throw new Error(`Neplatný objekt na stránce ${pageIndex + 1} šablony ${index + 1}`);
    }
    return { slug, title, category, width: value.width, height: value.height, unit: value.unit, tags: value.tags.map((tag: string) => tag.trim()), pages };
  });
  return { packId, templates };
}

/** Compare JSONB content independent of PostgreSQL's object-key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (record(value)) {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameContent(stored: StoredPackTemplate, incoming: PackTemplate): boolean {
  return stored.isBuiltIn && canonical({
    slug: stored.slug, title: stored.title, category: stored.category, width: stored.width, height: stored.height,
    unit: stored.unit, tags: stored.tags, pages: stored.pages,
  }) === canonical(incoming);
}

/** Upsert only this pack's stable slugs. Does not inspect or remove unrelated templates. */
export async function importTemplatePack(pack: TemplatePack, repository: TemplatePackRepository): Promise<{ added: number; updated: number; unchanged: number }> {
  const counts = { added: 0, updated: 0, unchanged: 0 };
  for (const template of pack.templates) {
    const existing = await repository.findBySlug(template.slug);
    if (!existing) {
      await repository.create(template);
      counts.added++;
    } else if (sameContent(existing, template)) {
      counts.unchanged++;
    } else {
      if (!existing.isBuiltIn) throw new Error(`Slug ${template.slug} patří uživatelské šabloně`);
      await repository.update(existing.id, template);
      counts.updated++;
    }
  }
  return counts;
}
