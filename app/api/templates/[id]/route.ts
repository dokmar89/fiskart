import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { deleteDataFile } from "@/lib/server/storage";
import { templateSelect, toDetail } from "@/lib/server/templates";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const template = await db.template.findUnique({ where: { id }, select: templateSelect });
  if (!template) return jsonError("Šablona nenalezena", 404);
  return NextResponse.json(toDetail(template), { headers: { "Cache-Control": "no-store" } });
}

/** Deletes a saved template. Built-in ones are refused: the seed would only bring them back. */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const template = await db.template.findUnique({ where: { id }, select: { isBuiltIn: true, thumbnailPath: true } });
  if (!template) return jsonError("Šablona nenalezena", 404);
  if (template.isBuiltIn) return jsonError("Vestavěné šablony nelze smazat", 403);
  await db.template.delete({ where: { id } });
  if (template.thumbnailPath) await deleteDataFile(template.thumbnailPath);
  return new NextResponse(null, { status: 204 });
}
