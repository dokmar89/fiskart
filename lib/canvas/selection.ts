import { FabricImage, FabricText, Rect, Textbox, type Canvas, type FabricObject } from "fabric";
import { normalizeAngle, type Placement } from "@/lib/position-math";
import { normalizeWeight } from "@/lib/fonts";
import type { FrameShape } from "@/lib/frames";
import type { Adjustments } from "@/lib/image-adjust";
import type { StickerSettings } from "@/lib/sticker";
import { ownsTextColor, type TextEffect, type TextEffectType } from "@/lib/text-effects";
import { useEditorStore } from "@/lib/store/editor";
import type { Head, Route } from "@/lib/connector-math";
import { readElementAnimation, type ElementAnimation } from "@/lib/animation";
import type { QrSettings } from "./qr";
import { readVideoSettings, type VideoSettings } from "@/lib/video";
import { Connector } from "./connector";
import { CurvedText } from "./curved-text";
import { Table } from "./table";
import { Chart } from "./chart";
import type { ChartModel } from "@/lib/chart-math";
import { imageAdjustments } from "./image-filters";
import { merge, type Mixed } from "./mixed";
import { textColorOf } from "./effects";
import { dashOf, kindOf, supportsCornerRadius, type Dash, type ObjectKind } from "./object-kind";
import type { Paint } from "./paint";
import { toHex, toPaint } from "./paint-fabric";
import type { ListStyle } from "./text-box";

/**
 * What the toolbar shows: the selection's properties, each either the shared value or MIXED.
 * Properties that do not apply to every selected object are absent. Read-only; changes go through
 * lib/canvas/props.ts.
 */
export type SelectionSnapshot = {
  count: number;
  kind: ObjectKind | "mixed";
  /** Any selected object is locked; the toolbar then only offers unlocking. */
  locked: boolean;
  opacity: Mixed<number>;
  fill?: Mixed<Paint>;
  stroke?: Mixed<string | null>;
  strokeWidth?: Mixed<number>;
  dash?: Mixed<Dash>;
  cornerRadius?: Mixed<number>;
  fontFamily?: Mixed<string>;
  fontSize?: Mixed<number>;
  bold?: Mixed<boolean>;
  italic?: Mixed<boolean>;
  underline?: Mixed<boolean>;
  textAlign?: Mixed<string>;
  charSpacing?: Mixed<number>;
  lineHeight?: Mixed<number>;
  listStyle?: Mixed<ListStyle | null>;
  uppercase?: Mixed<boolean>;
  /** The effect, without the text colour that hollow and neon carry (the colour control shows it). */
  effect?: Mixed<EffectView | null>;
  flipX?: Mixed<boolean>;
  flipY?: Mixed<boolean>;
  adjustments?: { [K in keyof Adjustments]: Mixed<Adjustments[K]> };
  /** Entrance and exit animations. */
  animation: Mixed<ElementAnimation | null>;
  /** Every selected object is text (typewriter applies). */
  allText: boolean;
  /** A single chart: a copy of its model, for the chart panel. */
  chart?: ChartModel;
  /** A single table, for the table toolbar. */
  table?: {
    rows: number;
    columns: number;
    activeCell: { row: number; column: number } | null;
    columnWidth: number;
    cellFill: string | null;
    fontFamily: string;
    fontSize: number;
    textColor: string;
    borderColor: string;
    borderWidth: number;
  };
  /** Lines and connectors: their ends and route. */
  connector?: { startHead: Mixed<Head>; endHead: Mixed<Head>; route: Mixed<Route> };
  /** The selection's box, size and rotation for the position panel (page pixels, degrees). */
  placement?: Placement;
  /** The height follows from the content (text boxes) and cannot be typed. */
  fixedHeight?: boolean;
  /** Curved text: its curve, and (for one) its words, which the toolbar edits. */
  curve?: Mixed<number>;
  curvedText?: string;
  /** A single image: its stored source and SVG colour replacements, for background removal and recolouring. */
  image?: { src: string; colorMap: Record<string, string>; frame: FrameShape | null; qr: QrSettings | null; video: VideoSettings | null; sticker: StickerSettings | null };
};

export type EffectView = { type: TextEffectType } & Partial<Omit<TextEffect, "type">>;

function effectView(effect: TextEffect | undefined): EffectView | null {
  if (!effect) return null;
  if (!ownsTextColor(effect)) return effect;
  const view: EffectView = { ...effect };
  delete view.color;
  return view;
}

const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Corner radius in page pixels: the object's own radius times its scale. */
export function cornerRadiusOf(o: FabricObject): number {
  if (o instanceof Rect) return round(o.rx * o.scaleX);
  if (o instanceof FabricImage) {
    const clip = o.clipPath;
    return clip instanceof Rect ? round(clip.rx * o.scaleX) : 0;
  }
  return 0;
}

function snapshotOf(objects: FabricObject[]): SelectionSnapshot | null {
  if (objects.length === 0) return null;
  const kinds = new Set(objects.map(kindOf));
  const kind = kinds.size === 1 ? [...kinds][0] : "mixed";
  const all = <T>(read: (o: FabricObject) => T) => merge(objects.map(read)) as Mixed<T>;
  const snapshot: SelectionSnapshot = {
    count: objects.length,
    kind,
    locked: objects.some((o) => o.locked),
    opacity: all((o) => round(o.opacity * 100, 0)),
    animation: all((o) => readElementAnimation(o.animation)) as Mixed<ElementAnimation | null>,
    allText: objects.every((o) => o instanceof FabricText),
  };

  if (kind === "shape") snapshot.fill = all((o) => toPaint(o.fill));
  if (kind === "text") snapshot.fill = all((o) => textColorOf(o as FabricText));
  if (kind === "shape" || kind === "line") {
    snapshot.stroke = all((o) => toHex(o.stroke));
    snapshot.strokeWidth = all((o) => (o.stroke ? round(o.strokeWidth) : 0));
    snapshot.dash = all((o) => dashOf(o.strokeDashArray));
  }
  if (objects.every(supportsCornerRadius) && (kind === "shape" || kind === "image")) {
    snapshot.cornerRadius = all(cornerRadiusOf);
  }
  if (kind === "text") {
    const texts = objects as FabricText[];
    const allText = <T>(read: (o: FabricText) => T) => merge(texts.map(read)) as Mixed<T>;
    snapshot.fontFamily = allText((o) => o.fontFamily);
    snapshot.fontSize = allText((o) => round(o.fontSize * o.scaleY));
    snapshot.bold = allText((o) => normalizeWeight(o.fontWeight) === "700");
    snapshot.italic = allText((o) => o.fontStyle === "italic");
    snapshot.underline = allText((o) => Boolean(o.underline));
    snapshot.textAlign = allText((o) => o.textAlign);
    snapshot.charSpacing = allText((o) => round(o.charSpacing, 0));
    snapshot.lineHeight = allText((o) => round(o.lineHeight, 2));
    snapshot.listStyle = allText((o) => o.listStyle ?? null);
    snapshot.uppercase = allText((o) => o.textCase === "upper");
    snapshot.effect = allText((o) => effectView(o.effect));
    if (texts.every((o) => o instanceof CurvedText)) {
      snapshot.curve = allText((o) => o.curve ?? 0);
      if (texts.length === 1) snapshot.curvedText = texts[0].text;
    }
  }
  if (objects.length === 1 && objects[0] instanceof Chart) snapshot.chart = JSON.parse(JSON.stringify(objects[0].chart)) as ChartModel;
  if (objects.length === 1 && objects[0] instanceof Table) {
    const t = objects[0];
    const cell = t.activeCell;
    const column = cell?.column ?? 0;
    snapshot.table = {
      rows: t.table.rows.length,
      columns: t.table.columns.length,
      activeCell: cell,
      columnWidth: round(t.table.columns[column] ?? 0),
      cellFill: cell ? (t.table.cells[cell.row]?.[cell.column]?.fill ?? null) : null,
      fontFamily: t.fontFamily,
      fontSize: round(t.fontSize),
      textColor: t.textColor,
      borderColor: t.borderColor,
      borderWidth: round(t.borderWidth),
    };
  }
  if (objects.every((o) => o instanceof Connector)) {
    const lines = objects as Connector[];
    snapshot.connector = {
      startHead: merge(lines.map((o) => o.startHead)) as Mixed<Head>,
      endHead: merge(lines.map((o) => o.endHead)) as Mixed<Head>,
      route: merge(lines.map((o) => o.route)) as Mixed<Route>,
    };
  }
  if (kind === "image") {
    snapshot.flipX = all((o) => o.flipX);
    snapshot.flipY = all((o) => o.flipY);
    const adjustments = objects.map((o) => imageAdjustments(o as FabricImage));
    const each = <K extends keyof Adjustments>(key: K) => merge(adjustments.map((a) => a[key])) as Mixed<Adjustments[K]>;
    snapshot.adjustments = {
      brightness: each("brightness"),
      contrast: each("contrast"),
      saturation: each("saturation"),
      blur: each("blur"),
      temperature: each("temperature"),
      tint: each("tint"),
      sharpness: each("sharpness"),
      vignette: each("vignette"),
      preset: each("preset"),
    };
    if (objects.length === 1) {
      const image = objects[0] as FabricImage;
      snapshot.image = { src: image.getSrc(false), colorMap: image.colorMap ?? {}, frame: image.frame ?? null, qr: image.qr ?? null, video: readVideoSettings(image.video), sticker: image.sticker ?? null };
    }
  }
  return snapshot;
}

/** An object's top-left corner (where Fabric places it, so X and Y are its left and top), size without stroke, and rotation. */
export function placementOf(o: FabricObject): Placement {
  const corner = o.translateToOriginPoint(o.getCenterPoint(), "left", "top");
  return { x: corner.x, y: corner.y, width: o.width * Math.abs(o.scaleX), height: o.height * Math.abs(o.scaleY), angle: normalizeAngle(o.angle) };
}

let refreshCanvas: Canvas | null = null;

/** Recomputes the toolbar snapshot now (after changes Fabric reports no event for). */
export function refreshSelection() {
  if (!refreshCanvas) return;
  const snapshot = snapshotOf(refreshCanvas.getActiveObjects());
  const active = refreshCanvas.getActiveObject();
  if (snapshot && active) {
    snapshot.placement = placementOf(active);
    snapshot.fixedHeight = active instanceof Textbox;
  }
  useEditorStore.setState({ selection: snapshot });
}

/** Keeps the toolbar snapshot in step with the canvas. Returns a cleanup function. */
export function installSelectionSync(canvas: Canvas) {
  refreshCanvas = canvas;
  const events = ["selection:created", "selection:updated", "selection:cleared", "object:modified"] as const;
  events.forEach((e) => canvas.on(e, refreshSelection));
  refreshSelection();
  return () => {
    events.forEach((e) => canvas.off(e, refreshSelection));
    if (refreshCanvas === canvas) refreshCanvas = null;
    useEditorStore.setState({ selection: null });
  };
}

export const isText = (o: FabricObject): o is FabricText => o instanceof FabricText;
