import { Canvas, InteractiveFabricObject, type IText } from "fabric";
import { useEditorStore } from "@/lib/store/editor";
import { useFontsStore } from "@/lib/store/fonts";
import type { Unit } from "@/lib/units";
import { closeProject, openProject } from "./document";
import { installConnectors } from "./connector";
import { installCharts } from "./chart";
import { installTableEditing } from "./table";
import { editCell } from "./table-edit";
import { installDrawing } from "./draw";
import { installDrop } from "./drop";
import { installFrameEditing } from "./frames";
import { installGuides } from "./guides";
import { setEditorInstance } from "./instance";
import { isTypingTarget } from "./shortcut-map";
import { endImageModes } from "./image-modes";
import { installLayerSync } from "./layers";
import { installPageThumbnails } from "./pages";
import { installSelectionSync, refreshSelection } from "./selection";
import { installSnapping } from "./snapping";
import { installTextBehaviour } from "./text";
import { installShortcuts } from "./shortcuts";
import { installTestHook } from "./test-hook";
import { fitArtboard, handleWheel, pageClip, panBy, setViewport } from "./viewport";
import type { Matrix, Size } from "./viewport-math";

const ACCENT = "#6366f1";
const ARTBOARD_FILL = "#ffffff";

Object.assign(InteractiveFabricObject.ownDefaults, {
  borderColor: ACCENT,
  cornerColor: "#ffffff",
  cornerStrokeColor: ACCENT,
  cornerStyle: "circle",
  cornerSize: 10,
  transparentCorners: false,
  borderScaleFactor: 1.5,
  padding: 0,
});

/**
 * Draws the page behind everything already on the main canvas. Objects are rendered first and
 * then clipped to the artboard by `canvas.clipPath`; painting with destination-over afterwards puts
 * the white page and its shadow underneath them without covering the selection controls.
 */
function drawArtboard(canvas: Canvas, ctx: CanvasRenderingContext2D, artboard: Size) {
  const v = canvas.viewportTransform;
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
  ctx.fillStyle = ARTBOARD_FILL;
  ctx.fillRect(0, 0, artboard.width, artboard.height);
  // The shadow goes in a second pass, behind the opaque page, so it only shows around the edges.
  ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 1;
  ctx.fillRect(0, 0, artboard.width, artboard.height);
  ctx.restore();
}

function isEditingText(canvas: Canvas): boolean {
  const active = canvas.getActiveObject() as Partial<IText> | undefined;
  return Boolean(active?.isEditing);
}

/** Space + drag and middle-button drag pan the view. Returns a cleanup function. */
function installPanning(canvas: Canvas, host: HTMLElement) {
  let spaceHeld = false;
  let panning: { x: number; y: number } | null = null;

  const setPanMode = (on: boolean) => {
    // While panning, Fabric must neither pick objects nor show their hover cursor.
    canvas.skipTargetFind = on;
    canvas.selection = !on;
    canvas.defaultCursor = on ? (panning ? "grabbing" : "grab") : "default";
    canvas.setCursor(canvas.defaultCursor);
  };

  const onMouseDown = (e: MouseEvent) => {
    const wantsPan = e.button === 1 || (e.button === 0 && spaceHeld);
    if (!wantsPan) return;
    // Captured before Fabric's own listener, so the press never starts a selection or a drag.
    e.preventDefault();
    e.stopPropagation();
    panning = { x: e.clientX, y: e.clientY };
    setPanMode(true);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!panning) return;
    panBy(canvas, e.clientX - panning.x, e.clientY - panning.y);
    panning = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    panning = null;
    setPanMode(spaceHeld);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  const isTyping = (e: KeyboardEvent) => isEditingText(canvas) || isTypingTarget(e.target as HTMLElement | null);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== "Space" || isTyping(e)) return;
    // Otherwise the page scrolls, or a focused button gets pressed.
    e.preventDefault();
    if (!spaceHeld) {
      spaceHeld = true;
      setPanMode(true);
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== "Space" || !spaceHeld) return;
    e.preventDefault();
    spaceHeld = false;
    if (!panning) setPanMode(false);
  };

  const onBlur = () => {
    spaceHeld = false;
    if (!panning) setPanMode(false);
  };

  // Stops Windows' middle-click autoscroll.
  const onAuxClick = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  };

  host.addEventListener("mousedown", onMouseDown, { capture: true });
  host.addEventListener("auxclick", onAuxClick);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  return () => {
    host.removeEventListener("mousedown", onMouseDown, { capture: true });
    host.removeEventListener("auxclick", onAuxClick);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    onMouseUp();
  };
}

/**
 * Mounts a Fabric canvas filling `host`, with the artboard fitted and centred, and loads the
 * project's first page into it. Other pages are loaded into the same canvas when switched to, so
 * the view stays where it is. Editing (panels, shortcuts) is enabled once the page is loaded.
 * Returns a cleanup function that saves pending changes and disposes everything.
 */
export function mountEditor(host: HTMLElement, initial: Size & { unit: Unit }, projectId: string): () => void {
  // One size object shared by everything that draws or measures the page; a resize changes it in
  // place (setArtboardSize), so nothing holds a stale copy.
  const artboard: Size = { width: initial.width, height: initial.height };
  // Created here rather than rendered by React, so StrictMode's mount/unmount/mount gets a fresh element each time.
  const element = document.createElement("canvas");
  host.appendChild(element);

  const canvas = new Canvas(element, {
    width: host.clientWidth,
    height: host.clientHeight,
    preserveObjectStacking: true,
    controlsAboveOverlay: true,
    stopContextMenu: true,
    selectionColor: "rgba(99, 102, 241, 0.08)",
    selectionBorderColor: ACCENT,
    selectionLineWidth: 1,
  });
  canvas.clipPath = pageClip(artboard);

  canvas.on("after:render", ({ ctx }) => {
    if (ctx === canvas.getContext()) drawArtboard(canvas, ctx, artboard);
  });

  fitArtboard(canvas, artboard);

  // Keep the view centred on the same scene point when panels open or the window resizes.
  let size = { width: host.clientWidth, height: host.clientHeight };
  const resizeObserver = new ResizeObserver(() => {
    const next = { width: host.clientWidth, height: host.clientHeight };
    if (next.width === size.width && next.height === size.height) return;
    const v = [...canvas.viewportTransform] as Matrix;
    v[4] += (next.width - size.width) / 2;
    v[5] += (next.height - size.height) / 2;
    size = next;
    canvas.setDimensions(next);
    setViewport(canvas, v);
  });
  resizeObserver.observe(host);

  const onWheel = (e: WheelEvent) => handleWheel(canvas, e);
  host.addEventListener("wheel", onWheel, { passive: false });

  const removePanning = installPanning(canvas, host);

  const loading = new AbortController();
  let removeShortcuts = () => {};
  let removeTestHook = () => {};
  let removeLayerSync = () => {};
  let removeDrop = () => {};
  let removeEditing = () => {};

  // Uploaded fonts are registered first: pages using them must load with them.
  useFontsStore
    .getState()
    .load()
    .then(() => openProject(canvas, { projectId, artboard, unit: initial.unit }, loading.signal))
    .then((ok) => {
      if (!ok) return;
      setEditorInstance({ canvas, projectId, artboard });
      removeShortcuts = installShortcuts(canvas, isEditingText);
      removeTestHook = installTestHook(canvas, artboard);
      removeLayerSync = installLayerSync(canvas);
      removeDrop = installDrop(canvas, host);
      const removers = [installSelectionSync(canvas), installFrameEditing(canvas), installGuides(canvas), installDrawing(canvas), installConnectors(canvas), installCharts(canvas), installTableEditing(canvas, editCell, refreshSelection), installSnapping(canvas, artboard), installTextBehaviour(canvas), installPageThumbnails(artboard)];
      removeEditing = () => removers.forEach((remove) => remove());
    })
    .catch((error: unknown) => {
      if (loading.signal.aborted) return;
      console.error(error);
      useEditorStore.setState({ loadState: "error" });
    });

  return () => {
    loading.abort();
    endImageModes();
    closeProject();
    removeEditing();
    removeDrop();
    removeLayerSync();
    removeTestHook();
    removeShortcuts();
    removePanning();
    host.removeEventListener("wheel", onWheel);
    resizeObserver.disconnect();
    setEditorInstance(null);
    void canvas.dispose();
    element.remove();
  };
}
