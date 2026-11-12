import type { IText } from "fabric";
import type { CanvasData } from "@/lib/page-data";
import { fullBleedImageSources, resizePage, type Size } from "@/lib/resize";
import { endImageModes } from "./image-modes";
import { designPages, flushSave, resizeOpenDesign, type DesignSize } from "./document";
import { getEditorInstance } from "./instance";
import { runWithPagesLocked } from "./pages";
import { renderPageToBlob } from "./render";

const THUMBNAIL_MAX_SIDE = 480;

/** Natural size of an image, or undefined when it cannot be loaded (it is then cropped from what was in view). */
async function naturalSize(src: string): Promise<Size | undefined> {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    return undefined;
  }
  return image.naturalWidth > 0 && image.naturalHeight > 0 ? { width: image.naturalWidth, height: image.naturalHeight } : undefined;
}

function endEditing() {
  const editor = getEditorInstance();
  endImageModes();
  const active = editor?.canvas.getActiveObject() as Partial<IText> | undefined;
  if (active?.isEditing) active.exitEditing?.();
  editor?.canvas.discardActiveObject();
}

/** Every page of the open design with its latest edits, resized to `to`. */
async function resizedPages(to: DesignSize) {
  const design = designPages();
  if (!design) throw new Error("Editor ještě není připravený");
  const parsed = new Map([...design.pages].map(([id, s]) => [id, JSON.parse(s) as CanvasData]));
  const sources = fullBleedImageSources([...parsed.values()], design.size);
  const sizes = new Map(await Promise.all(sources.map(async (src) => [src, await naturalSize(src)] as const)));
  const pages = new Map([...parsed].map(([id, data]) => [id, resizePage(data, design.size, to, (src) => sizes.get(src))]));
  return { from: design.size, pages };
}

/** Resizes every page of the open design, as one undo step. */
export function resizeDesign(to: DesignSize): Promise<void> {
  return runWithPagesLocked(async () => {
    endEditing();
    const { pages } = await resizedPages(to);
    await resizeOpenDesign(to, new Map([...pages].map(([id, data]) => [id, JSON.stringify(data)])));
  });
}

/**
 * Creates a copy of the open design at another size, with every page resized, and returns its id.
 * The open design is left as it is (and saved).
 */
export function copyAndResizeDesign(to: DesignSize): Promise<string> {
  return runWithPagesLocked(async () => {
    endEditing();
    const editor = getEditorInstance();
    if (!editor) throw new Error("Editor ještě není připravený");
    const { pages } = await resizedPages(to);
    const list = [...pages.values()];
    const res = await fetch(`/api/projects/${editor.projectId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: to.width, height: to.height, unit: to.unit, pages: list }),
    });
    const body = (await res.json()) as { id?: string; error?: string };
    if (!res.ok || !body.id) throw new Error(body.error ?? "Kopii se nepodařilo vytvořit");
    try {
      const scale = Math.min(1, THUMBNAIL_MAX_SIDE / Math.max(to.width, to.height));
      const blob = await renderPageToBlob(list[0] ?? { objects: [] }, { width: to.width, height: to.height }, { scale });
      await fetch(`/api/projects/${body.id}/thumbnail`, { method: "PUT", headers: { "Content-Type": "image/png" }, body: blob });
    } catch (error) {
      // The copy's editor makes a thumbnail on its first save.
      console.warn("Thumbnail of the copy failed", error);
    }
    await flushSave();
    return body.id;
  });
}
