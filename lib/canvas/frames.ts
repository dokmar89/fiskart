import { ActiveSelection, FabricImage, Path, Point, type Canvas, type FabricObject, type TPointerEventInfo } from "fabric";
import { gridCells } from "@/lib/photo-grid";
import { FRAME_LABELS, frameCrop, framePath, frameZoom, panCrop, type FrameShape } from "@/lib/frames";
import { DeviceFrame } from "./device-frame";
import { useEditorStore } from "@/lib/store/editor";
import { drawHiddenParts } from "./crop";
import { loadDesignImage } from "./design-image";
import { commitHistoryStep, recordStep } from "./document";
import { artboardScale, placeObject } from "./elements";
import { getEditorInstance } from "./instance";
import { newObjectId } from "./serialize";

/** Fill of an empty frame: a quiet grey that reads as "something goes here". */
const EMPTY_FILL = "#d4d4d8";

/** An empty frame (a placeholder shape) or a filled one (a clipped image). */
export function isFrame(o: FabricObject | undefined | null): o is FabricObject & { frame: FrameShape } {
  return Boolean(o?.frame) && (o instanceof Path || o instanceof FabricImage);
}

export const isFilledFrame = (o: FabricObject | undefined | null): o is FabricImage => isFrame(o) && o instanceof FabricImage;

/** The clip path of a framed image: the shape over the image's own (cropped) pixels, centred like Fabric expects. */
function frameClip(shape: FrameShape, width: number, height: number, radius = 0): Path {
  return new Path(framePath(shape, width, height, radius), { left: 0, top: 0, originX: "center", originY: "center", strokeWidth: 0 });
}

/** Brings a framed image's clip path in step with its crop size. */
export function refreshFrameClip(image: FabricImage) {
  if (!image.frame) return;
  image.clipPath = frameClip(image.frame, image.width, image.height, image.frameRadius);
  image.set({ dirty: true });
}

/** An empty frame of a shape and size, not yet on the page. */
export function createFrame(shape: FrameShape, width: number, height: number, cornerRadius = 0): Path {
  const frameRadius = shape === "square" ? Math.min(0.5, Math.max(0, cornerRadius) / Math.min(width, height)) : 0;
  const device = ["phone", "tablet", "smartwatch", "laptop", "browser"].includes(shape);
  const frame = new (device ? DeviceFrame : Path)(framePath(shape, width, height, frameRadius), {
    fill: EMPTY_FILL,
    stroke: device ? "#20232b" : undefined,
    strokeWidth: device ? Math.min(width, height) * 0.035 : 0,
  });
  frame.set({ frame: shape, frameRadius, name: `Rámeček (${FRAME_LABELS[shape].toLowerCase()})` });
  return frame;
}

export function addFrame(shape: FrameShape) {
  const editor = getEditorInstance();
  if (!editor) return;
  const size = 400 * artboardScale(editor.artboard);
  placeObject(createFrame(shape, size, size), `Rámeček (${FRAME_LABELS[shape].toLowerCase()})`);
}

/**
 * Adds a photo grid: square frames laid out in the middle of the page with even spacing, selected
 * together. Each cell is an ordinary frame (drop an image on it; double-click to move it inside).
 */
export function addPhotoGrid(layoutId: string, spacing: number, cornerRadius = 0) {
  const editor = getEditorInstance();
  if (!editor) return;
  const { canvas, artboard } = editor;
  const area = { left: artboard.width * 0.08, top: artboard.height * 0.08, width: artboard.width * 0.84, height: artboard.height * 0.84 };
  const cells = gridCells(layoutId, area, spacing * artboardScale(artboard));
  if (cells.length === 0) return;
  const frames = cells.map((cell, i) => {
    const frame = createFrame("square", cell.width, cell.height, cornerRadius * artboardScale(artboard));
    frame.set({ id: newObjectId(), name: `Buňka mřížky ${i + 1}`, locked: false, angle: cell.angle ?? 0 });
    if (cell.angle) frame.set({ stroke: "#ffffff", strokeWidth: Math.min(cell.width, cell.height) * 0.045 });
    frame.setPositionByOrigin(new Point(cell.left + cell.width / 2, cell.top + cell.height / 2), "center", "center");
    frame.setCoords();
    return frame;
  });
  recordStep(() => {
    canvas.add(...frames);
    canvas.setActiveObject(new ActiveSelection(frames, { canvas }));
  });
  canvas.requestRenderAll();
}

/** The top-most frame under a page point. */
export function frameAt(canvas: Canvas, at: { x: number; y: number }): FabricObject | null {
  const point = new Point(at.x, at.y);
  const objects = canvas.getObjects();
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (isFrame(o) && o.visible && !o.locked && o.containsPoint(point)) return o;
  }
  return null;
}

/**
 * Puts an image into a frame: the image fills the frame's box (cropped, never distorted) and is
 * clipped by its shape. An image already in the frame is replaced. One undo step.
 */
export async function fillFrame(target: FabricObject, url: string) {
  const editor = getEditorInstance();
  if (!editor || !isFrame(target)) return;
  const { canvas } = editor;
  const image = await loadDesignImage(url);
  const natural = { width: image.width, height: image.height };
  const box = { width: target.width * Math.abs(target.scaleX), height: target.height * Math.abs(target.scaleY) };
  const crop = frameCrop(natural, box.width / box.height, 1);
  image.set({
    cropX: crop.x,
    cropY: crop.y,
    width: crop.width,
    height: crop.height,
    scaleX: box.width / crop.width,
    scaleY: box.height / crop.height,
    angle: target.angle,
    opacity: target.opacity,
    frame: target.frame,
    frameRadius: target.frameRadius,
    stroke: target.stroke,
    strokeWidth: target.strokeWidth,
    id: target.id,
    name: target.name,
    locked: false,
  });
  refreshFrameClip(image);
  image.setPositionByOrigin(target.getCenterPoint(), "center", "center");
  image.setCoords();
  recordStep(() => {
    const index = canvas.getObjects().indexOf(target);
    if (index < 0) return;
    canvas.remove(target);
    canvas.insertAt(index, image);
    canvas.setActiveObject(image);
  });
  canvas.requestRenderAll();
}

/** The selected object when it is a frame the next placed image should go into. */
export function selectedFrame(): FabricObject | null {
  const active = getEditorInstance()?.canvas.getActiveObject();
  return isFrame(active) && !active.locked ? active : null;
}

type RepositionSession = { image: FabricImage; canvas: Canvas; cleanup: () => void };
let session: RepositionSession | null = null;

export const isRepositioning = () => session !== null;

/** A framed image's crop region in its own pixels. */
const cropOf = (image: FabricImage) => ({ x: image.cropX, y: image.cropY, width: image.width, height: image.height });

/**
 * Moves the selected framed image inside its frame: dragging pans it, the toolbar zooms it. The
 * frame stays where it is. Ends on Done, Enter, Escape or when the selection changes.
 */
export function startReposition() {
  const editor = getEditorInstance();
  const image = editor?.canvas.getActiveObject();
  if (!editor || !isFilledFrame(image) || image.locked || session) return;
  const { canvas } = editor;
  const natural = image.getOriginalSize();
  let drag: { from: Point; crop: ReturnType<typeof cropOf> } | null = null;

  /** A page-space movement in the image's own pixels (rotation, scale and flips undone). */
  const toImage = (dx: number, dy: number) => {
    const a = (-image.angle * Math.PI) / 180;
    const rx = dx * Math.cos(a) - dy * Math.sin(a);
    const ry = dx * Math.sin(a) + dy * Math.cos(a);
    return { x: (rx / image.scaleX) * (image.flipX ? -1 : 1), y: (ry / image.scaleY) * (image.flipY ? -1 : 1) };
  };

  const onMouseDown = (opt: TPointerEventInfo) => {
    if (opt.target !== image) return;
    drag = { from: opt.scenePoint, crop: cropOf(image) };
  };
  const onMouseMove = (opt: TPointerEventInfo) => {
    if (!drag) return;
    const d = toImage(opt.scenePoint.x - drag.from.x, opt.scenePoint.y - drag.from.y);
    // Dragging the picture right shows more of its left side.
    const next = panCrop(drag.crop, natural, -d.x, -d.y);
    image.set({ cropX: next.x, cropY: next.y, dirty: true });
    canvas.requestRenderAll();
  };
  const onMouseUp = () => {
    if (!drag) return;
    drag = null;
    canvas.fire("object:modified", { target: image });
  };
  const onAfterRender = ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    if (ctx === canvas.getContext()) drawHiddenParts(canvas, ctx, image);
  };
  const onSelectionChange = () => endReposition();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      endReposition();
    }
  };

  const previous = { lockMovementX: image.lockMovementX, lockMovementY: image.lockMovementY, hasControls: image.hasControls };
  image.set({ lockMovementX: true, lockMovementY: true, hasControls: false, borderDashArray: [6, 4], hoverCursor: "grab" });
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:up", onMouseUp);
  canvas.on("after:render", onAfterRender);
  canvas.on("selection:updated", onSelectionChange);
  canvas.on("selection:cleared", onSelectionChange);
  // Captured before the editor's shortcuts, so Escape ends this without also deselecting.
  window.addEventListener("keydown", onKeyDown, { capture: true });

  session = {
    image,
    canvas,
    cleanup: () => {
      image.set({ ...previous, borderDashArray: null, hoverCursor: null });
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
      canvas.off("after:render", onAfterRender);
      canvas.off("selection:updated", onSelectionChange);
      canvas.off("selection:cleared", onSelectionChange);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    },
  };
  useEditorStore.setState({ repositioning: { zoom: frameZoom(natural, image) } });
  canvas.requestRenderAll();
}

export function endReposition() {
  if (!session) return;
  const { canvas, cleanup } = session;
  session = null;
  cleanup();
  useEditorStore.setState({ repositioning: null });
  canvas.requestRenderAll();
}

let zoomGesture = false;

/**
 * Zooms the image inside its frame around the centre of what shows. The frame keeps its size.
 * Live changes become one undo step on commit.
 */
export function setFrameZoom(zoom: number, mode: "live" | "commit") {
  if (!session) return;
  const { image, canvas } = session;
  if (mode === "live" && !zoomGesture) {
    commitHistoryStep();
    zoomGesture = true;
  }
  const natural = image.getOriginalSize();
  const box = { width: image.width * image.scaleX, height: image.height * image.scaleY };
  const centre = image.getCenterPoint();
  const crop = cropOf(image);
  const next = frameCrop(natural, crop.width / crop.height, zoom, { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 });
  image.set({
    cropX: next.x,
    cropY: next.y,
    width: next.width,
    height: next.height,
    scaleX: box.width / next.width,
    scaleY: box.height / next.height,
  });
  refreshFrameClip(image);
  image.setPositionByOrigin(centre, "center", "center");
  image.setCoords();
  useEditorStore.setState({ repositioning: { zoom: frameZoom(natural, image) } });
  canvas.requestRenderAll();
  if (mode === "commit") {
    zoomGesture = false;
    canvas.fire("object:modified", { target: image });
    commitHistoryStep();
  }
}

/** Double-clicking a framed image starts moving it inside its frame. Returns a cleanup function. */
export function installFrameEditing(canvas: Canvas) {
  const onDoubleClick = (opt: TPointerEventInfo) => {
    if (isFilledFrame(opt.target) && canvas.getActiveObject() === opt.target) startReposition();
  };
  canvas.on("mouse:dblclick", onDoubleClick);
  return () => {
    canvas.off("mouse:dblclick", onDoubleClick);
    endReposition();
  };
}
