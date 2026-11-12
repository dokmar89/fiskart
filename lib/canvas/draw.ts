import { Path, PencilBrush, Point, Shadow, util, type Canvas, type TPointerEventInfo } from "fabric";
import { chiselPath, snapDrawingPoint, type BrushPoint } from "@/lib/brush-geometry";
import { useEditorStore } from "@/lib/store/editor";
import { commitHistoryStep } from "./document";
import { distanceToPolyline, pathPoints, sweep } from "./erase-math";
import { newObjectId } from "./serialize";

/** Objects drawn with the pen carry this role; the eraser only removes those. */
export const DRAWING_ROLE = "drawing";

/** Eraser radius in screen pixels, whatever the zoom. */
const ERASER_RADIUS = 8;

export type DrawSettings = { mode: "pen" | "marker" | "glow" | "calligraphy" | "eraser"; color: string; width: number; opacity: number };

declare module "fabric" {
  interface FabricObject {
    brushKind?: DrawSettings["mode"];
    drawWidth?: number;
  }
}

class StyledBrush extends PencilBrush {
  private start: Point | null = null;
  private samples: BrushPoint[] = [];

  constructor(canvas: Canvas, private settings: DrawSettings) {
    super(canvas);
    this.color = settings.color;
    this.width = settings.width;
    this.strokeLineCap = settings.mode === "marker" ? "square" : "round";
    this.strokeLineJoin = settings.mode === "marker" ? "bevel" : "round";
    this.decimate = 0.2;
    if (settings.mode === "glow") this.shadow = new Shadow({ color: settings.color, blur: settings.width * 1.6, offsetX: 0, offsetY: 0 });
  }

  private pressure(e: Event): number {
    const pointer = e as PointerEvent;
    return pointer.pointerType === "pen" && pointer.pressure > 0 ? pointer.pressure : 0.6;
  }

  override onMouseDown(pointer: Point, event: Parameters<PencilBrush["onMouseDown"]>[1]) {
    this.start = pointer;
    this.samples = [{ x: pointer.x, y: pointer.y, pressure: this.pressure(event.e) }];
    super.onMouseDown(pointer, event);
  }

  override onMouseMove(pointer: Point, event: Parameters<PencilBrush["onMouseMove"]>[1]) {
    const at = event.e.shiftKey && this.start ? new Point(snapDrawingPoint(this.start, pointer)) : pointer;
    if (this.settings.mode === "calligraphy") {
      if (event.e.shiftKey) this.samples = this.samples.slice(0, 1);
      this.samples.push({ x: at.x, y: at.y, pressure: this.pressure(event.e) });
    }
    super.onMouseMove(at, event);
  }

  override createPath(pathData: Parameters<PencilBrush["createPath"]>[0]): Path {
    const { mode, color, width, opacity } = this.settings;
    const outline = mode === "calligraphy" ? chiselPath(this.samples, width) : "";
    const path = outline ? new Path(outline, { fill: color, stroke: null, strokeWidth: 0 }) : super.createPath(pathData);
    path.set({ opacity, brushKind: mode, drawWidth: width });
    if (mode === "marker") path.set({ globalCompositeOperation: "multiply" });
    if (mode === "glow") path.shadow = new Shadow({ color, blur: width * 1.6, offsetX: 0, offsetY: 0 });
    return path;
  }
}

export function setDrawing(drawing: DrawSettings | null) {
  useEditorStore.setState({ drawing });
}

function isDrawnStroke(o: unknown): o is Path {
  return o instanceof Path && o.role === DRAWING_ROLE && !o.locked && o.visible;
}

/** Whether a page point is within `tolerance` of the drawn line of a stroke. */
function strokeHit(stroke: Path, at: Point, tolerance: number): boolean {
  const matrix = stroke.calcTransformMatrix();
  const offset = stroke.pathOffset;
  const points = pathPoints(stroke.path).map((p) => util.transformPoint(new Point(p.x - offset.x, p.y - offset.y), matrix));
  const scale = Math.max(Math.abs(stroke.scaleX), Math.abs(stroke.scaleY));
  return distanceToPolyline(points, at) <= tolerance + ((stroke.drawWidth ?? stroke.strokeWidth) * scale) / 2;
}

/**
 * The draw tool, on while the Draw panel is open: the pen draws freehand strokes (each one undo
 * step, an ordinary path afterwards), the eraser removes whole strokes it touches (one undo step
 * per drag). Escape leaves it. Returns a cleanup function.
 */
export function installDrawing(canvas: Canvas) {
  let erasing: Point | null = null;

  const apply = (drawing: DrawSettings | null) => {
    canvas.isDrawingMode = drawing !== null && drawing.mode !== "eraser";
    canvas.skipTargetFind = drawing?.mode === "eraser";
    canvas.selection = drawing === null;
    canvas.defaultCursor = drawing?.mode === "eraser" ? "crosshair" : "default";
    if (drawing && drawing.mode !== "eraser") canvas.freeDrawingBrush = new StyledBrush(canvas, drawing);
    if (drawing) canvas.discardActiveObject();
    canvas.requestRenderAll();
  };

  const onBeforePath = ({ path }: { path: Path }) => {
    path.set({ id: newObjectId(), name: "Kresba", role: DRAWING_ROLE, locked: false, strokeUniform: true, ...(path.brushKind === "calligraphy" ? {} : { fill: null }) });
  };
  // Each stroke is its own undo step, however quickly the next one follows.
  const onPathCreated = () => commitHistoryStep();

  const eraseAlong = (from: Point, to: Point) => {
    const tolerance = ERASER_RADIUS / canvas.getZoom();
    const points = sweep(from, to, tolerance);
    const hit = canvas.getObjects().filter((o) => isDrawnStroke(o) && points.some((p) => strokeHit(o, new Point(p.x, p.y), tolerance)));
    if (hit.length > 0) canvas.remove(...hit);
  };
  const onMouseDown = (opt: TPointerEventInfo) => {
    if (useEditorStore.getState().drawing?.mode !== "eraser") return;
    erasing = opt.scenePoint;
    eraseAlong(erasing, erasing);
  };
  const onMouseMove = (opt: TPointerEventInfo) => {
    if (!erasing) return;
    eraseAlong(erasing, opt.scenePoint);
    erasing = opt.scenePoint;
  };
  const onMouseUp = () => {
    erasing = null;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !useEditorStore.getState().drawing) return;
    e.preventDefault();
    e.stopPropagation();
    // Closing the Draw panel turns the tool off.
    useEditorStore.setState({ activePanel: null, drawing: null });
  };

  apply(useEditorStore.getState().drawing);
  const unsubscribe = useEditorStore.subscribe((s, prev) => {
    if (s.drawing !== prev.drawing) apply(s.drawing);
  });
  canvas.on("before:path:created", onBeforePath);
  canvas.on("path:created", onPathCreated);
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:up", onMouseUp);
  window.addEventListener("keydown", onKeyDown, { capture: true });
  return () => {
    unsubscribe();
    apply(null);
    canvas.off("before:path:created", onBeforePath);
    canvas.off("path:created", onPathCreated);
    canvas.off("mouse:down", onMouseDown);
    canvas.off("mouse:move", onMouseMove);
    canvas.off("mouse:up", onMouseUp);
    window.removeEventListener("keydown", onKeyDown, { capture: true });
  };
}
