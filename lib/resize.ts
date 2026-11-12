/**
 * Resizing a design: the maths applied to every page's objects. Plain JSON in, plain JSON out, no
 * Fabric or React imports, so it can be unit tested and used by templates too.
 */
import type { CanvasData } from "./page-data";

export type Size = { width: number; height: number };
type Obj = Record<string, unknown>;
type Box = { left: number; top: number; width: number; height: number };

/** Natural pixel size of an image by its `src`, when known. */
export type NaturalSizes = (src: string) => Size | undefined;

const num = (o: Obj, key: string, fallback: number) => (typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : fallback);

/** Uniform scale applied to the content: the largest that keeps the old page inside the new one. */
export function contentScale(from: Size, to: Size): number {
  return Math.min(to.width / from.width, to.height / from.height);
}

export function sameSize(a: Size, b: Size): boolean {
  return Math.abs(a.width - b.width) < 0.01 && Math.abs(a.height - b.height) < 0.01;
}

function originFactor(value: unknown): number {
  if (typeof value === "number") return value;
  if (value === "center") return 0.5;
  if (value === "right" || value === "bottom") return 1;
  return 0;
}

/** Page-space box of an object that is not rotated or skewed; null otherwise. Strokes are left out. */
export function unrotatedBounds(o: Obj): Box | null {
  const angle = ((num(o, "angle", 0) % 360) + 360) % 360;
  if (angle > 0.01 && angle < 359.99) return null;
  if (num(o, "skewX", 0) !== 0 || num(o, "skewY", 0) !== 0) return null;
  const width = num(o, "width", 0) * Math.abs(num(o, "scaleX", 1));
  const height = num(o, "height", 0) * Math.abs(num(o, "scaleY", 1));
  return {
    left: num(o, "left", 0) - originFactor(o.originX) * width,
    top: num(o, "top", 0) - originFactor(o.originY) * height,
    width,
    height,
  };
}

/**
 * A full-bleed background: marked as the background (templates), or an unrotated object covering
 * the whole page (frames excepted). Half a pixel, or 0.2 % of the side, of slack absorbs rounding from earlier edits.
 */
export function isFullBleed(o: Obj, page: Size): boolean {
  if (o.role === "background") return true;
  // A frame keeps its shape, so it is scaled like other content rather than stretched.
  if (o.frame) return false;
  const box = unrotatedBounds(o);
  if (!box) return false;
  const slackX = Math.max(0.5, page.width * 0.002);
  const slackY = Math.max(0.5, page.height * 0.002);
  return (
    box.left <= slackX &&
    box.top <= slackY &&
    box.left + box.width >= page.width - slackX &&
    box.top + box.height >= page.height - slackY
  );
}

export function isImage(o: Obj): boolean {
  return typeof o.type === "string" && o.type.toLowerCase() === "image";
}

/** Sources of the images that will be cover-cropped, so their natural sizes can be looked up first. */
export function fullBleedImageSources(pages: CanvasData[], page: Size): string[] {
  const sources = new Set<string>();
  for (const data of pages) {
    for (const o of data.objects) {
      if (isImage(o) && typeof o.src === "string" && isFullBleed(o, page)) sources.add(o.src);
    }
  }
  return [...sources];
}

export type CropRegion = { x: number; y: number; width: number; height: number };

/**
 * The part of an image that fills a box of the given aspect ratio without distortion. It keeps
 * everything that was visible (`visible`, in the image's own pixels) where the image has room,
 * showing more of it around; where it has not, it takes the largest region of that aspect the
 * image allows. The region stays centred on the old one as far as the image edges allow.
 */
export function coverCrop(visible: CropRegion, natural: Size, aspect: number): CropRegion {
  let width = Math.max(visible.width, visible.height * aspect);
  let height = width / aspect;
  if (width > natural.width || height > natural.height) {
    width = Math.min(natural.width, natural.height * aspect);
    height = width / aspect;
  }
  const clamp = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max));
  const cx = visible.x + visible.width / 2;
  const cy = visible.y + visible.height / 2;
  return {
    x: clamp(cx - width / 2, natural.width - width),
    y: clamp(cy - height / 2, natural.height - height),
    width,
    height,
  };
}

/** Stretches a background so the old page's edges land on the new page's edges. */
function stretchBackground(o: Obj, sx: number, sy: number): Obj {
  return {
    ...o,
    left: num(o, "left", 0) * sx,
    top: num(o, "top", 0) * sy,
    scaleX: num(o, "scaleX", 1) * sx,
    scaleY: num(o, "scaleY", 1) * sy,
  };
}

/**
 * Fills the box a stretched background image would take with a crop of the image at one scale.
 * Without a known natural size, only the part that was already loaded into view (the image up to
 * the far edge of the crop) is used.
 */
function coverBackgroundImage(o: Obj, sx: number, sy: number, f: number, naturalSizes?: NaturalSizes): Obj {
  const box = unrotatedBounds(o);
  if (!box || box.width <= 0 || box.height <= 0) return stretchBackground(o, sx, sy);
  const target = { left: box.left * sx, top: box.top * sy, width: box.width * sx, height: box.height * sy };
  const visible = { x: num(o, "cropX", 0), y: num(o, "cropY", 0), width: num(o, "width", 0), height: num(o, "height", 0) };
  const known = typeof o.src === "string" ? naturalSizes?.(o.src) : undefined;
  const natural = known && known.width > 0 && known.height > 0 ? known : { width: visible.x + visible.width, height: visible.y + visible.height };
  const crop = coverCrop(visible, natural, target.width / target.height);
  const scale = target.width / crop.width;
  const result: Obj = {
    ...o,
    cropX: crop.x,
    cropY: crop.y,
    width: crop.width,
    height: crop.height,
    scaleX: Math.sign(num(o, "scaleX", 1)) * scale,
    scaleY: Math.sign(num(o, "scaleY", 1)) * scale,
    left: target.left + originFactor(o.originX) * target.width,
    top: target.top + originFactor(o.originY) * target.height,
  };
  // Rounded corners are a clip path the size of the crop, in the image's own pixels (see setImageRadius).
  const clip = o.clipPath;
  if (clip && typeof clip === "object" && !Array.isArray(clip)) {
    const c = clip as Obj;
    const oldScale = Math.abs(num(o, "scaleX", 1));
    result.clipPath = {
      ...c,
      width: crop.width,
      height: crop.height,
      rx: (num(c, "rx", 0) * oldScale * f) / scale,
      ry: (num(c, "ry", 0) * oldScale * f) / scale,
    };
  }
  return result;
}

/**
 * Objects of a page moved onto a page of another size. Everything is scaled uniformly by
 * min(newW / oldW, newH / oldH) about the page origin and the scaled page is centred on the new
 * one, so the layout keeps its proportions and its place on the page. Full-bleed backgrounds are
 * stretched to cover the new page instead; background images are cover-cropped, never distorted.
 * The same size returns the objects unchanged.
 */
export function resizeObjects(objects: Obj[], from: Size, to: Size, naturalSizes?: NaturalSizes): Obj[] {
  if (sameSize(from, to)) return objects;
  const f = contentScale(from, to);
  const dx = (to.width - from.width * f) / 2;
  const dy = (to.height - from.height * f) / 2;
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  return objects.map((o) => {
    if (isFullBleed(o, from)) {
      return isImage(o) ? coverBackgroundImage(o, sx, sy, f, naturalSizes) : stretchBackground(o, sx, sy);
    }
    // left/top is a point of the object (its origin), so scaling it about the page origin along with
    // the object's own scale keeps the whole layout in proportion, whatever the origin or rotation.
    return {
      ...o,
      left: num(o, "left", 0) * f + dx,
      top: num(o, "top", 0) * f + dy,
      scaleX: num(o, "scaleX", 1) * f,
      scaleY: num(o, "scaleY", 1) * f,
    };
  });
}

export function resizePage(data: CanvasData, from: Size, to: Size, naturalSizes?: NaturalSizes): CanvasData {
  const page: CanvasData = { ...data, objects: resizeObjects(data.objects, from, to, naturalSizes) };
  if (data.guides && !sameSize(from, to)) {
    // Guides move with the content they were placed against.
    const f = contentScale(from, to);
    const dx = (to.width - from.width * f) / 2;
    const dy = (to.height - from.height * f) / 2;
    page.guides = { vertical: data.guides.vertical.map((x) => x * f + dx), horizontal: data.guides.horizontal.map((y) => y * f + dy) };
  }
  return page;
}
