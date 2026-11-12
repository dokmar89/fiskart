import type { IText } from "fabric";
import { countInPages, replaceInPages, type FindOptions } from "@/lib/find-replace";
import type { CanvasData } from "@/lib/page-data";
import { designPages, resizeOpenDesign } from "./document";
import { endImageModes } from "./image-modes";
import { getEditorInstance } from "./instance";
import { runWithPagesLocked } from "./pages";

function pagesData() {
  const design = designPages();
  if (!design) return null;
  return { size: design.size, ids: [...design.pages.keys()], data: [...design.pages.values()].map((s) => JSON.parse(s) as CanvasData) };
}

/** How often the query occurs on each page of the open design (its latest edits included). */
export function findInDesign(query: string, options: FindOptions): number[] {
  const pages = pagesData();
  return pages ? countInPages(pages.data, query, options) : [];
}

/**
 * Replaces the query on every page, as one undo step for the whole design (it goes through the same
 * all-pages change as a resize, at the same size). Returns how many were replaced.
 */
export function replaceInDesign(query: string, replacement: string, options: FindOptions): Promise<number> {
  return runWithPagesLocked(async () => {
    const editor = getEditorInstance();
    endImageModes();
    const active = editor?.canvas.getActiveObject() as Partial<IText> | undefined;
    if (active?.isEditing) active.exitEditing?.();
    editor?.canvas.discardActiveObject();
    const pages = pagesData();
    if (!pages) return 0;
    const { pages: replaced, counts } = replaceInPages(pages.data, query, replacement, options);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    await resizeOpenDesign(pages.size, new Map(pages.ids.map((id, i) => [id, JSON.stringify(replaced[i])])));
    return total;
  });
}
