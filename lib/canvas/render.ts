import { StaticCanvas, type FabricObject } from "fabric";
import type { CanvasData } from "@/lib/page-data";
import { enlivenCanvasObjects } from "./serialize";
import type { Size } from "./viewport-math";

/** The page colour until pages get their own background. */
export const PAGE_BACKGROUND = "#ffffff";

export type RenderOptions = {
  /** Output pixels per page pixel. */
  scale: number;
  /** Fill behind the objects; null leaves the page transparent. Defaults to the page colour. */
  background?: string | null;
  /** Leave out stand-ins for objects that failed to load (wanted in thumbnails, not in exports). */
  skipPlaceholders?: boolean;
};

/** Objects that draw nothing are not worth loading (a hidden image would still be downloaded). */
function visibleObjects(data: CanvasData): Record<string, unknown>[] {
  return data.objects.filter((o) => o.visible !== false);
}

async function pageObjects(data: CanvasData, skipPlaceholders: boolean): Promise<FabricObject[]> {
  const objects = await enlivenCanvasObjects(visibleObjects(data));
  return skipPlaceholders ? objects.filter((o) => !o.placeholderFor) : objects;
}

/**
 * Renders page data on its own off-screen canvas, independent of the editor's zoom, selection and
 * workspace, and passes the canvas to `consume`. The canvas is disposed afterwards, so its pixels are
 * released before the next page is rendered.
 */
export async function withRenderedPage<T>(
  data: CanvasData,
  artboard: Size,
  options: RenderOptions,
  consume: (element: HTMLCanvasElement) => Promise<T>,
): Promise<T> {
  const { scale } = options;
  const background = options.background === undefined ? PAGE_BACKGROUND : options.background;
  const canvas = new StaticCanvas(document.createElement("canvas"), {
    width: Math.max(1, Math.round(artboard.width * scale)),
    height: Math.max(1, Math.round(artboard.height * scale)),
    enableRetinaScaling: false,
    renderOnAddRemove: false,
    backgroundColor: background ?? "",
  });
  try {
    canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    const objects = await pageObjects(data, options.skipPlaceholders ?? false);
    if (objects.length > 0) canvas.add(...objects);
    canvas.renderAll();
    return await consume(canvas.getElement());
  } finally {
    const element = canvas.getElement();
    await canvas.dispose();
    // Browsers keep a canvas' pixel buffer until it is garbage collected; shrinking frees it now.
    element.width = 0;
    element.height = 0;
  }
}

export function canvasToBlob(element: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) =>
    element.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Vykreslení selhalo"))), type, quality),
  );
}

export function renderPageToBlob(
  data: CanvasData,
  artboard: Size,
  options: RenderOptions & { type?: string; quality?: number },
): Promise<Blob> {
  return withRenderedPage(data, artboard, options, (element) => canvasToBlob(element, options.type, options.quality));
}

/** The page as a standalone SVG document; image and font references are left for the caller to embed. */
export async function renderPageToSvg(data: CanvasData, artboard: Size): Promise<string> {
  const { width, height } = artboard;
  const canvas = new StaticCanvas(undefined, { width, height, renderOnAddRemove: false, backgroundColor: PAGE_BACKGROUND });
  try {
    const objects = await pageObjects(data, true);
    if (objects.length > 0) canvas.add(...objects);
    return canvas.toSVG({ width: `${width}px`, height: `${height}px`, viewBox: { x: 0, y: 0, width, height } });
  } finally {
    await canvas.dispose();
  }
}
