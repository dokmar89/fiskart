import { ActiveSelection, type Canvas, type FabricObject } from "fabric";
import { recordStep } from "./document";
import { cloneObject, newObjectId } from "./serialize";

const PASTE_OFFSET = 20;

// Copied objects live in memory only; images pasted from the system clipboard are handled in shortcuts.ts.
let clipboard: FabricObject | null = null;

function assignNewIds(object: FabricObject) {
  if (object instanceof ActiveSelection) object.forEachObject((o) => o.set({ id: newObjectId() }));
  else object.set({ id: newObjectId() });
}

/** Adds a clone (single object or active selection) to the canvas, offset, and selects it. */
async function insertClone(canvas: Canvas, source: FabricObject, offset: number) {
  // A placeholder only stands in for an object that failed to load; a copy of it would be a plain rectangle.
  if (source.placeholderFor) return;
  const clone = await cloneObject(source);
  assignNewIds(clone);
  clone.set({ left: clone.left + offset, top: clone.top + offset, evented: true });
  recordStep(() => {
    canvas.discardActiveObject();
    if (clone instanceof ActiveSelection) {
      clone.canvas = canvas;
      clone.forEachObject((o) => canvas.add(o));
      clone.setCoords();
    } else {
      canvas.add(clone);
    }
    canvas.setActiveObject(clone);
  });
  canvas.requestRenderAll();
}

/** Deletes the selection; locked objects (selectable only from the layers panel) stay until unlocked. */
export function deleteSelection(canvas: Canvas) {
  const objects = canvas.getActiveObjects().filter((o) => !o.locked);
  if (objects.length === 0) return;
  recordStep(() => {
    canvas.discardActiveObject();
    canvas.remove(...objects);
  });
  canvas.requestRenderAll();
}

export async function duplicateSelection(canvas: Canvas) {
  const active = canvas.getActiveObject();
  if (active) await insertClone(canvas, active, PASTE_OFFSET);
}

export async function copySelection(canvas: Canvas) {
  const active = canvas.getActiveObject();
  if (active) clipboard = await cloneObject(active);
}

export async function cutSelection(canvas: Canvas) {
  if (!canvas.getActiveObject()) return;
  await copySelection(canvas);
  deleteSelection(canvas);
}

export async function paste(canvas: Canvas) {
  if (!clipboard) return;
  await insertClone(canvas, clipboard, PASTE_OFFSET);
  // Each further paste lands one step further along, so repeated pastes do not stack exactly.
  clipboard.set({ left: clipboard.left + PASTE_OFFSET, top: clipboard.top + PASTE_OFFSET });
}

export function selectAll(canvas: Canvas) {
  const objects = canvas.getObjects().filter((o) => o.selectable && o.visible);
  if (objects.length === 0) return;
  canvas.discardActiveObject();
  canvas.setActiveObject(objects.length === 1 ? objects[0] : new ActiveSelection(objects, { canvas }));
  canvas.requestRenderAll();
}

export function deselect(canvas: Canvas) {
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

export function nudgeSelection(canvas: Canvas, dx: number, dy: number) {
  const active = canvas.getActiveObject();
  if (!active || active.lockMovementX || active.lockMovementY) return;
  active.set({ left: active.left + dx, top: active.top + dy });
  active.setCoords();
  canvas.fire("object:modified", { target: active });
  canvas.requestRenderAll();
}
