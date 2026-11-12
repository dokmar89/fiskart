import { ActiveSelection, type Canvas, type FabricObject } from "fabric";
import { useEditorStore, type LayerInfo } from "@/lib/store/editor";
import { recordStep } from "./document";
import { getEditorInstance } from "./instance";

/**
 * Locking takes an object out of canvas interaction entirely: it cannot be hit, selected by click
 * or marquee, moved, scaled or rotated there. The layers panel can still select it.
 */
export function applyLock(object: FabricObject, locked: boolean) {
  object.set({
    locked,
    selectable: !locked,
    evented: !locked,
    hasControls: !locked,
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
  });
}

function layerInfo(o: FabricObject): LayerInfo {
  return {
    id: o.id ?? "",
    name: o.name ?? o.type,
    type: o.type,
    visible: o.visible,
    locked: Boolean(o.locked),
  };
}

/** Keeps the store's read-only layer list and selected ids in step with the canvas. Returns a cleanup function. */
export function installLayerSync(canvas: Canvas) {
  let frame = 0;
  const sync = () => {
    if (frame) return;
    // Several events often arrive together (a multi-object paste); refresh once per frame.
    frame = requestAnimationFrame(() => {
      frame = 0;
      useEditorStore.setState({
        layers: canvas.getObjects().map(layerInfo).reverse(),
        selectedIds: canvas.getActiveObjects().map((o) => o.id ?? ""),
      });
    });
  };
  const events = [
    "object:added",
    "object:removed",
    "object:modified",
    "selection:created",
    "selection:updated",
    "selection:cleared",
  ] as const;
  events.forEach((e) => canvas.on(e, sync));
  sync();
  return () => {
    events.forEach((e) => canvas.off(e, sync));
    cancelAnimationFrame(frame);
    useEditorStore.setState({ layers: [], selectedIds: [] });
  };
}

function find(id: string): { canvas: Canvas; object: FabricObject } | null {
  const editor = getEditorInstance();
  const object = editor?.canvas.getObjects().find((o) => o.id === id);
  return editor && object ? { canvas: editor.canvas, object } : null;
}

/**
 * Applies a layer change as its own undo step, and tells history, autosave and the layer list
 * about it: Fabric reports no event for property or stacking changes made in code.
 */
function change(canvas: Canvas, object: FabricObject, mutate: () => void) {
  recordStep(() => {
    mutate();
    canvas.fire("object:modified", { target: object });
  });
  canvas.requestRenderAll();
}

/**
 * Selects a layer. With `additive`, toggles it in a multi-selection; locked layers are only ever
 * selected alone, so dragging a selection can never move them.
 */
export function selectLayer(id: string, additive: boolean) {
  const hit = find(id);
  if (!hit) return;
  const { canvas, object } = hit;
  const current = canvas.getActiveObjects();
  if (!additive || object.locked || current.some((o) => o.locked)) {
    canvas.discardActiveObject();
    canvas.setActiveObject(object);
  } else {
    const next = current.includes(object) ? current.filter((o) => o !== object) : [...current, object];
    canvas.discardActiveObject();
    if (next.length === 1) canvas.setActiveObject(next[0]);
    else if (next.length > 1) canvas.setActiveObject(new ActiveSelection(next, { canvas }));
  }
  canvas.requestRenderAll();
}

export function renameLayer(id: string, name: string) {
  const hit = find(id);
  const trimmed = name.trim();
  if (!hit || !trimmed || trimmed === hit.object.name) return;
  change(hit.canvas, hit.object, () => hit.object.set({ name: trimmed }));
}

export function toggleLayerVisible(id: string) {
  const hit = find(id);
  if (!hit) return;
  const { canvas, object } = hit;
  if (object.visible && canvas.getActiveObjects().includes(object)) canvas.discardActiveObject();
  change(canvas, object, () => object.set({ visible: !object.visible }));
}

export function toggleLayerLocked(id: string) {
  const hit = find(id);
  if (!hit) return;
  const { canvas, object } = hit;
  // A locked object must not stay inside a multi-selection that can be dragged.
  if (canvas.getActiveObject() instanceof ActiveSelection && canvas.getActiveObjects().includes(object)) {
    canvas.discardActiveObject();
  }
  change(canvas, object, () => applyLock(object, !object.locked));
}

/** Moves a layer to a position in the panel's order (0 = top of the stack). */
export function moveLayer(id: string, panelIndex: number) {
  const hit = find(id);
  if (!hit) return;
  const { canvas, object } = hit;
  const count = canvas.getObjects().length;
  const target = Math.max(0, Math.min(count - 1, count - 1 - panelIndex));
  if (canvas.getObjects().indexOf(object) === target) return;
  change(canvas, object, () => canvas.moveObjectTo(object, target));
}
