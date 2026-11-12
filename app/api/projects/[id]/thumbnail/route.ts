import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { readDataFile, writeDataFile } from "@/lib/server/storage";
import { thumbnailPath } from "@/lib/server/thumbnail-path";

type Params = { params: Promise<{ id: string }> };

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { thumbnailPath: true } });
  const file = project?.thumbnailPath ? await readDataFile(project.thumbnailPath) : null;
  if (!file) return jsonError("Náhled neexistuje", 404);

  // The dashboard adds ?v=<last edit>, so a versioned URL never changes and can be cached for good.
  const versioned = new URL(request.url).searchParams.has("v");
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "no-cache",
    },
  });
}

/** Body: the PNG itself (Content-Type: image/png). */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const exists = await db.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return jsonError("Návrh nenalezen", 404);

  const data = new Uint8Array(await request.arrayBuffer());
  if (data.byteLength > MAX_THUMBNAIL_BYTES) return jsonError("Náhled je příliš velký", 413);
  if (!PNG_SIGNATURE.every((byte, i) => data[i] === byte)) return jsonError("Náhled musí být PNG", 415);

  const path = thumbnailPath(id);
  await writeDataFile(path, data);
  await db.project.update({ where: { id }, data: { thumbnailPath: path } });
  return new NextResponse(null, { status: 204 });
}
