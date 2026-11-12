import { FabricImage } from "fabric";
import QRCode from "qrcode";
import { useUploadsStore } from "@/lib/store/uploads";
import { loadDesignImage, setImageSource } from "./design-image";
import { recordStepAsync } from "./document";
import { artboardScale, placeObject } from "./elements";
import { getEditorInstance } from "./instance";
import { refreshSelection } from "./selection";

export type QrSettings = { text: string; color: string; background: string | null; margin: number };

declare module "fabric" {
  interface FabricImage {
    /** QR codes only: what the code holds and how it is drawn, so it can be edited and drawn again. */
    qr?: QrSettings;
  }
  interface SerializedObjectProps {
    qr?: QrSettings;
  }
}

export const DEFAULT_QR: Omit<QrSettings, "text"> = { color: "#000000", background: "#ffffff", margin: 2 };

/** The QR code as an SVG file: vector, so it stays sharp at any export size. */
export async function qrSvg(settings: QrSettings): Promise<string> {
  return QRCode.toString(settings.text, {
    type: "svg",
    // A large natural size, so every renderer treats it as a big, sharp picture.
    width: 1024,
    errorCorrectionLevel: "M",
    margin: Math.max(0, Math.round(settings.margin)),
    color: { dark: settings.color, light: settings.background ?? "#00000000" },
  });
}

/** Stores the code as an SVG asset, like an upload, and returns its URL. */
async function uploadQr(settings: QrSettings): Promise<string> {
  const svg = await qrSvg(settings);
  const asset = await useUploadsStore.getState().upload(new File([svg], "qr-code.svg", { type: "image/svg+xml" }));
  return asset.url;
}

export async function addQrCode(text: string) {
  const editor = getEditorInstance();
  if (!editor || !text.trim()) return;
  const settings: QrSettings = { text, ...DEFAULT_QR };
  const image = await loadDesignImage(await uploadQr(settings));
  const size = 320 * artboardScale(editor.artboard);
  image.set({ scaleX: size / image.width, scaleY: size / image.height, qr: settings });
  placeObject(image, "QR kód");
}

/** Draws the selected QR code again with changed settings (a new asset), as one undo step. */
export async function updateQrCode(change: Partial<QrSettings>) {
  const editor = getEditorInstance();
  const image = editor?.canvas.getActiveObject();
  if (!editor || !(image instanceof FabricImage) || !image.qr || image.locked) return;
  const settings = { ...image.qr, ...change };
  if (!settings.text.trim()) return;
  const url = await uploadQr(settings);
  if (!editor.canvas.getObjects().includes(image)) return;
  // The code keeps its size on the page even if the number of modules changes.
  const shown = { width: image.width * image.scaleX, height: image.height * image.scaleY };
  await recordStepAsync(async () => {
    await setImageSource(image, url);
    image.set({ qr: settings, scaleX: shown.width / image.width, scaleY: shown.height / image.height, cropX: 0, cropY: 0 });
    image.setCoords();
    editor.canvas.fire("object:modified", { target: image });
  });
  editor.canvas.requestRenderAll();
  refreshSelection();
}
