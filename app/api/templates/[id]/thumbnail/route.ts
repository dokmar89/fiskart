import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { readDataFile, writeDataFile } from "@/lib/server/storage";
import { templateThumbnailPath } from "@/lib/server/templates";

type Params = { params: Promise<{ id: string }> };

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const template = await db.template.findUnique({ where: { id }, select: { thumbnailPath: true } });
  const file = template?.thumbnailPath ? await readDataFile(template.thumbnailPath) : null;
  if (!file) return jsonError("Náhled neexistuje", 404);
  // The gallery adds ?v=<template version>, so a versioned URL never changes.
  const versioned = new URL(request.url).searchParams.has("v");
  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": "image/png", "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "no-cache" },
  });
}

/**
 * Body: the PNG (Content-Type: image/png). Thumbnails are rendered in the browser, which has Fabric
 * and the fonts; the gallery renders and uploads one for any template that has none.
 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const exists = await db.template.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return jsonError("Šablona nenalezena", 404);
  const data = new Uint8Array(await request.arrayBuffer());
  if (data.byteLength > MAX_THUMBNAIL_BYTES) return jsonError("Náhled je příliš velký", 413);
  if (!PNG_SIGNATURE.every((byte, i) => data[i] === byte)) return jsonError("Náhled musí být PNG", 415);
  const path = templateThumbnailPath(id);
  await writeDataFile(path, data);
  // A thumbnail is not a change of the template: updatedAt, the thumbnail version, stays as it is.
  await db.$executeRaw`UPDATE "Template" SET "thumbnailPath" = ${path} WHERE id = ${id}`;
  return new NextResponse(null, { status: 204 });
}
