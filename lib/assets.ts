/** Shared between the upload route and the editor. No server or Fabric imports. */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;

export type AssetDto = {
  id: string;
  kind: "image" | "svg" | "video";
  url: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  /** Videos only: the poster frame's URL and the length in seconds. */
  posterUrl?: string;
  duration?: number;
};

/** Relative URL of a video asset's poster frame. */
export function assetPosterUrl(id: string): string {
  return `/api/assets/${id}/poster`;
}

/** Relative URL of a stored asset. Pages store this, never a data URL or an absolute URL. */
export function assetUrl(id: string): string {
  return `/api/assets/${id}`;
}

/** The asset id in an asset URL (relative or absolute), or null for any other URL. */
export function assetIdFromUrl(url: string): string | null {
  const match = /\/api\/assets\/([A-Za-z0-9_-]+)(?:[?#]|$)/.exec(url);
  return match ? match[1] : null;
}
