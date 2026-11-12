import type { Canvas } from "fabric";
import type { Size } from "./viewport-math";

export type EditorInstance = {
  canvas: Canvas;
  projectId: string;
  /** Page size in scene pixels; the artboard spans (0, 0) to (width, height). */
  artboard: Size;
};

// One editor is mounted at a time. UI code calls the functions in lib/canvas/, which find the canvas here.
let current: EditorInstance | null = null;

export function setEditorInstance(instance: EditorInstance | null) {
  current = instance;
}

export function getEditorInstance(): EditorInstance | null {
  return current;
}
