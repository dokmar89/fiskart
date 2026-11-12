export type StickerSettings = { color: string; thickness: number; shadowBlur: number; shadowOpacity: number };
export const DEFAULT_STICKER: StickerSettings = { color: "#ffffff", thickness: 8, shadowBlur: 8, shadowOpacity: 0.35 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function readSticker(value: unknown): StickerSettings | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const number = (key: string, fallback: number, min: number, max: number) => typeof raw[key] === "number" && Number.isFinite(raw[key]) ? clamp(raw[key], min, max) : fallback;
  return {
    color: typeof raw.color === "string" && /^#[\da-fA-F]{6}$/.test(raw.color) ? raw.color : DEFAULT_STICKER.color,
    thickness: number("thickness", DEFAULT_STICKER.thickness, 1, 32),
    shadowBlur: number("shadowBlur", DEFAULT_STICKER.shadowBlur, 0, 32),
    shadowOpacity: number("shadowOpacity", DEFAULT_STICKER.shadowOpacity, 0, 1),
  };
}

/** Circular Euclidean dilation of an alpha mask, padded so the outline can extend past the image. */
export function outlineMask(source: Uint8ClampedArray, width: number, height: number, radius: number): { alpha: Uint8ClampedArray; width: number; height: number } {
  const r = Math.max(1, Math.min(64, Math.round(radius)));
  const outWidth = width + 2 * r;
  const outHeight = height + 2 * r;
  const horizontal = new Uint8Array(outWidth * outHeight);
  horizontal.fill(r + 1);
  for (let y = 0; y < height; y++) {
    const row = (y + r) * outWidth;
    let nearest = -1e9;
    for (let x = 0; x < outWidth; x++) {
      if (x >= r && x < r + width && source[y * width + x - r] > 16) nearest = x;
      horizontal[row + x] = Math.min(r + 1, x - nearest);
    }
    nearest = 1e9;
    for (let x = outWidth - 1; x >= 0; x--) {
      if (x >= r && x < r + width && source[y * width + x - r] > 16) nearest = x;
      horizontal[row + x] = Math.min(horizontal[row + x], r + 1, nearest - x);
    }
  }
  const alpha = new Uint8ClampedArray(outWidth * outHeight);
  const squared = r * r;
  for (let y = 0; y < outHeight; y++) {
    const low = Math.max(r, y - r), high = Math.min(r + height - 1, y + r);
    for (let x = 0; x < outWidth; x++) {
      for (let yy = low; yy <= high; yy++) {
        const dx = horizontal[yy * outWidth + x];
        if (dx * dx + (yy - y) ** 2 <= squared) { alpha[y * outWidth + x] = 255; break; }
      }
    }
  }
  return { alpha, width: outWidth, height: outHeight };
}
