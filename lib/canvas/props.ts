import { ActiveSelection, cache, FabricImage, Rect, type FabricObject, type FabricText } from "fabric";
import { loadFonts, normalizeWeight, type FontNeed } from "@/lib/fonts";
import { applyTextCase } from "@/lib/text-case";
import { defaultEffect, type TextEffect, type TextEffectType } from "@/lib/text-effects";
import type { Adjustments } from "@/lib/image-adjust";
import type { StickerSettings } from "@/lib/sticker";
import { effectiveColorMap } from "@/lib/svg-colors";
import { applyEffectStyle, setTextColor, setTextEffect, textColorOf } from "./effects";
import { commitHistoryStep, recordStep } from "./document";
import type { Head, Route } from "@/lib/connector-math";
import { Connector } from "./connector";
import { CurvedText } from "./curved-text";
import { setImageSource } from "./design-image";
import { Table } from "./table";
import { Chart } from "./chart";
import type { ChartModel } from "@/lib/chart-math";
import type { ElementAnimation } from "@/lib/animation";
import { readVideoSettings, type VideoSettings } from "@/lib/video";
import { applyAdjustments, imageAdjustments } from "./image-filters";
import { getEditorInstance } from "./instance";
import { dashArray, dashOf, kindOf, type Dash } from "./object-kind";
import type { Paint } from "./paint";
import { toFabricFill, toHex } from "./paint-fabric";
import type { ListStyle } from "./text-box";
import { isText, refreshSelection } from "./selection";

/** Property changes the toolbar can make, in page terms (sizes in page pixels, opacity 0–100). */
export type PropPatch = Partial<{
  opacity: number;
  fill: Paint;
  stroke: string | null;
  strokeWidth: number;
  dash: Dash;
  cornerRadius: number;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: string;
  charSpacing: number;
  lineHeight: number;
  listStyle: ListStyle | null;
  uppercase: boolean;
  /** A type with some parameters: the rest are kept when the type stays, or defaulted when it changes. */
  effect: EffectPatch | null;
  flipX: boolean;
  flipY: boolean;
  /** Image adjustments to change; the others each image has stay. */
  adjust: Partial<Adjustments>;
  sticker: StickerSettings | null;
  /** Video clips only: trim, sound, looping (the rest of the settings stay). */
  video: Partial<Pick<VideoSettings, "trimStart" | "trimEnd" | "muted" | "loop">>;
  /** Entrance and exit animations; null removes them. */
  animation: ElementAnimation | null;
  /** Charts only: the whole chart model (the chart panel builds it from the selection's copy). */
  chartModel: ChartModel;
  /** Tables only: table-wide styles, and the active cell's fill. */
  tableStyle: Partial<{ fontSize: number; textColor: string; borderColor: string; borderWidth: number; cellFill: string | null }>;
  /** Connectors only. */
  startHead: Head;
  endHead: Head;
  route: Route;
  /** Curved text only. */
  curve: number;
  /** Any text (AI rewrites; the curved text field). */
  text: string;
  /** One colour of an SVG image replaced: `from` is the colour in the original file. */
  svgColor: { from: string; to: string };
}>;

/** Keep each effect's own parameters typed when patching a discriminated union. */
export type EffectPatch = TextEffect extends infer E
  ? E extends { type: TextEffectType }
    ? { type: E["type"] } & Partial<Omit<E, "type">>
    : never
  : never;

const DEFAULT_STROKE = "#18181b";

function patchedEffect(text: FabricText, patch: EffectPatch): TextEffect {
  const base = text.effect?.type === patch.type ? text.effect : defaultEffect(patch.type, toHex(textColorOf(text)) ?? "#18181b");
  return { ...base, ...patch } as TextEffect;
}

/** Rounds an image's corners with a clip path matching its (cropped) size. */
export function setImageRadius(image: FabricImage, radius: number) {
  if (radius <= 0) {
    image.clipPath = undefined;
  } else {
    image.clipPath = new Rect({
      left: 0,
      top: 0,
      originX: "center",
      originY: "center",
      width: image.width,
      height: image.height,
      rx: radius / image.scaleX,
      ry: radius / image.scaleY,
      strokeWidth: 0,
    });
  }
  image.set({ dirty: true });
}

function applyPatch(o: FabricObject, patch: PropPatch) {
  const kind = kindOf(o);
  if (patch.animation !== undefined) o.set({ animation: patch.animation ?? undefined });
  if (patch.opacity !== undefined) o.set({ opacity: patch.opacity / 100 });
  if (patch.fill !== undefined && kind === "shape") o.set({ fill: toFabricFill(patch.fill) });
  // Text always needs a colour; "no colour" only applies to shapes.
  if (patch.fill !== undefined && isText(o)) setTextColor(o, patch.fill);
  if (kind === "shape" || kind === "line") {
    if (patch.stroke !== undefined && !(kind === "line" && patch.stroke === null)) {
      o.set({ stroke: patch.stroke });
      if (patch.stroke && !o.strokeWidth) o.set({ strokeWidth: 2 });
    }
    if (patch.strokeWidth !== undefined) {
      // Strokes keep their width in page pixels however the shape is scaled.
      o.set({ strokeWidth: patch.strokeWidth, strokeUniform: true });
      if (patch.strokeWidth > 0 && !o.stroke) o.set({ stroke: DEFAULT_STROKE });
      if (kind === "shape" && patch.strokeWidth === 0) o.set({ stroke: null });
      o.set({ strokeDashArray: dashArray(dashOf(o.strokeDashArray), o.strokeWidth) });
    }
    if (patch.dash !== undefined) {
      o.set({
        strokeDashArray: dashArray(patch.dash, o.strokeWidth),
        strokeLineCap: patch.dash === "dotted" || kind === "line" ? "round" : "butt",
      });
    }
  }
  if (patch.cornerRadius !== undefined) {
    if (o instanceof Rect) o.set({ rx: patch.cornerRadius / o.scaleX, ry: patch.cornerRadius / o.scaleY });
    if (o instanceof FabricImage) setImageRadius(o, patch.cornerRadius);
  }
  if (isText(o)) {
    if (patch.fontFamily !== undefined) o.set({ fontFamily: patch.fontFamily });
    if (patch.fontSize !== undefined) {
      o.set({ fontSize: patch.fontSize / o.scaleY });
      applyEffectStyle(o);
    }
    if (patch.bold !== undefined) o.set({ fontWeight: patch.bold ? "700" : "400" });
    if (patch.italic !== undefined) o.set({ fontStyle: patch.italic ? "italic" : "normal" });
    if (patch.underline !== undefined) o.set({ underline: patch.underline });
    if (patch.textAlign !== undefined) o.set({ textAlign: patch.textAlign });
    if (patch.charSpacing !== undefined) o.set({ charSpacing: patch.charSpacing });
    if (patch.lineHeight !== undefined) o.set({ lineHeight: patch.lineHeight });
    if (patch.listStyle !== undefined) o.set({ listStyle: patch.listStyle ?? undefined });
    if (patch.uppercase !== undefined) o.set({ textCase: patch.uppercase ? "upper" : undefined });
    if (patch.effect !== undefined) setTextEffect(o, patch.effect && patchedEffect(o, patch.effect));
    if (o instanceof CurvedText && (patch.curve !== undefined || patch.text !== undefined)) {
      // The arc grows or shrinks around its middle, where it was placed.
      const centre = o.getCenterPoint();
      if (patch.curve !== undefined) o.set({ curve: patch.curve });
      if (patch.text !== undefined) o.set({ text: patch.text });
      o.setPositionByOrigin(centre, "center", "center");
    } else if (patch.text !== undefined) {
      // A text box keeps its width and top; it reflows to the new words.
      o.set({ text: patch.text, styles: {} });
    }
  }
  if (o instanceof Chart && patch.chartModel) {
    o.chart = patch.chartModel;
    o.set({ dirty: true });
  }
  if (o instanceof Table && patch.tableStyle) {
    const { cellFill, ...rest } = patch.tableStyle;
    o.set(rest);
    if (cellFill !== undefined) {
      const { row, column } = o.activeCell ?? { row: 0, column: 0 };
      o.table = { ...o.table, cells: o.table.cells.map((r, ri) => r.map((c, ci) => (ri === row && ci === column ? { ...c, fill: cellFill } : c))) };
    }
    o.relayout();
  }
  if (o instanceof Connector) {
    if (patch.startHead !== undefined) o.set({ startHead: patch.startHead });
    if (patch.endHead !== undefined) o.set({ endHead: patch.endHead });
    if (patch.route !== undefined) o.set({ route: patch.route });
    // Heads, width and route change how far the drawing reaches; the box follows.
    o.refit();
  }
  if (o instanceof FabricImage && patch.video && o.video) {
    o.set({ video: readVideoSettings({ ...o.video, ...patch.video }) ?? o.video });
  }
  if (o instanceof FabricImage) {
    if (patch.sticker !== undefined) o.set({ sticker: patch.sticker ?? undefined, dirty: true });
    if (patch.flipX !== undefined) o.set({ flipX: patch.flipX });
    if (patch.flipY !== undefined) o.set({ flipY: patch.flipY });
    if (patch.adjust !== undefined) applyAdjustments(o, { ...imageAdjustments(o), ...patch.adjust });
    if (patch.svgColor !== undefined) {
      // The map is what is saved and is set now; the recoloured picture follows once it has loaded.
      const map = effectiveColorMap({ ...o.colorMap, [patch.svgColor.from]: patch.svgColor.to }) ?? undefined;
      o.set({ colorMap: map });
      void setImageSource(o, o.getSrc(false), map).then((shown) => shown && o.canvas?.requestRenderAll());
    }
  }
  o.setCoords();
}

/** Loads the faces a font change will draw with, before Fabric measures any text with them. */
async function prepareFonts(objects: FabricObject[], patch: PropPatch) {
  const affectsGlyphs = [patch.fontFamily, patch.bold, patch.italic, patch.uppercase, patch.listStyle, patch.text].some((v) => v !== undefined);
  if (!affectsGlyphs) return;
  const needs: FontNeed[] = objects.filter(isText).map((o) => ({
    family: patch.fontFamily ?? o.fontFamily,
    weight: patch.bold === undefined ? normalizeWeight(o.fontWeight) : patch.bold ? "700" : "400",
    style: (patch.italic ?? o.fontStyle === "italic") ? "italic" : "normal",
    // List markers are drawn in the text's font as well.
    text: `${applyTextCase(patch.text ?? o.text, patch.uppercase === undefined ? o.textCase : patch.uppercase ? "upper" : undefined)}•0123456789.`,
  }));
  await loadFonts(needs);
  new Set(needs.map((n) => n.family)).forEach((family) => cache.clearFontCache(family));
}

// A slider drag or colour-picker drag is a gesture: live updates while it lasts, one undo step at the end.
let gestureOpen = false;

function targets(): FabricObject[] {
  const editor = getEditorInstance();
  return editor ? editor.canvas.getActiveObjects().filter((o) => !o.locked) : [];
}

function apply(objects: FabricObject[], patch: PropPatch) {
  const editor = getEditorInstance();
  if (!editor) return;
  objects.forEach((o) => applyPatch(o, patch));
  // A selection's bounds depend on its members' size (stroke width, font size...).
  const active = editor.canvas.getActiveObject();
  if (active instanceof ActiveSelection) {
    active.triggerLayout();
    active.setCoords();
  }
  editor.canvas.requestRenderAll();
}

function announce(objects: FabricObject[]) {
  const canvas = getEditorInstance()?.canvas;
  objects.forEach((target) => canvas?.fire("object:modified", { target }));
}

/**
 * Changes the selected objects. `live` updates are shown at once but recorded only when the
 * gesture ends (`commit`, or endGesture), so a slider drag or colour drag is one undo step. A
 * `commit` without a preceding live change is one step by itself.
 */
export async function changeSelection(patch: PropPatch, mode: "live" | "commit" = "commit") {
  const objects = targets();
  if (objects.length === 0) return;
  await prepareFonts(objects, patch);

  if (mode === "live") {
    if (!gestureOpen) {
      commitHistoryStep();
      gestureOpen = true;
    }
    apply(objects, patch);
    refreshSelection();
    return;
  }
  if (gestureOpen) {
    apply(objects, patch);
    endGesture();
    return;
  }
  recordStep(() => {
    apply(objects, patch);
    announce(objects);
  });
}

/** Ends a live gesture (pointer released, popover closed): its changes become one undo step. */
export function endGesture() {
  if (!gestureOpen) return;
  gestureOpen = false;
  announce(targets());
  commitHistoryStep();
}
