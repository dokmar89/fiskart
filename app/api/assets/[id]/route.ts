import { NextResponse } from "next/server";
import { assetUrl } from "@/lib/assets";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { dataFileSize, deleteDataFile, readDataFile, readDataFileRange } from "@/lib/server/storage";

type Params = { params: Promise<{ id: string }> };

/** Parses a single `bytes=start-end` range; null for none or anything else. */
function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match) return null;
  const [, a, b] = match;
  if (!a && !b) return "invalid";
  const start = a ? Number(a) : Math.max(0, size - Number(b));
  const end = a ? (b ? Math.min(Number(b), size - 1) : size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : "invalid";
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id }, select: { path: true, mimeType: true } });
  if (!asset) return jsonError("Soubor nenalezen", 404);

  // Videos are read in parts as they play and seek.
  const size = await dataFileSize(asset.path);
  if (size === null) return jsonError("Soubor nenalezen", 404);
  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  if (range) {
    const part = await readDataFileRange(asset.path, range.start, range.end);
    return new NextResponse(new Uint8Array(part), {
      status: 206,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(part.byteLength),
        "Content-Range": `bytes ${range.start}-${range.start + part.byteLength - 1}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const file = await readDataFile(asset.path);
  if (!file) return jsonError("Soubor nenalezen", 404);

  const headers: Record<string, string> = {
    "Content-Type": asset.mimeType,
    "Content-Length": String(file.byteLength),
    // An asset's file never changes under its id, so it can be cached for good.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  if (asset.mimeType === "image/svg+xml") {
    // Opened directly, an SVG is a document that could run script; as an image or on the canvas it never does.
    headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";
  }
  return new NextResponse(new Uint8Array(file), { headers });
}

/** Pages (and templates) that still reference the asset. */
async function countUses(id: string): Promise<number> {
  const pattern = `%${assetUrl(id)}"%`;
  const [pages, templates] = await Promise.all([
    db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Page" WHERE "canvasData"::text LIKE ${pattern}`,
    db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Template" WHERE "pages"::text LIKE ${pattern}`,
  ]);
  return Number(pages[0].count) + Number(templates[0].count);
}

/**
 * Deletes an asset. If pages still use it the answer is 409 with the count, unless `?force=1`;
 * those pages then show a placeholder where the image was.
 */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id }, select: { path: true, posterPath: true } });
  if (!asset) return jsonError("Soubor nenalezen", 404);

  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force) {
    const uses = await countUses(id);
    if (uses > 0) return NextResponse.json({ error: "Soubor se používá", uses }, { status: 409 });
  }
  await db.asset.delete({ where: { id } });
  await db.$executeRaw`UPDATE "BrandKit" SET "logoAssetIds" = array_remove("logoAssetIds", ${id}) WHERE ${id} = ANY("logoAssetIds")`;
  await deleteDataFile(asset.path);
  if (asset.posterPath) await deleteDataFile(asset.posterPath);
  return new NextResponse(null, { status: 204 });
}
