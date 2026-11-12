import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { jsonError, readJson } from "@/lib/server/http";
import { storeImageAsset, toAssetDto } from "@/lib/server/assets";
import { download, iconSvgUrl, searchIcons, StockError } from "@/lib/server/stock";
import { stockErrorResponse } from "@/lib/server/stock-response";
import { isIconName, stockKey } from "@/lib/stock";

/** Icons are small; anything bigger is not what was asked for. */
const MAX_ICON_BYTES = 512 * 1024;

/** GET ?q=&category=&start=: paged Iconify search with preview URLs. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const category = params.get("category") ?? "all";
  const start = Math.min(200_000, Math.max(0, Math.floor(Number(params.get("start") ?? 0)) || 0));
  try {
    return NextResponse.json(await searchIcons(query, start, category), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StockError) return stockErrorResponse(error);
    throw error;
  }
}

/** POST {name}: copies an Iconify icon (as a black SVG) into local assets (once) and returns the asset. */
export async function POST(request: Request) {
  const body = (await readJson(request)) as { name?: unknown } | null;
  const name = body?.name;
  if (!isIconName(name)) return jsonError("Neplatný název ikony", 400);
  const key = stockKey("iconify", name);
  const existing = await db.asset.findUnique({ where: { sourceKey: key } });
  if (existing) return NextResponse.json(toAssetDto(existing));
  try {
    const asset = await storeImageAsset(await download(iconSvgUrl(name), MAX_ICON_BYTES), key);
    if (!asset || asset.kind !== "svg") return jsonError("Iconify poslal něco, co není SVG", 502);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (error instanceof StockError) return stockErrorResponse(error);
    throw error;
  }
}
