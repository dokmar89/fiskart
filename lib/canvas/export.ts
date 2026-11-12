import { zipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import type { VideoResolution } from "@/lib/video-options";
import { exportAnimation } from "./video-export";
import {
  exportFileName,
  exportScale,
  fitsCanvas,
  outputSize,
  pdfPageSize,
  type ExportFormat,
  type PdfDpi,
  type RasterScale,
} from "@/lib/export-options";
import { fontNeedsOf, loadFonts, normalizeWeight, type FontNeed } from "@/lib/fonts";
import type { CanvasData } from "@/lib/page-data";
import { assetRefs, insertSvgStyle, parseUnicodeRange, replaceAssetRefs, textUsesRanges } from "@/lib/svg-embed";
import { useEditorStore } from "@/lib/store/editor";
import { customFontFaces } from "@/lib/store/fonts";
import { commitHistoryStep, pageSnapshot } from "./document";
import { getEditorInstance } from "./instance";
import { canvasToBlob, PAGE_BACKGROUND, renderPageToSvg, withRenderedPage } from "./render";
import type { Size } from "./viewport-math";

export type ExportOptions = {
  format: ExportFormat;
  /** Pages to export, in page order. */
  pageIds: string[];
  /** PNG only: leave the page transparent instead of white. */
  transparent: boolean;
  /** JPEG only, 0 to 1. */
  quality: number;
  scale: RasterScale;
  /** Video and GIF only. */
  resolution?: VideoResolution;
  dpi: PdfDpi;
};

export type ExportProgress = (done: number, total: number) => void;

// Each PDF page is a JPEG: a 300 DPI A4 page as PNG is several times larger, and the PDF has no
// transparency to keep anyway.
const PDF_JPEG_QUALITY = 0.92;

const EXTENSIONS: Record<ExportFormat, string> = { png: "png", jpeg: "jpg", pdf: "pdf", svg: "svg", video: "mp4", gif: "gif" };

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Export zrušen", "AbortError");
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Soubor se nepodařilo přečíst"));
    reader.readAsDataURL(blob);
  });
}

async function fetchDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nepodařilo se načíst ${url}: ${res.status}`);
  return blobToDataUrl(await res.blob());
}

type FaceRule = { family: string; weight: string; style: string; unicodeRange: string; src: string };

/** The @font-face rules of the app's own stylesheets, with absolute font URLs. */
function fontFaceRules(): FaceRule[] {
  const rules: FaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue; // a stylesheet from another origin cannot be read
    }
    for (const rule of Array.from(cssRules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const style = rule.style;
      const url = /url\(["']?([^"')]+)["']?\)/.exec(style.getPropertyValue("src"))?.[1];
      if (!url) continue;
      rules.push({
        family: style.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, ""),
        weight: normalizeWeight(style.getPropertyValue("font-weight") || "400"),
        style: style.getPropertyValue("font-style").trim() === "italic" ? "italic" : "normal",
        unicodeRange: style.getPropertyValue("unicode-range"),
        src: new URL(url, sheet.href ?? window.location.href).href,
      });
    }
  }
  return rules;
}

/** Uploaded fonts are registered through the FontFace API, so they have no stylesheet rule. */
function customFaceRules(): FaceRule[] {
  return customFontFaces().map((f) => ({
    family: f.family,
    weight: f.weight,
    style: f.style,
    unicodeRange: "",
    src: new URL(f.url, window.location.href).href,
  }));
}

/**
 * @font-face rules with the font files inlined, for the faces and character subsets the text
 * uses. A family without the exact face (no bold cut, say) embeds its closest face as it is,
 * so the viewer synthesizes the missing bold or italic from the right font, as the canvas does.
 * A family with no rule at all (a system font such as Arial in older text) is left to the viewer.
 */
async function embeddedFontCss(needs: FontNeed[]): Promise<string> {
  if (needs.length === 0) return "";
  const rules = [...fontFaceRules(), ...customFaceRules()];
  const css: string[] = [];
  for (const need of needs) {
    const family = rules.filter((r) => r.family === need.family && textUsesRanges(need.text, parseUnicodeRange(r.unicodeRange)));
    const exact = family.filter((r) => r.weight === need.weight && r.style === need.style);
    const sameWeight = family.filter((r) => r.weight === need.weight);
    const regular = family.filter((r) => r.weight === "400" && r.style === "normal");
    const faces = exact.length ? exact : sameWeight.length ? sameWeight : regular.length ? regular : family;
    for (const face of faces) {
      const data = await fetchDataUrl(face.src);
      const range = face.unicodeRange ? `unicode-range:${face.unicodeRange};` : "";
      css.push(`@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:${face.weight};src:url(${data});${range}}`);
    }
  }
  return css.join("\n");
}

async function pageToSvg(data: CanvasData, artboard: Size): Promise<string> {
  let svg = await renderPageToSvg(data, artboard);
  const images = new Map<string, string>();
  for (const url of assetRefs(svg)) images.set(url, await fetchDataUrl(url));
  svg = replaceAssetRefs(svg, images);
  const visible = data.objects.filter((o) => o.visible !== false);
  return insertSvgStyle(svg, await embeddedFontCss(fontNeedsOf(visible)));
}

async function rasterPage(data: CanvasData, artboard: Size, options: ExportOptions): Promise<Blob> {
  const jpeg = options.format === "jpeg";
  return withRenderedPage(
    data,
    artboard,
    {
      scale: options.scale,
      background: options.format === "png" && options.transparent ? null : PAGE_BACKGROUND,
      skipPlaceholders: true,
    },
    (element) => canvasToBlob(element, jpeg ? "image/jpeg" : "image/png", jpeg ? options.quality : undefined),
  );
}

async function buildPdf(pages: CanvasData[], artboard: Size, options: ExportOptions, title: string, onProgress: ExportProgress, signal?: AbortSignal) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("FiskART");
  const pageSize = pdfPageSize(artboard);
  for (const [index, data] of pages.entries()) {
    throwIfAborted(signal);
    // One page at a time: the canvas is released before the next is rendered, so a long document
    // at 300 DPI holds only the compressed JPEGs in memory.
    const jpeg = await withRenderedPage(
      data,
      artboard,
      { scale: exportScale("pdf", options.scale, options.dpi), background: PAGE_BACKGROUND, skipPlaceholders: true },
      (element) => canvasToBlob(element, "image/jpeg", PDF_JPEG_QUALITY),
    );
    const image = await pdf.embedJpg(await bytesOf(jpeg));
    pdf.addPage([pageSize.width, pageSize.height]).drawImage(image, { x: 0, y: 0, ...pageSize });
    onProgress(index + 1, pages.length);
  }
  // Without object streams the page dictionaries stay readable as plain text in the file.
  return new Blob([(await pdf.save({ useObjectStreams: false })) as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}

/** Why an export with these options cannot work, or null. */
export function exportProblem(options: Pick<ExportOptions, "format" | "scale" | "dpi">, artboard: Size): string | null {
  if (options.format === "svg" || options.format === "video" || options.format === "gif") return null;
  const size = outputSize(artboard, exportScale(options.format, options.scale, options.dpi));
  return fitsCanvas(size)
    ? null
    : `${size.width} × ${size.height} px je víc, než prohlížeč dokáže vykreslit. Zvolte ${options.format === "pdf" ? "nižší DPI" : "menší velikost"}.`;
}

/**
 * Exports pages of the open design and downloads the result: one file for one page, a zip of
 * files for several (PNG, JPEG, SVG), or one PDF with all of them. Fonts are loaded before
 * anything is rendered. Hidden objects and stand-ins for missing images are left out.
 */
export async function exportDesign(options: ExportOptions, onProgress: ExportProgress, signal?: AbortSignal): Promise<void> {
  const editor = getEditorInstance();
  if (!editor) throw new Error("Editor ještě není připravený");
  const { artboard } = editor;
  const problem = exportProblem(options, artboard);
  if (problem) throw new Error(problem);

  // The open page's latest edits become part of its snapshot first.
  commitHistoryStep();
  const state = useEditorStore.getState();
  const order = state.pageIds;
  const selected = order.filter((id) => options.pageIds.includes(id));
  const pages = selected.map((id) => JSON.parse(pageSnapshot(id) ?? '{"objects":[]}') as CanvasData);
  if (pages.length === 0) throw new Error("Nejsou vybrané žádné stránky");
  const title = state.projectTitle;
  const extension = EXTENSIONS[options.format];

  // Text is measured and drawn with whatever font is available, so every face must be ready.
  await loadFonts(fontNeedsOf(pages.flatMap((p) => p.objects)));
  await document.fonts.ready;
  onProgress(0, pages.length);

  if (options.format === "pdf") {
    download(await buildPdf(pages, artboard, options, title, onProgress, signal), exportFileName(title, extension));
    return;
  }
  if (options.format === "video" || options.format === "gif") {
    // Progress counts frames here; the pages play one after another in one file.
    const result = await exportAnimation({ kind: options.format, resolution: options.resolution ?? 1080, pages, artboard, onProgress, signal });
    download(result.blob, exportFileName(title, result.extension));
    return;
  }

  const files: { name: string; blob: Blob }[] = [];
  for (const [index, data] of pages.entries()) {
    throwIfAborted(signal);
    const blob =
      options.format === "svg"
        ? new Blob([await pageToSvg(data, artboard)], { type: "image/svg+xml" })
        : await rasterPage(data, artboard, options);
    const pageNumber = order.indexOf(selected[index]) + 1;
    files.push({ name: exportFileName(title, extension, pages.length > 1 ? pageNumber : undefined), blob });
    onProgress(index + 1, pages.length);
  }
  throwIfAborted(signal);

  if (files.length === 1) {
    download(files[0].blob, files[0].name);
    return;
  }
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const file of files) {
    // PNG and JPEG are compressed already; SVG text shrinks a lot.
    entries[file.name] = [await bytesOf(file.blob), { level: options.format === "svg" ? 6 : 0 }];
  }
  const zip = zipSync(entries);
  download(new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), exportFileName(title, "zip"));
}
