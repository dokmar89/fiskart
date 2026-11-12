import { NextResponse } from "next/server";
import { getTemplateCatalog } from "@/lib/server/template-catalog";

/** Read one catalog page; template page JSON is fetched only for returned cards. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const query = (params.get("query") ?? "").slice(0, 200);
  const category = (params.get("category") ?? "").slice(0, 200) || null;
  const preferredWidth = Number(params.get("preferredWidth"));
  const preferredHeight = Number(params.get("preferredHeight"));
  const catalog = await getTemplateCatalog({
    query, category, page,
    preferredWidth: Number.isFinite(preferredWidth) && preferredWidth > 0 ? preferredWidth : null,
    preferredHeight: Number.isFinite(preferredHeight) && preferredHeight > 0 ? preferredHeight : null,
  });
  return NextResponse.json(catalog, { headers: { "Cache-Control": "no-store" } });
}
