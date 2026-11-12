import type { Canvas } from "fabric";
import { useEditorStore } from "@/lib/store/editor";
import type { Box } from "./geometry";
import { guidesOf } from "./guide-state";
import { snap, snapTargets, type Guide, type SnapTargets } from "./snap-math";
import { spacingSnap, type SpacingMark } from "./spacing-math";
import type { Size } from "./viewport-math";

/** Snap distance in screen pixels, whatever the zoom. */
const SNAP_SCREEN_DISTANCE = 6;
const GUIDE_COLOR = "#ec4899";

/**
 * While an object or selection is dragged, snaps its edges and centre to the page's, to other
 * objects' edges and centres and (while rulers are shown) to the page's guides, and draws guide
 * lines. On an axis with nothing to align to, it snaps to equal spacing between neighbours and
 * draws the gaps. Holding Alt (Option) turns it off. Targets are collected once per drag, so
 * documents with many objects stay smooth.
 */
export function installSnapping(canvas: Canvas, page: Size) {
  let targets: SnapTargets | null = null;
  let others: Box[] = [];
  let guides: Guide[] = [];
  let marks: SpacingMark[] = [];

  const onMoving = ({ target, e }: { target: Canvas["_activeObject"]; e: Event }) => {
    if (!target) return;
    if ((e as MouseEvent).altKey) {
      guides = [];
      marks = [];
      return;
    }
    if (!targets) {
      const moving = new Set(canvas.getActiveObjects());
      others = canvas
        .getObjects()
        .filter((o) => o.visible && !moving.has(o) && o !== target)
        .map((o) => o.getBoundingRect());
      targets = snapTargets(others, page);
      if (useEditorStore.getState().showRulers) {
        const g = guidesOf(canvas);
        targets.vertical.push(...g.vertical.map((pos) => ({ pos, start: 0, end: page.height })));
        targets.horizontal.push(...g.horizontal.map((pos) => ({ pos, start: 0, end: page.width })));
      }
    }
    target.setCoords();
    const threshold = SNAP_SCREEN_DISTANCE / canvas.getZoom();
    const box = target.getBoundingRect();
    const result = snap(box, targets, threshold);
    let { dx, dy } = result;
    marks = [];
    if (dx === 0) {
      const spacing = spacingSnap(box, others, "x", threshold);
      dx = spacing.shift;
      marks.push(...spacing.marks);
    }
    if (dy === 0) {
      const spacing = spacingSnap({ ...box, left: box.left + dx }, others, "y", threshold);
      dy = spacing.shift;
      marks.push(...spacing.marks);
    }
    if (dx !== 0 || dy !== 0) {
      target.set({ left: target.left + dx, top: target.top + dy });
      target.setCoords();
    }
    guides = result.guides;
  };

  const onMouseUp = () => {
    targets = null;
    if (guides.length > 0 || marks.length > 0) {
      guides = [];
      marks = [];
      canvas.requestRenderAll();
    }
  };

  const onAfterRender = ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    if ((guides.length === 0 && marks.length === 0) || ctx !== canvas.getContext()) return;
    const v = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    ctx.save();
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    for (const g of guides) {
      if (g.orientation === "vertical") {
        ctx.moveTo(g.pos, g.start);
        ctx.lineTo(g.pos, g.end);
      } else {
        ctx.moveTo(g.start, g.pos);
        ctx.lineTo(g.end, g.pos);
      }
    }
    // Equal gaps: a line across each gap with short end ticks.
    const tick = 5 / zoom;
    for (const m of marks) {
      if (m.axis === "x") {
        ctx.moveTo(m.start, m.at);
        ctx.lineTo(m.end, m.at);
        ctx.moveTo(m.start, m.at - tick);
        ctx.lineTo(m.start, m.at + tick);
        ctx.moveTo(m.end, m.at - tick);
        ctx.lineTo(m.end, m.at + tick);
      } else {
        ctx.moveTo(m.at, m.start);
        ctx.lineTo(m.at, m.end);
        ctx.moveTo(m.at - tick, m.start);
        ctx.lineTo(m.at + tick, m.start);
        ctx.moveTo(m.at - tick, m.end);
        ctx.lineTo(m.at + tick, m.end);
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  canvas.on("object:moving", onMoving);
  canvas.on("mouse:up", onMouseUp);
  canvas.on("after:render", onAfterRender);
  return () => {
    canvas.off("object:moving", onMoving);
    canvas.off("mouse:up", onMouseUp);
    canvas.off("after:render", onAfterRender);
  };
}
