import type { Canvas } from "fabric";
import { DEFAULT_TIMING, type PageTiming } from "@/lib/animation";
import { useEditorStore } from "@/lib/store/editor";
import { recordStep } from "./document";
import { getEditorInstance } from "./instance";

/**
 * The timing of the page on a canvas (duration, transition, page animation). Kept beside the
 * canvas like its guides and saved with the page by serialize.ts.
 */
const byCanvas = new WeakMap<Canvas, PageTiming>();

export function timingOf(canvas: Canvas): PageTiming {
  return byCanvas.get(canvas) ?? DEFAULT_TIMING;
}

export function setCanvasTiming(canvas: Canvas, timing: PageTiming) {
  byCanvas.set(canvas, timing);
  useEditorStore.setState({ timing });
}

export const isDefaultTiming = (t: PageTiming) => JSON.stringify(t) === JSON.stringify(DEFAULT_TIMING);

/** Changes the open page's timing, as one undo step. */
export function changeTiming(change: Partial<PageTiming>) {
  const editor = getEditorInstance();
  if (!editor) return;
  const { canvas } = editor;
  recordStep(() => setCanvasTiming(canvas, { ...timingOf(canvas), ...change }));
}
