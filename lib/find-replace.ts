/**
 * Find and replace across a design's pages, on stored page JSON. Covers text boxes, curved text
 * and table cells, inside groups too. Pure, unit tested.
 */
import type { CanvasData } from "./page-data";

export type FindOptions = { matchCase: boolean };

function pattern(query: string, options: FindOptions): RegExp {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), options.matchCase ? "g" : "gi");
}

export function countIn(text: string, query: string, options: FindOptions): number {
  if (!query) return 0;
  return text.match(pattern(query, options))?.length ?? 0;
}

export function replaceIn(text: string, query: string, replacement: string, options: FindOptions): { text: string; count: number } {
  if (!query) return { text, count: 0 };
  let count = 0;
  const result = text.replace(pattern(query, options), () => {
    count++;
    return replacement;
  });
  return { text: result, count };
}

type Obj = Record<string, unknown>;
const TEXT_TYPES = new Set(["textbox", "text", "i-text", "itext", "curvedtext"]);

/** Applies `edit` to every piece of text on a page; returns the page (a copy only where something changed). */
function mapTexts(objects: Obj[], edit: (text: string) => string): Obj[] {
  return objects.map((o) => {
    let next = o;
    const type = typeof o.type === "string" ? o.type.toLowerCase() : "";
    if (TEXT_TYPES.has(type) && typeof o.text === "string") {
      const text = edit(o.text);
      // Per-character styles are keyed by position, which a replacement shifts; the editor does not use them.
      if (text !== o.text) next = { ...next, text, styles: [] };
    }
    const table = o.table as { cells?: { text?: unknown }[][] } | undefined;
    if (type === "table" && table && Array.isArray(table.cells)) {
      let changed = false;
      const cells = table.cells.map((row) =>
        Array.isArray(row)
          ? row.map((cell) => {
              if (!cell || typeof cell.text !== "string") return cell;
              const text = edit(cell.text);
              if (text === cell.text) return cell;
              changed = true;
              return { ...cell, text };
            })
          : row,
      );
      if (changed) next = { ...next, table: { ...table, cells } };
    }
    if (Array.isArray(o.objects)) {
      const children = mapTexts(o.objects as Obj[], edit);
      if (children.some((c, i) => c !== (o.objects as Obj[])[i])) next = { ...next, objects: children };
    }
    return next;
  });
}

/** How often the query occurs on each page. */
export function countInPages(pages: CanvasData[], query: string, options: FindOptions): number[] {
  return pages.map((page) => {
    let count = 0;
    mapTexts(page.objects, (text) => {
      count += countIn(text, query, options);
      return text;
    });
    return count;
  });
}

/** Every page with the query replaced, and how many replacements were made on each. */
export function replaceInPages(pages: CanvasData[], query: string, replacement: string, options: FindOptions): { pages: CanvasData[]; counts: number[] } {
  const counts: number[] = [];
  const result = pages.map((page) => {
    let count = 0;
    const objects = mapTexts(page.objects, (text) => {
      const r = replaceIn(text, query, replacement, options);
      count += r.count;
      return r.text;
    });
    counts.push(count);
    return count > 0 ? { ...page, objects } : page;
  });
  return { pages: result, counts };
}
