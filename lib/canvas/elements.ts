import { Ellipse, Point, Polygon, Rect, Triangle, type FabricObject } from "fabric";
import { Connector } from "./connector";
import { DEFAULT_FONT_FAMILY, loadFonts, normalizeWeight } from "@/lib/fonts";
import { recordStep } from "./document";
import { getEditorInstance } from "./instance";
import { newObjectId } from "./serialize";
import { starPoints } from "./shape-math";
import { CurvedText } from "./curved-text";
import { DesignTextbox } from "./text-box";

export type ShapeKind = "rectangle" | "ellipse" | "triangle" | "star" | "line" | "arrow" | "elbow";
export type TextPreset = "heading" | "subheading" | "body";

const SHAPE_FILL = "#a1a1aa";
const INK = "#18181b";

const SHAPE_NAMES: Record<ShapeKind, string> = {
  rectangle: "Obdélník",
  ellipse: "Elipsa",
  triangle: "Trojúhelník",
  star: "Hvězda",
  line: "Čára",
  arrow: "Šipka",
  elbow: "Spojnice",
};

function createShape(kind: ShapeKind, size: number, strokeWidth: number): FabricObject {
  switch (kind) {
    case "rectangle":
      return new Rect({ width: size, height: size, fill: SHAPE_FILL, strokeWidth: 0, strokeUniform: true });
    case "ellipse":
      return new Ellipse({ rx: size / 2, ry: size / 2, fill: SHAPE_FILL, strokeWidth: 0, strokeUniform: true });
    case "triangle":
      return new Triangle({ width: size, height: size, fill: SHAPE_FILL, strokeWidth: 0, strokeUniform: true });
    case "star":
      return new Polygon(starPoints(5, size / 2, size / 4.5), { fill: SHAPE_FILL, strokeWidth: 0, strokeUniform: true });
    // Lines are connectors: each end can be dragged, given a head and attached to a shape.
    case "line":
    case "arrow":
    case "elbow": {
      const half = (size * 1.5) / 2;
      const connector = new Connector({
        stroke: INK,
        strokeWidth,
        route: kind === "elbow" ? "elbow" : "straight",
        endHead: kind === "line" ? "none" : "arrow",
      });
      connector.setEnds({ x: -half, y: kind === "elbow" ? -half / 2 : 0 }, { x: half, y: kind === "elbow" ? half / 2 : 0 });
      return connector;
    }
  }
}

const TEXT_PRESETS: Record<TextPreset, { text: string; size: number; weight: string; name: string }> = {
  heading: { text: "Přidejte nadpis", size: 72, weight: "bold", name: "Nadpis" },
  subheading: { text: "Přidejte podnadpis", size: 44, weight: "600", name: "Podnadpis" },
  body: { text: "Přidejte trochu textu", size: 28, weight: "normal", name: "Běžný text" },
};

/** Default sizes are tuned for a 1080 px page and scaled to the current artboard. */
export function artboardScale(artboard: { width: number; height: number }) {
  return Math.min(artboard.width, artboard.height) / 1080;
}

/** Adds a new object centred on `at` (scene coordinates), or on the page centre, and selects it. */
export function placeObject(object: FabricObject, name: string, at?: { x: number; y: number }) {
  const editor = getEditorInstance();
  if (!editor) return;
  const { canvas, artboard } = editor;
  object.set({ id: newObjectId(), name, locked: false });
  const centre = at ?? { x: artboard.width / 2, y: artboard.height / 2 };
  object.setPositionByOrigin(new Point(centre.x, centre.y), "center", "center");
  object.setCoords();
  recordStep(() => {
    canvas.add(object);
    canvas.setActiveObject(object);
  });
  canvas.requestRenderAll();
}

export function addShape(kind: ShapeKind) {
  const editor = getEditorInstance();
  if (!editor) return;
  const scale = artboardScale(editor.artboard);
  placeObject(createShape(kind, 300 * scale, Math.max(1, 8 * scale)), SHAPE_NAMES[kind]);
}

export async function addText(preset: TextPreset) {
  const editor = getEditorInstance();
  if (!editor) return;
  const { text, size, weight, name } = TEXT_PRESETS[preset];
  // Fabric measures the text when it is created; the font has to be loaded by then.
  await loadFonts([{ family: DEFAULT_FONT_FAMILY, weight: normalizeWeight(weight), style: "normal", text }]);
  const textbox = new DesignTextbox(text, {
    width: editor.artboard.width * 0.7,
    fontSize: size * artboardScale(editor.artboard),
    fontWeight: weight,
    fontFamily: DEFAULT_FONT_FAMILY,
    fill: INK,
    textAlign: "center",
  });
  placeObject(textbox, name);
}

/** Adds text on an arc; its words are changed in the toolbar. */
export async function addCurvedText() {
  const editor = getEditorInstance();
  if (!editor) return;
  const text = "Zakřivený text";
  await loadFonts([{ family: DEFAULT_FONT_FAMILY, weight: "700", style: "normal", text }]);
  const curved = new CurvedText(text, {
    fontSize: 64 * artboardScale(editor.artboard),
    fontWeight: "bold",
    fontFamily: DEFAULT_FONT_FAMILY,
    fill: INK,
    curve: 40,
  });
  placeObject(curved, "Zakřivený text");
}
