import { NextResponse } from "next/server";
import { searchPhotos, StockError } from "@/lib/server/stock";
import { stockErrorResponse } from "@/lib/server/stock-response";

/** GET ?q=&page=: a page of Pexels photos (curated without a query). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const page = Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get("page") ?? 1)) || 1));
  try {
    return NextResponse.json(await searchPhotos(query, page), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StockError) return stockErrorResponse(error);
    throw error;
  }
}
