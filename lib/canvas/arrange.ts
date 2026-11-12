import { ActiveSelection, type FabricObject } from "fabric";
import { alignOffsets, distributeOffsets, type AlignMode } from "./align-math";
import { arrange, type ArrangeOp } from "./arrange-math";
import { recordStep } from "./document";
import { unionBox } from "./geometry";
import { getEditorInstance } from "./instance";
import { applyLock } from "./layers";
import { refreshSelection } from "./selection";

function selected(): FabricObject[] {
  return getEditorInstance()?.canvas.getActiveObjects().filter((o) => !o.locked) ?? [];
}

/** Bring forward, send backward, to front, to back; one undo step. */
export function arrangeSelection(op: ArrangeOp) {
  const editor = getEditorInstance();
  const objects = selected();
  if (!editor || objects.length === 0) return;
  const { canvas } = editor;
  const next = arrange(canvas.getObjects(), new Set(objects), op);
  recordStep(() => {
    next.forEach((o, i) => canvas.moveObjectTo(o, i));
    canvas.fire("object:modified", { target: objects[0] });
  });
  canvas.requestRenderAll();
}

/**
 * Moves the selected objects by per-object offsets computed from their page-space bounding boxes.
 * The selection is dropped first so every object is in page coordinates, then restored.
 */
function moveByOffsets(compute: (boxes: ReturnType<FabricObject["getBoundingRect"]>[]) => { dx: number; dy: number }[]) {
  const editor = getEditorInstance();
  const objects = selected();
  if (!editor || objects.length === 0) return;
  const { canvas } = editor;
  canvas.discardActiveObject();
  const offsets = compute(objects.map((o) => o.getBoundingRect()));
  recordStep(() => {
    objects.forEach((o, i) => {
      o.set({ left: o.left + offsets[i].dx, top: o.top + offsets[i].dy });
      o.setCoords();
      canvas.fire("object:modified", { target: o });
    });
  });
  canvas.setActiveObject(objects.length === 1 ? objects[0] : new ActiveSelection(objects, { canvas }));
  canvas.requestRenderAll();
  refreshSelection();
}

export function alignToPage(mode: AlignMode) {
  const editor = getEditorInstance();
  if (!editor) return;
  const page = { left: 0, top: 0, ...editor.artboard };
  moveByOffsets((boxes) => alignOffsets(boxes, page, mode));
}

export function alignToSelection(mode: AlignMode) {
  moveByOffsets((boxes) => alignOffsets(boxes, unionBox(boxes), mode));
}

export function distributeSelection(axis: "horizontal" | "vertical") {
  moveByOffsets((boxes) => distributeOffsets(boxes, axis));
}

/** Locks or unlocks everything selected, as one step. A locked multi-selection is dropped so it cannot be dragged. */
export function setSelectionLocked(locked: boolean) {
  const editor = getEditorInstance();
  if (!editor) return;
  const { canvas } = editor;
  const objects = canvas.getActiveObjects();
  if (objects.length === 0) return;
  recordStep(() => {
    objects.forEach((o) => {
      applyLock(o, locked);
      canvas.fire("object:modified", { target: o });
    });
  });
  if (locked && canvas.getActiveObject() instanceof ActiveSelection) canvas.discardActiveObject();
  canvas.requestRenderAll();
  refreshSelection();
}
