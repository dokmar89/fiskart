import { NextResponse } from "next/server";
import { parseBrandKitInput } from "@/lib/brand";
import { checkReferences, kitSelect, toDtos } from "@/lib/server/brand";
import { db } from "@/lib/server/db";
import { jsonError, readJson } from "@/lib/server/http";

type Params = { params: Promise<{ id: string }> };

/** Changes the given fields of a kit; lists are replaced as a whole. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = parseBrandKitInput(await readJson(request));
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const problem = await checkReferences(parsed.value);
  if (problem) return jsonError(problem, 400);
  const result = await db.brandKit.updateManyAndReturn({ where: { id }, data: parsed.value, select: kitSelect });
  if (result.length === 0) return jsonError("Sada značky nenalezena", 404);
  const [dto] = await toDtos(result);
  return NextResponse.json(dto);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { count } = await db.brandKit.deleteMany({ where: { id } });
  if (count === 0) return jsonError("Sada značky nenalezena", 404);
  return new NextResponse(null, { status: 204 });
}
