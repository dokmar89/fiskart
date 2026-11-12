import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { GRAPHICS } from "@/lib/graphics";
import { storeImageAsset } from "@/lib/server/assets";
import { jsonError } from "@/lib/server/http";

type Params = { params: Promise<{ id: string }> };

/**
 * POST: copies a graphic from the bundled library into local assets (once) and returns the asset,
 * so designs keep working if the library changes in a later version.
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!GRAPHICS.some((g) => g.id === id)) return jsonError("Neznámá grafika", 404);
  const bytes = await readFile(path.join(process.cwd(), "public", "graphics", `${id}.svg`));
  const asset = await storeImageAsset(new Uint8Array(bytes), `graphic:${id}`);
  if (!asset) return jsonError("Grafiku se nepodařilo načíst", 500);
  return NextResponse.json(asset);
}
