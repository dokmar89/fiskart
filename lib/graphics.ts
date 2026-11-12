/**
 * The bundled graphics library (drawn by scripts/generate-graphics.ts, files in public/graphics).
 * Pure: searching the catalog. Unit tested.
 */
import catalog from "./graphics-catalog.json";
import { foldText } from "./templates";

export type GraphicEntry = { id: string; name: string; category: string; tags: string[] };

export const GRAPHICS: GraphicEntry[] = catalog;

export const GRAPHIC_CATEGORIES: string[] = [...new Set(GRAPHICS.map((g) => g.category))];

export const graphicUrl = (id: string) => `/graphics/${id}.svg`;

/** Graphics whose name, category or tags contain every word of the query (ignoring case and accents), best matches (name) first. */
export function searchGraphics(query: string, entries: GraphicEntry[] = GRAPHICS): GraphicEntry[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;
  const text = (g: GraphicEntry) => foldText([g.name, g.category, ...g.tags].join(" "));
  const matches = entries.filter((g) => words.every((w) => text(g).includes(w)));
  const inName = (g: GraphicEntry) => words.every((w) => foldText(g.name).includes(w));
  return [...matches.filter(inName), ...matches.filter((g) => !inName(g))];
}
