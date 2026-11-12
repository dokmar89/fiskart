import type { Canvas } from "fabric";
import { NO_GUIDES, type Guides } from "@/lib/guides";
import { useEditorStore } from "@/lib/store/editor";

/**
 * The guides of the page on a canvas. Kept beside the canvas rather than as Fabric objects, so they
 * never show in exports, the layers panel or selections; saved with the page by serialize.ts.
 */
const byCanvas = new WeakMap<Canvas, Guides>();

export function guidesOf(canvas: Canvas): Guides {
  return byCanvas.get(canvas) ?? NO_GUIDES;
}

export function setCanvasGuides(canvas: Canvas, guides: Guides) {
  byCanvas.set(canvas, guides);
  useEditorStore.setState({ guides });
  canvas.requestRenderAll();
}
