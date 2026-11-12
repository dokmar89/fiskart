import "server-only";
import { randomUUID } from "node:crypto";
import { assetPosterUrl, assetUrl, type AssetDto } from "@/lib/assets";
import { inspectImage } from "@/lib/image-inspect";
import { db } from "./db";
import { deleteDataFile, writeDataFile } from "./storage";

type AssetRow = { id: string; kind: string; mimeType: string; fileSize: number; width: number | null; height: number | null; durationMs?: number | null };

export function toAssetDto(a: AssetRow): AssetDto {
  const dto: AssetDto = {
    id: a.id,
    kind: a.kind === "svg" ? "svg" : a.kind === "video" ? "video" : "image",
    url: assetUrl(a.id),
    mimeType: a.mimeType,
    fileSize: a.fileSize,
    width: a.width ?? 0,
    height: a.height ?? 0,
  };
  if (a.kind === "video") {
    dto.posterUrl = assetPosterUrl(a.id);
    dto.duration = (a.durationMs ?? 0) / 1000;
  }
  return dto;
}

/**
 * Stores image bytes (PNG, JPEG, WebP or SVG, decided by content) as an asset. A `sourceKey` marks
 * a copy of stock content; storing the same key again returns the earlier copy. Null when the
 * bytes are not a supported image.
 */
export async function storeImageAsset(bytes: Uint8Array, sourceKey?: string): Promise<AssetDto | null> {
  if (sourceKey) {
    const existing = await db.asset.findUnique({ where: { sourceKey } });
    if (existing) return toAssetDto(existing);
  }
  const image = inspectImage(bytes);
  if (!image) return null;
  const path = `assets/${randomUUID()}.${image.extension}`;
  await writeDataFile(path, image.data);
  try {
    const asset = await db.asset.create({
      data: {
        kind: image.kind,
        path,
        mimeType: image.mimeType,
        fileSize: image.data.byteLength,
        width: image.width,
        height: image.height,
        sourceKey,
      },
    });
    return toAssetDto(asset);
  } catch (error) {
    await deleteDataFile(path);
    // Two requests for the same stock item at once: the other one stored it.
    if (sourceKey) {
      const existing = await db.asset.findUnique({ where: { sourceKey } });
      if (existing) return toAssetDto(existing);
    }
    throw error;
  }
}
