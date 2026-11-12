import { Point, Rect, type Canvas, type TMat2D } from "fabric";
import { useEditorStore } from "@/lib/store/editor";
import { getEditorInstance } from "./instance";
import {
  fitTransform,
  stepZoom,
  wheelZoomFactor,
  zoomAtPoint,
  type Matrix,
  type Size,
} from "./viewport-math";

/** Every viewport change goes through here so the zoom shown in the UI stays in sync. */
export function setViewport(canvas: Canvas, vpt: Matrix) {
  canvas.setViewportTransform(vpt as TMat2D);
  useEditorStore.getState().setZoom(vpt[0]);
  useEditorStore.setState({ viewport: [...vpt] });
}

function currentVpt(canvas: Canvas): Matrix {
  return [...canvas.viewportTransform] as Matrix;
}

export function fitArtboard(canvas: Canvas, artboard: Size) {
  setViewport(canvas, fitTransform({ width: canvas.width, height: canvas.height }, artboard));
}

/** Clips rendering of objects to the page. Hit-testing ignores it, so objects outside stay selectable. */
export function pageClip(size: Size): Rect {
  return new Rect({ left: 0, top: 0, width: size.width, height: size.height, strokeWidth: 0 });
}

/**
 * Gives the mounted canvas a new page size: the clip and the white page follow (both read the
 * same size object), and the view is fitted to the new page.
 */
export function setArtboardSize(canvas: Canvas, artboard: Size, size: Size) {
  artboard.width = size.width;
  artboard.height = size.height;
  canvas.clipPath = pageClip(size);
  fitArtboard(canvas, artboard);
  canvas.requestRenderAll();
}

export function zoomAt(canvas: Canvas, at: { x: number; y: number }, zoom: number) {
  setViewport(canvas, zoomAtPoint(currentVpt(canvas), at, zoom));
}

export function panBy(canvas: Canvas, dx: number, dy: number) {
  canvas.relativePan(new Point(dx, dy));
}

/** Zoom buttons in the bottom bar: step around the centre of the viewport. */
export function zoomStep(direction: 1 | -1) {
  const editor = getEditorInstance();
  if (!editor) return;
  const { canvas } = editor;
  zoomAt(canvas, { x: canvas.width / 2, y: canvas.height / 2 }, stepZoom(canvas.getZoom(), direction));
}

export function zoomToFit() {
  const editor = getEditorInstance();
  if (editor) fitArtboard(editor.canvas, editor.artboard);
}

/**
 * Wheel zooms towards the cursor with Ctrl/Cmd (a trackpad pinch also arrives as Ctrl + wheel),
 * and pans otherwise.
 */
export function handleWheel(canvas: Canvas, e: WheelEvent) {
  e.preventDefault();
  const rect = canvas.upperCanvasEl.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey) {
    const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    zoomAt(canvas, at, canvas.getZoom() * wheelZoomFactor(e.deltaY, e.deltaMode));
    return;
  }
  const scale = e.deltaMode === 1 ? 16 : 1;
  // A plain mouse wheel only scrolls vertically; Shift turns that into horizontal scrolling.
  const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
  const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
  panBy(canvas, -dx * scale, -dy * scale);
}
