import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { readDataFile } from "@/lib/server/storage";

type Params = { params: Promise<{ id: string }> };

/** The poster frame of a video asset (drawn by the browser on upload). */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id }, select: { posterPath: true } });
  const file = asset?.posterPath ? await readDataFile(asset.posterPath) : null;
  if (!asset?.posterPath || !file) return jsonError("Náhled videa nenalezen", 404);
  const type = asset.posterPath.endsWith(".png") ? "image/png" : "image/jpeg";
  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": type, "Content-Length": String(file.byteLength), "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
