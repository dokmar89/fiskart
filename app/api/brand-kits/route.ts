import { NextResponse } from "next/server";
import { parseBrandKitInput } from "@/lib/brand";
import { checkReferences, kitSelect, toDtos } from "@/lib/server/brand";
import { db } from "@/lib/server/db";
import { jsonError, readJson } from "@/lib/server/http";

/** Every brand kit, oldest first. */
export async function GET() {
  const kits = await db.brandKit.findMany({ select: kitSelect, orderBy: { createdAt: "asc" } });
  return NextResponse.json(await toDtos(kits), { headers: { "Cache-Control": "no-store" } });
}

/** Creates a kit: { name, colors?, fonts?, logoAssetIds? }. */
export async function POST(request: Request) {
  const parsed = parseBrandKitInput(await readJson(request));
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { name, colors = [], fonts = [], logoAssetIds = [] } = parsed.value;
  if (!name) return jsonError("Zadejte název", 400);
  const problem = await checkReferences(parsed.value);
  if (problem) return jsonError(problem, 400);
  const kit = await db.brandKit.create({ data: { name, colors, fonts, logoAssetIds }, select: kitSelect });
  const [dto] = await toDtos([kit]);
  return NextResponse.json(dto, { status: 201 });
}
