import { classRegistry, FabricImage, util, type Abortable } from "fabric";
import { isFrameShape, type FrameShape } from "@/lib/frames";
import { effectiveColorMap, recolorSvg } from "@/lib/svg-colors";
import type { VideoSettings } from "@/lib/video";
import { outlineMask, readSticker, type StickerSettings } from "@/lib/sticker";
import { deviceOverlaySvg, renderDeviceOverlay } from "@/lib/device-overlay";
import "./vignette-filter";

declare module "fabric" {
  interface FabricObject {
    /** A frame: an empty one is a placeholder shape, a filled one an image clipped by the shape. */
    frame?: FrameShape;
    /** Corner radius as a fraction of the shorter frame edge, for photo-grid cells. */
    frameRadius?: number;
  }
  interface FabricImage {
    sticker?: StickerSettings;
    /** SVG colour replacements, original "#rrggbb" to new; only for SVG sources. */
    colorMap?: Record<string, string>;
    /**
     * Video clips (phase 17): the image draws the clip's poster frame; playing (preview,
     * presentation, video export) draws the clip itself in its place.
     */
    video?: VideoSettings;
  }
  interface SerializedObjectProps {
    frame?: string;
    frameRadius?: number;
    colorMap?: Record<string, string>;
    sticker?: StickerSettings;
  }
}

const svgTexts = new Map<string, Promise<string | null>>();

/** The text of an image source if it is an SVG, else null. Each URL is fetched once. */
export function svgSource(src: string): Promise<string | null> {
  let text = svgTexts.get(src);
  if (!text) {
    text = fetch(src)
      .then(async (res) => (res.ok && (res.headers.get("content-type") ?? "").includes("svg") ? await res.text() : null))
      .catch(() => null);
    svgTexts.set(src, text);
    // A failed request may succeed later.
    void text.then((t) => t === null && svgTexts.delete(src));
  }
  return text;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The source shown for an image: a recoloured copy of the SVG when it has a colour map. */
async function displaySource(src: string, colorMap: Record<string, string> | undefined): Promise<string> {
  const map = effectiveColorMap(colorMap);
  if (!map) return src;
  const text = await svgSource(src);
  return text === null ? src : svgDataUrl(recolorSvg(text, map));
}

/**
 * The editor's image. A recoloured SVG is drawn from an in-memory recoloured copy while its stored
 * `src` stays the uploaded asset's URL, so page JSON never holds a data URL. Registered under
 * Fabric's own "Image" type, so every page loads into it.
 */
export class DesignImage extends FabricImage {
  static type = "Image";

  /** The stored source while a recoloured copy is drawn. */
  declare sourceUrl?: string;

  /** Only the settings are stored; the outline is regenerated from the image's alpha after reload. */
  private stickerSurface?: { key: string; canvas: HTMLCanvasElement; padding: number };

  private outlineSurface() {
    if (!this.sticker || typeof document === "undefined") { this.stickerSurface = undefined; return undefined; }
    const key = [this.getSrc(false), this.cropX, this.cropY, this.width, this.height, this.sticker.color, this.sticker.thickness].join("|");
    if (this.stickerSurface?.key !== key) this.stickerSurface = makeStickerSurface(this, this.sticker, key);
    return this.stickerSurface;
  }

  _render(ctx: CanvasRenderingContext2D): void {
    if (this.sticker) {
      const surface = this.outlineSurface();
      if (surface) {
        const { canvas, padding } = surface;
        ctx.save();
        ctx.shadowColor = `rgba(0, 0, 0, ${this.sticker.shadowOpacity})`;
        ctx.shadowBlur = this.sticker.shadowBlur;
        ctx.shadowOffsetY = this.sticker.shadowBlur / 3;
        ctx.drawImage(canvas, -this.width / 2 - padding, -this.height / 2 - padding, this.width + 2 * padding, this.height + 2 * padding);
        ctx.restore();
      }
    } else this.stickerSurface = undefined;
    super._render(ctx);
    if (isFrameShape(this.frame)) renderDeviceOverlay(ctx, this.frame, this.width, this.height);
  }

  override _toSVG(): string[] {
    const image = super._toSVG();
    const overlay = isFrameShape(this.frame) ? deviceOverlaySvg(this.frame, this.width, this.height) : "";
    const surface = this.outlineSurface();
    const sticker = surface ? `<image data-sticker-outline="true" x="${-this.width / 2 - surface.padding}" y="${-this.height / 2 - surface.padding}" width="${this.width + 2 * surface.padding}" height="${this.height + 2 * surface.padding}" xlink:href="${surface.canvas.toDataURL("image/png")}" />` : "";
    return [sticker, ...image, overlay];
  }

  getSrc(filtered?: boolean): string {
    // SVG export asks for the filtered source and gets the recoloured copy, inline.
    if (!filtered && this.sourceUrl) return this.sourceUrl;
    return super.getSrc(filtered);
  }

  static async fromObject<T extends Record<string, unknown>>(object: T, options?: Abortable): Promise<DesignImage> {
    const src = typeof object.src === "string" ? object.src : "";
    const shown = await displaySource(src, object.colorMap as Record<string, string> | undefined);
    const frame = isFrameShape(object.frame) ? object.frame : undefined;
    const image = (await super.fromObject({ ...object, src: shown, frame }, options)) as DesignImage;
    if (shown !== src) image.sourceUrl = src;
    image.sticker = readSticker(object.sticker) ?? undefined;
    return image;
  }
}

function makeStickerSurface(image: DesignImage, sticker: StickerSettings, key: string): DesignImage["stickerSurface"] {
  const width = Math.max(1, image.width), height = Math.max(1, image.height);
  const ratio = Math.min(1, 1024 / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.round(width * ratio)), sampleHeight = Math.max(1, Math.round(height * ratio));
  const radius = Math.max(1, Math.min(32, Math.round(sticker.thickness * ratio)));
  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  if (!ctx) return undefined;
  try {
    ctx.drawImage(image.getElement(), image.cropX, image.cropY, width, height, 0, 0, sampleWidth, sampleHeight);
    const rgba = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const alpha = new Uint8ClampedArray(sampleWidth * sampleHeight);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    const mask = outlineMask(alpha, sampleWidth, sampleHeight, radius);
    const canvas = document.createElement("canvas");
    canvas.width = mask.width;
    canvas.height = mask.height;
    const out = canvas.getContext("2d");
    if (!out) return undefined;
    const pixels = out.createImageData(mask.width, mask.height);
    const color = sticker.color.slice(1);
    const [r, g, b] = [0, 2, 4].map((at) => parseInt(color.slice(at, at + 2), 16));
    for (let i = 0; i < mask.alpha.length; i++) {
      pixels.data[i * 4] = r;
      pixels.data[i * 4 + 1] = g;
      pixels.data[i * 4 + 2] = b;
      pixels.data[i * 4 + 3] = mask.alpha[i];
    }
    out.putImageData(pixels, 0, 0);
    return { key, canvas, padding: radius / ratio };
  } catch {
    // A cross-origin image cannot expose its alpha; the original remains intact.
    return undefined;
  }
}

classRegistry.setClass(DesignImage);

/** Loads an image from a URL into the editor's image class. */
export async function loadDesignImage(url: string): Promise<DesignImage> {
  const element = await util.loadImage(url);
  return new DesignImage(element);
}

const loads = new WeakMap<FabricImage, number>();
let loadSeq = 0;

/**
 * Points an image at another source, or redraws it with its colour map, without changing what part
 * of the picture shows or where: size, crop and filters stay. When several loads of one image
 * overlap (a colour drag), only the latest is shown; returns whether this one was.
 */
export async function setImageSource(image: FabricImage, src: string, colorMap?: Record<string, string>): Promise<boolean> {
  const token = ++loadSeq;
  loads.set(image, token);
  const map = effectiveColorMap(colorMap);
  const shown = await displaySource(src, map ?? undefined);
  const element = await util.loadImage(shown);
  if (loads.get(image) !== token) return false;
  // A source of another resolution shows the same part of the picture at the same size on the page.
  const before = image.getOriginalSize();
  const rx = before.width > 0 ? element.naturalWidth / before.width : 1;
  const ry = before.height > 0 ? element.naturalHeight / before.height : 1;
  const keep = {
    width: image.width * rx,
    height: image.height * ry,
    cropX: image.cropX * rx,
    cropY: image.cropY * ry,
    scaleX: image.scaleX / rx,
    scaleY: image.scaleY / ry,
  };
  image.setElement(element, { width: keep.width, height: keep.height });
  image.set({ ...keep, colorMap: map ?? undefined, dirty: true });
  (image as DesignImage).sourceUrl = shown !== src ? src : undefined;
  return true;
}

/** The stored source of an image (the asset URL, never a recoloured copy). */
export function storedSource(image: FabricImage): string {
  return image.getSrc(false);
}
