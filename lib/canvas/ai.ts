import { FabricImage, FabricText, Point, util } from "fabric";
import { expandedSize, type AiStatus, type ImageAspect, type TextAction } from "@/lib/ai";
import type { AssetDto } from "@/lib/assets";
import { DEFAULT_FONT_FAMILY, loadFonts } from "@/lib/fonts";
import { useUploadsStore } from "@/lib/store/uploads";
import { removeInWorker } from "./bg-removal";
import { setImageSource } from "./design-image";
import { recordStepAsync } from "./document";
import { artboardScale, placeObject } from "./elements";
import { addImageFromAsset } from "./images";
import { getEditorInstance } from "./instance";
import { changeSelection } from "./props";
import { refreshSelection } from "./selection";
import { DesignTextbox } from "./text-box";

/**
 * The editor side of the AI tools (phase 19). Everything goes through this app's routes; the
 * browser never talks to an AI provider. Each change is one undo step.
 */

async function failure(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(body.error ?? fallback);
}

export async function fetchAiStatus(): Promise<AiStatus> {
  const res = await fetch("/api/ai/status", { cache: "no-store" });
  if (!res.ok) throw new Error("Nástroje AI se nepodařilo ověřit.");
  return (await res.json()) as AiStatus;
}

async function requestText(action: TextAction, text: string, language?: string): Promise<string> {
  const res = await fetch("/api/ai/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, text, language }) });
  if (!res.ok) throw await failure(res, "Text se nepodařilo přepsat.");
  return ((await res.json()) as { text: string }).text;
}

/** Rewrites the selected text box (or curved text) in place. */
export async function rewriteSelectedText(action: TextAction, language?: string) {
  const active = getEditorInstance()?.canvas.getActiveObject();
  if (!(active instanceof FabricText) || active.locked) throw new Error("Nejprve vyberte text.");
  const text = await requestText(action, active.text, language);
  if (getEditorInstance()?.canvas.getActiveObject() !== active) throw new Error("Během přepisování textu se změnil výběr.");
  await changeSelection({ text });
}

/** Writes a new text box from a brief and places it on the page. */
export async function writeText(brief: string) {
  const editor = getEditorInstance();
  if (!editor) return;
  const text = await requestText("write", brief);
  await loadFonts([{ family: DEFAULT_FONT_FAMILY, weight: "400", style: "normal", text }]);
  const box = new DesignTextbox(text, {
    width: editor.artboard.width * 0.7,
    fontSize: 40 * artboardScale(editor.artboard),
    fontFamily: DEFAULT_FONT_FAMILY,
    fill: "#18181b",
    textAlign: "center",
  });
  placeObject(box, "Text");
}

function remember(asset: AssetDto) {
  useUploadsStore.setState((s) => (s.loaded ? { assets: [asset, ...s.assets.filter((a) => a.id !== asset.id)] } : {}));
}

/** Generates an image, stores it as an ordinary asset, and places it like an upload. */
export async function generateAndPlace(prompt: string, aspect: ImageAspect) {
  const res = await fetch("/api/ai/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, aspect }) });
  if (!res.ok) throw await failure(res, "Obrázek se nepodařilo vygenerovat.");
  const asset = (await res.json()) as AssetDto;
  remember(asset);
  await addImageFromAsset(asset);
}

export type ImageEdit = "background" | "expand" | "erase";

function selectedImage(): FabricImage {
  const active = getEditorInstance()?.canvas.getActiveObject();
  if (!(active instanceof FabricImage) || active.locked || active.video || active.qr) throw new Error("Nejprve vyberte obrázek.");
  return active;
}

const toPng = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Obrázek PNG se nepodařilo vytvořit."))), "image/png"));

/** The selected picture's full original at its natural size, drawn on a canvas. */
export async function originalOf(image: FabricImage): Promise<HTMLCanvasElement> {
  const element = await util.loadImage(image.getSrc(false));
  const canvas = document.createElement("canvas");
  canvas.width = element.naturalWidth;
  canvas.height = element.naturalHeight;
  canvas.getContext("2d")!.drawImage(element, 0, 0);
  return canvas;
}

/**
 * Edits the selected picture with the image service and swaps the result in:
 * - background: the background (found with the phase 10 background removal) is replaced as the prompt says;
 * - expand: the picture is put in the middle of a canvas half as big again on each side and the border is filled;
 * - erase: what is painted in `eraseMask` (transparent there, at the picture's natural size) is removed.
 * The picture keeps its place and the size of its content on the page.
 */
export async function editSelectedImage(kind: ImageEdit, prompt: string, eraseMask?: Blob) {
  const editor = getEditorInstance();
  const image = selectedImage();
  if (!editor) return;
  const original = await originalOf(image);
  let source = original;
  let mask: Blob;
  let text = prompt.trim();
  if (kind === "background") {
    // The cut-out is the mask: opaque where the subject is, transparent where the new background goes.
    mask = await removeInWorker(await toPng(original), () => {});
    text = `Replace the background with: ${text || "a clean studio backdrop"}. Keep the subject exactly as it is.`;
  } else if (kind === "expand") {
    const size = expandedSize(original.width, original.height);
    source = document.createElement("canvas");
    source.width = size.width;
    source.height = size.height;
    source.getContext("2d")!.drawImage(original, size.offsetX, size.offsetY);
    mask = await toPng(source);
    text = `Extend the picture outwards into the transparent border, continuing it naturally${text ? `: ${text}` : "."}`;
  } else {
    if (!eraseMask) throw new Error("Nejprve přetřete, co se má vymazat.");
    mask = eraseMask;
    text = `Remove what is in the transparent area and fill it in naturally with the surroundings${text ? `: ${text}` : "."}`;
  }
  const form = new FormData();
  form.append("image", new File([await toPng(source)], "image.png", { type: "image/png" }));
  form.append("mask", new File([mask], "mask.png", { type: "image/png" }));
  form.append("prompt", text);
  const res = await fetch("/api/ai/image-edit", { method: "POST", body: form });
  if (!res.ok) throw await failure(res, "Obrázek se nepodařilo upravit.");
  const asset = (await res.json()) as AssetDto;
  remember(asset);
  if (!editor.canvas.getObjects().includes(image)) return;

  await recordStepAsync(async () => {
    if (kind === "expand") {
      // The content keeps its size on the page; the picture grows around it.
      const pixel = image.scaleX;
      const centre = image.getCenterPoint();
      const element = await util.loadImage(asset.url);
      image.setElement(element);
      image.set({ cropX: 0, cropY: 0, width: element.naturalWidth, height: element.naturalHeight, scaleX: pixel * (source.width / element.naturalWidth), scaleY: image.scaleY * (source.height / element.naturalHeight), clipPath: undefined });
      image.setPositionByOrigin(new Point(centre.x, centre.y), "center", "center");
    } else {
      await setImageSource(image, asset.url);
    }
    image.setCoords();
    editor.canvas.fire("object:modified", { target: image });
  });
  editor.canvas.requestRenderAll();
  refreshSelection();
}
