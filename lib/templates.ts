/**
 * Templates, shared by the gallery, the routes and the seed. No Fabric, React or server imports.
 */
import type { CanvasData } from "./page-data";
import { resizeObjects, type Size } from "./resize";
import type { Unit } from "./units";

export type TemplateSummary = {
  id: string;
  title: string;
  category: string;
  width: number;
  height: number;
  unit: Unit;
  tags: string[];
  isBuiltIn: boolean;
  pageCount: number;
  /** Changes whenever the template does; part of the thumbnail URL so it can be cached for good. */
  version: number;
  hasThumbnail: boolean;
};

export type TemplateDetail = TemplateSummary & { pages: CanvasData[] };

/** Order of the built-in categories in the gallery; saved templates may add others after them. */
export const TEMPLATE_CATEGORIES = [
  "Příspěvek na Instagram",
  "Příběh na Instagram",
  "Prezentace",
  "Miniatura pro YouTube",
  "Logo",
  "Plakát",
  "Životopis",
  "Vizitka",
  "LinkedIn",
  "Vzdělávání",
] as const;

export const MAX_TEMPLATE_PAGES = 50;
export const MAX_TAGS = 20;

/** Lower case without accents, so "resume" finds "Résumé" and "kral" finds "Král". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Templates whose title or any tag contains every word of the query, within a category. */
export function searchTemplates<T extends Pick<TemplateSummary, "title" | "tags" | "category">>(
  templates: T[],
  query: string,
  category: string | null,
): T[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  return templates.filter((t) => {
    if (category && t.category !== category) return false;
    const haystack = foldText([t.title, ...t.tags].join(" "));
    return words.every((w) => haystack.includes(w));
  });
}

/** The categories present, built-in ones first in their usual order, then others alphabetically. */
export function templateCategories(templates: Pick<TemplateSummary, "category">[]): string[] {
  const present = new Set(templates.map((t) => t.category));
  const known = TEMPLATE_CATEGORIES.filter((c) => present.has(c));
  const others = [...present].filter((c) => !(TEMPLATE_CATEGORIES as readonly string[]).includes(c)).sort((a, b) => a.localeCompare(b));
  return [...known, ...others];
}

/** Comma- or line-separated tags, trimmed, without duplicates (case-insensitive), at most MAX_TAGS. */
export function parseTags(input: string | unknown[]): string[] {
  const raw = Array.isArray(input) ? input.filter((t): t is string => typeof t === "string") : input.split(/[,\n]/);
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of raw.map((t) => t.trim().slice(0, 40)).filter(Boolean)) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.slice(0, MAX_TAGS);
}

/**
 * Template objects placed on an artboard of another size, by the same rule as resizing a design
 * (see lib/resize.ts): uniform scale, centred, backgrounds stretched to cover.
 */
export function fitObjectsToArtboard(objects: Record<string, unknown>[], from: Size, to: Size): Record<string, unknown>[] {
  return resizeObjects(objects, from, to);
}
