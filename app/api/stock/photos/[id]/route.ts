import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/assets";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { storeImageAsset, toAssetDto } from "@/lib/server/assets";
import { download, photoDownloadUrl, StockError } from "@/lib/server/stock";
import { stockErrorResponse } from "@/lib/server/stock-response";
import { stockKey } from "@/lib/stock";

type Params = { params: Promise<{ id: string }> };

/** POST: copies a Pexels photo into local assets (once) and returns the asset. */
export async function POST(_request: Request, { params }: Params) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return jsonError("Neplatné ID fotky", 400);
  const key = stockKey("pexels", id);
  const existing = await db.asset.findUnique({ where: { sourceKey: key } });
  if (existing) return NextResponse.json(toAssetDto(existing));
  try {
    const bytes = await download(await photoDownloadUrl(id), MAX_UPLOAD_BYTES);
    const asset = await storeImageAsset(bytes, key);
    if (!asset) return jsonError("Pexels poslal něco, co není obrázek", 502);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (error instanceof StockError) return stockErrorResponse(error);
    throw error;
  }
}
