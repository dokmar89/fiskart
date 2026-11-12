/** Export settings and the sizes they produce. Pure functions, unit tested. */
import { PX_PER_INCH } from "./units";

export const EXPORT_FORMATS = ["png", "jpeg", "pdf", "svg", "video", "gif"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const RASTER_SCALES = [1, 2, 3] as const;
export type RasterScale = (typeof RASTER_SCALES)[number];

export const PDF_DPIS = [96, 150, 300] as const;
export type PdfDpi = (typeof PDF_DPIS)[number];

const POINTS_PER_INCH = 72;

type Size = { width: number; height: number };

/** Output pixels per page pixel. Page geometry is at 96 DPI, so a PDF at 300 DPI renders at 300 / 96. */
export function exportScale(format: ExportFormat, scale: RasterScale, dpi: PdfDpi): number {
  if (format === "pdf") return dpi / PX_PER_INCH;
  if (format === "svg" || format === "video" || format === "gif") return 1;
  return scale;
}

/** Pixel size of a page rendered at `scale`, as the renderer rounds it. */
export function outputSize(artboard: Size, scale: number): Size {
  return { width: Math.max(1, Math.round(artboard.width * scale)), height: Math.max(1, Math.round(artboard.height * scale)) };
}

/** PDF page size in points for a page, so the PDF prints at the page's physical size. */
export function pdfPageSize(artboard: Size): Size {
  const factor = POINTS_PER_INCH / PX_PER_INCH;
  return { width: artboard.width * factor, height: artboard.height * factor };
}

// Browsers refuse to draw on canvases beyond these (Chrome's side limit; Firefox's area limit is
// about 11 180² px). A bigger canvas silently renders blank, so such exports are refused up front.
export const MAX_CANVAS_SIDE = 16_384;
export const MAX_CANVAS_AREA = 120_000_000;

export function fitsCanvas(size: Size): boolean {
  return size.width <= MAX_CANVAS_SIDE && size.height <= MAX_CANVAS_SIDE && size.width * size.height <= MAX_CANVAS_AREA;
}

/** A file name from the project title, without characters that file systems refuse. */
export function exportFileName(title: string, extension: string, pageNumber?: number): string {
  const base =
    title
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 100)
      .trim() || "návrh";
  return `${base}${pageNumber === undefined ? "" : `-${pageNumber}`}.${extension}`;
}
