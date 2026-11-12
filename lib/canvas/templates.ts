import type { IText } from "fabric";
import { withFreshIds } from "@/lib/page-ops";
import type { CanvasData } from "@/lib/page-data";
import { useEditorStore } from "@/lib/store/editor";
import { fitObjectsToArtboard, type TemplateDetail, type TemplateSummary } from "@/lib/templates";
import type { Unit } from "@/lib/units";
import { endImageModes } from "./image-modes";
import { commitHistoryStep, pageSnapshot, recordStep } from "./document";
import { getEditorInstance } from "./instance";
import { renderPageToBlob } from "./render";
import { enlivenCanvasObjects, newObjectId } from "./serialize";

const THUMBNAIL_MAX_SIDE = 480;

export async function fetchTemplate(id: string): Promise<TemplateDetail> {
  const res = await fetch(`/api/templates/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Šablonu se nepodařilo načíst (${res.status})`);
  return (await res.json()) as TemplateDetail;
}

/**
 * Replaces the open page's contents with a page of the template, as one undo step. A template of
 * another size is scaled uniformly and centred, with its background stretched to the page.
 */
export async function applyTemplatePage(template: TemplateDetail, pageIndex: number) {
  const editor = getEditorInstance();
  const data = template.pages[pageIndex];
  if (!editor || !data) return;
  const { canvas, artboard } = editor;
  endImageModes();
  const active = canvas.getActiveObject() as Partial<IText> | undefined;
  if (active?.isEditing) active.exitEditing?.();

  const fitted = fitObjectsToArtboard(withFreshIds(data, newObjectId).objects, template, artboard);
  // Fonts are loaded and images fetched before anything on the page changes.
  const objects = await enlivenCanvasObjects(fitted);
  recordStep(() => {
    canvas.discardActiveObject();
    canvas.remove(...canvas.getObjects());
    if (objects.length > 0) canvas.add(...objects);
  });
  canvas.requestRenderAll();
}

/** A small PNG of the template's first page, for the gallery. */
export function renderTemplateThumbnail(template: Pick<TemplateSummary, "width" | "height">, page: CanvasData): Promise<Blob> {
  const scale = Math.min(1, THUMBNAIL_MAX_SIDE / Math.max(template.width, template.height));
  return renderPageToBlob(page, template, { scale });
}

/** Renders a template's first page and stores it as the template thumbnail. */
export async function createTemplateThumbnail(template: TemplateDetail): Promise<Blob> {
  const blob = await renderTemplateThumbnail(template, template.pages[0] ?? { objects: [] });
  const response = await fetch(`/api/templates/${template.id}/thumbnail`, { method: "PUT", headers: { "Content-Type": "image/png" }, body: blob });
  if (!response.ok) throw new Error(`Náhled se nepodařilo uložit (${response.status})`);
  return blob;
}

export type SaveTemplateInput = { title: string; category: string; tags: string[] };

/** Saves every page of the open design, with its latest edits, as a new template. */
export async function saveDesignAsTemplate(input: SaveTemplateInput, unit: Unit): Promise<TemplateSummary> {
  const editor = getEditorInstance();
  if (!editor) throw new Error("Editor ještě není připravený");
  commitHistoryStep();
  const pages = useEditorStore
    .getState()
    .pageIds.map((id) => JSON.parse(pageSnapshot(id) ?? '{"objects":[]}') as CanvasData);
  const res = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, width: editor.artboard.width, height: editor.artboard.height, unit, pages }),
  });
  const body = (await res.json()) as TemplateSummary & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Šablonu se nepodařilo uložit");
  // The template itself is saved even if its optional thumbnail could not be stored.
  await createTemplateThumbnail({ ...body, pages }).catch(() => undefined);
  return body;
}
