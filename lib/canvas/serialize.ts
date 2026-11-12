import { cache, FabricImage, Rect, util, type Canvas, type FabricObject } from "fabric";
import { fontNeedsOf, loadFonts } from "@/lib/fonts";
import { hasGuides, readGuides } from "@/lib/guides";
import { migratePage, SCHEMA_VERSION, type CanvasData, type PageData } from "@/lib/page-data";
import { readTiming, type ElementAnimation } from "@/lib/animation";
// Registers the editor's text box under Fabric's "Textbox" type before any page is loaded.
import "./text-box";
// Registers curved text (phase 12) and connectors (phase 14).
import "./curved-text";
import "./connector";
import "./table";
import "./chart";
import "./device-frame";
import { guidesOf, setCanvasGuides } from "./guide-state";
import { isDefaultTiming, setCanvasTiming, timingOf } from "./timing";
// Registers the editor's image class under Fabric's "Image" type, likewise.
import "./design-image";

/**
 * Properties Fabric does not serialize on its own. Every toObject / toJSON / clone call passes this
 * list, or the values are silently dropped. All saving, loading, history and template code goes
 * through this module.
 */
export const CUSTOM_PROPERTIES = [
  "id",
  "name",
  "locked",
  "role",
  "brushKind",
  "drawWidth",
  "selectable",
  "evented",
  "hasControls",
  "lockMovementX",
  "lockMovementY",
  "lockScalingX",
  "lockScalingY",
  "lockRotation",
  "listStyle",
  "textCase",
  "effect",
  "frame",
  "frameRadius",
  "sticker",
  "colorMap",
  "curve",
  "qr",
  "animation",
  "video",
] as const;

declare module "fabric" {
  interface FabricObject {
    id?: string;
    name?: string;
    locked?: boolean;
    role?: string;
    /** Set on the stand-in for an object that could not be loaded: the original JSON, saved back unchanged. */
    placeholderFor?: Record<string, unknown>;
    /** Entrance and exit animations (phase 16). */
    animation?: ElementAnimation;
  }
  interface SerializedObjectProps {
    id?: string;
    name?: string;
    locked?: boolean;
    role?: string;
  }
}

// Images store the URL exactly as given (a relative /api/assets/... path), not the absolute URL the
// browser resolves it to, so pages do not depend on the host name.
FabricImage.ownDefaults.srcFromAttribute = true;

export function newObjectId(): string {
  return crypto.randomUUID();
}

/** Clones an object (or active selection) with all custom properties. */
export function cloneObject<T extends FabricObject>(object: T): Promise<T> {
  return object.clone([...CUSTOM_PROPERTIES]);
}

/**
 * The page's objects as JSON. Goes through `canvas.toObject` because that writes objects inside an
 * active selection with their absolute position, as they would be once the selection is dropped.
 */
export function serializeCanvas(canvas: Canvas): CanvasData {
  const { objects } = canvas.toObject([...CUSTOM_PROPERTIES]) as { objects: Record<string, unknown>[] };
  const live = canvas.getObjects();
  const data: CanvasData = { objects: objects.map((o, i) => live[i]?.placeholderFor ?? o) };
  const guides = guidesOf(canvas);
  if (hasGuides(guides)) data.guides = guides;
  const timing = timingOf(canvas);
  if (!isDefaultTiming(timing)) data.timing = timing;
  return data;
}

export function serializePage(canvas: Canvas): PageData {
  return { schemaVersion: SCHEMA_VERSION, canvasData: serializeCanvas(canvas) };
}

/** A visible, deletable stand-in at the original's place, for an object whose image failed to load. */
function createPlaceholder(raw: Record<string, unknown>): FabricObject {
  const num = (key: string, fallback: number) => (typeof raw[key] === "number" ? (raw[key] as number) : fallback);
  const placeholder = new Rect({
    left: num("left", 0),
    top: num("top", 0),
    width: num("width", 100),
    height: num("height", 100),
    scaleX: num("scaleX", 1),
    scaleY: num("scaleY", 1),
    angle: num("angle", 0),
    fill: "rgba(161, 161, 170, 0.25)",
    stroke: "#a1a1aa",
    strokeWidth: 2,
    strokeDashArray: [8, 6],
    strokeUniform: true,
    hasControls: false,
    lockMovementX: true,
    lockMovementY: true,
  });
  placeholder.set({
    id: typeof raw.id === "string" ? raw.id : newObjectId(),
    name: "Chybějící obrázek",
    placeholderFor: raw,
  });
  return placeholder;
}

/**
 * Creates objects from page JSON. An object that fails (typically an image whose file was deleted)
 * becomes a placeholder that saves back as the original JSON, instead of failing the whole page.
 */
export async function enlivenCanvasObjects(objects: Record<string, unknown>[]): Promise<FabricObject[]> {
  // Text is measured when it is created, so its fonts must be ready first.
  const fonts = fontNeedsOf(objects);
  await loadFonts(fonts);
  new Set(fonts.map((f) => f.family)).forEach((family) => cache.clearFontCache(family));
  const results = await Promise.allSettled(objects.map((o) => util.enlivenObjects<FabricObject>([o])));
  return results.map((r, i) => (r.status === "fulfilled" && r.value[0] ? r.value[0] : createPlaceholder(objects[i])));
}

/**
 * Replaces the canvas objects with the page's. Only objects are touched; the canvas' own settings
 * (clip path, viewport) stay as they are, which `canvas.loadFromJSON` would not guarantee.
 */
export async function loadCanvasData(canvas: Canvas, data: CanvasData) {
  const objects = await enlivenCanvasObjects(data.objects);
  canvas.discardActiveObject();
  canvas.remove(...canvas.getObjects());
  if (objects.length > 0) canvas.add(...objects);
  setCanvasGuides(canvas, readGuides(data.guides));
  setCanvasTiming(canvas, readTiming(data.timing));
  canvas.requestRenderAll();
}

export async function loadPage(canvas: Canvas, page: PageData) {
  await loadCanvasData(canvas, migratePage(page).canvasData);
}
