import type { Canvas } from "fabric";
import { NO_GUIDES, withGuide, type GuideAxis } from "@/lib/guides";
import { useEditorStore } from "@/lib/store/editor";
import { recordStep } from "./document";
import { guidesOf, setCanvasGuides } from "./guide-state";
import { getEditorInstance } from "./instance";

export const GUIDE_LINE_COLOR = "#06b6d4";

/**
 * Adds (index null), moves or removes (position null) a guide of the open page, as one undo step.
 * Positions are page pixels.
 */
export function changeGuide(axis: GuideAxis, index: number | null, position: number | null) {
  const editor = getEditorInstance();
  if (!editor) return;
  const { canvas } = editor;
  recordStep(() => setCanvasGuides(canvas, withGuide(guidesOf(canvas), axis, index, position)));
}

/** Removes every guide of the open page, as one undo step. */
export function clearGuides() {
  const editor = getEditorInstance();
  if (!editor) return;
  const { canvas } = editor;
  recordStep(() => setCanvasGuides(canvas, NO_GUIDES));
}

const KEY = "opencanva:rulers";

export function setRulersShown(show: boolean) {
  useEditorStore.setState({ showRulers: show });
  try {
    localStorage.setItem(KEY, show ? "1" : "0");
  } catch {
    // Not remembered; it still applies now.
  }
}

/** Draws the page's guides across the whole view while rulers are shown. Returns a cleanup function. */
export function installGuides(canvas: Canvas) {
  try {
    if (localStorage.getItem(KEY) === "1") useEditorStore.setState({ showRulers: true });
  } catch {
    // Storage blocked: rulers start hidden.
  }
  const onAfterRender = ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    if (ctx !== canvas.getContext() || !useEditorStore.getState().showRulers) return;
    const { vertical, horizontal } = guidesOf(canvas);
    if (vertical.length === 0 && horizontal.length === 0) return;
    const v = canvas.viewportTransform;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const ratio = canvas.getRetinaScaling();
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = GUIDE_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of vertical) {
      const sx = Math.round(x * v[0] + v[4]) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, canvas.height);
    }
    for (const y of horizontal) {
      const sy = Math.round(y * v[3] + v[5]) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(canvas.width, sy);
    }
    ctx.stroke();
    ctx.restore();
  };
  canvas.on("after:render", onAfterRender);
  const unsubscribe = useEditorStore.subscribe((s, prev) => {
    if (s.showRulers !== prev.showRulers) canvas.requestRenderAll();
  });
  return () => {
    canvas.off("after:render", onAfterRender);
    unsubscribe();
  };
}
