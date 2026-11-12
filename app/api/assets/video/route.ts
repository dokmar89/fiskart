import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { inspectImage } from "@/lib/image-inspect";
import { toAssetDto } from "@/lib/server/assets";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { deleteDataFile, writeDataFile } from "@/lib/server/storage";
import { detectVideo, MAX_VIDEO_BYTES } from "@/lib/video";

const POSTER_LIMIT = 10 * 1024 * 1024;

/**
 * multipart/form-data: `file` (MP4 or WebM, decided by content), `poster` (the frame the browser
 * drew, PNG or JPEG) and the browser's measurements `width`, `height` and `duration` (seconds).
 * The server cannot decode video, so it checks the container and keeps the poster beside it.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_VIDEO_BYTES + POSTER_LIMIT + 64 * 1024) return jsonError(`Video může mít nejvýše ${MAX_VIDEO_BYTES / 1024 / 1024} MB`, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Očekáván formát multipart/form-data s poli file a poster", 400);
  }
  const file = form.get("file");
  const poster = form.get("poster");
  if (!(file instanceof File) || !(poster instanceof File)) return jsonError("Chybí pole file a poster", 400);
  if (file.size > MAX_VIDEO_BYTES) return jsonError(`Video může mít nejvýše ${MAX_VIDEO_BYTES / 1024 / 1024} MB`, 413);
  if (poster.size > POSTER_LIMIT) return jsonError("Náhled videa je příliš velký", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const video = detectVideo(bytes);
  if (!video) return jsonError("Nahrát lze jen videa MP4 a WebM", 415);
  const image = inspectImage(new Uint8Array(await poster.arrayBuffer()));
  if (!image || image.kind !== "image") return jsonError("Náhled videa musí být obrázek PNG nebo JPEG", 415);
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  const duration = Number(form.get("duration"));
  if (!(width > 0 && height > 0 && width <= 8192 && height <= 8192) || !(duration >= 0 && duration < 24 * 3600)) {
    return jsonError("Neplatné rozměry nebo délka videa", 400);
  }

  const id = randomUUID();
  const path = `assets/${id}.${video.extension}`;
  const posterPath = `assets/${id}-poster.${image.extension}`;
  await writeDataFile(path, bytes);
  await writeDataFile(posterPath, image.data);
  try {
    const asset = await db.asset.create({
      data: { kind: "video", path, posterPath, mimeType: video.mimeType, fileSize: bytes.byteLength, width: Math.round(width), height: Math.round(height), durationMs: Math.round(duration * 1000) },
    });
    return NextResponse.json(toAssetDto(asset), { status: 201 });
  } catch (error) {
    await deleteDataFile(path);
    await deleteDataFile(posterPath);
    throw error;
  }
}
