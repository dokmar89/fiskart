import { imageSize } from "image-size";

export type InspectedImage = {
  kind: "image" | "svg";
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  /** The bytes to store; differs from the input only for SVGs that needed an explicit size. */
  data: Uint8Array;
};

const TYPES: Record<string, { mimeType: string; extension: string; kind: "image" | "svg" }> = {
  png: { mimeType: "image/png", extension: "png", kind: "image" },
  jpg: { mimeType: "image/jpeg", extension: "jpg", kind: "image" },
  webp: { mimeType: "image/webp", extension: "webp", kind: "image" },
  svg: { mimeType: "image/svg+xml", extension: "svg", kind: "svg" },
};

/**
 * Browsers give an SVG without width/height no usable intrinsic size, and canvas cannot draw it.
 * Adds width and height from the viewBox to the root element when they are missing.
 */
export function ensureSvgSize(svg: string, width: number, height: number): string {
  const open = /<svg\b[^>]*>/i.exec(svg);
  if (!open) return svg;
  const tag = open[0];
  const hasWidth = /\swidth\s*=/i.test(tag);
  const hasHeight = /\sheight\s*=/i.test(tag);
  if (hasWidth && hasHeight) return svg;
  const extra = `${hasWidth ? "" : ` width="${width}"`}${hasHeight ? "" : ` height="${height}"`}`;
  const patched = tag.replace(/^<svg\b/i, `<svg${extra}`);
  return svg.slice(0, open.index) + patched + svg.slice(open.index + tag.length);
}

/**
 * Identifies an upload by its content (not its name or declared type) and reads its size.
 * Returns null for anything that is not a PNG, JPEG, WebP or SVG with a usable size.
 */
export function inspectImage(data: Uint8Array): InspectedImage | null {
  let result: ReturnType<typeof imageSize>;
  try {
    result = imageSize(data);
  } catch {
    return null;
  }
  const type = result.type ? TYPES[result.type] : undefined;
  if (!type || !(result.width > 0) || !(result.height > 0)) return null;

  // EXIF orientations 5 to 8 rotate by 90°, and browsers apply them when drawing.
  const rotated = (result.orientation ?? 1) >= 5;
  const width = rotated ? result.height : result.width;
  const height = rotated ? result.width : result.height;

  if (type.kind === "svg") {
    const text = new TextDecoder().decode(data);
    if (!/<svg\b/i.test(text)) return null;
    const sized = ensureSvgSize(text, width, height);
    return { ...type, width, height, data: sized === text ? data : new TextEncoder().encode(sized) };
  }
  return { ...type, width, height, data };
}
