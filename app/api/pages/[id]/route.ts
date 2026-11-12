import { NextResponse } from "next/server";
import { migratePage, validatePageData, type PageData } from "@/lib/page-data";
import { asJson, db } from "@/lib/server/db";
import { jsonError, readJson } from "@/lib/server/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const page = await db.page.findUnique({
    where: { id },
    select: { id: true, projectId: true, order: true, schemaVersion: true, canvasData: true },
  });
  if (!page) return jsonError("Stránka nenalezena", 404);
  return NextResponse.json(migratePage(page), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson(request);
  const invalid = validatePageData(body);
  if (invalid) return jsonError(invalid, 400);
  const { schemaVersion, canvasData } = body as PageData;

  const page = await db.page.findUnique({ where: { id }, select: { projectId: true } });
  if (!page) return jsonError("Stránka nenalezena", 404);

  // Touch the project too, so the dashboard orders by the last edit.
  await db.$transaction([
    db.page.update({ where: { id }, data: { schemaVersion: migratePage({ schemaVersion, canvasData }).schemaVersion, canvasData: asJson(canvasData) } }),
    db.project.update({ where: { id: page.projectId }, data: { updatedAt: new Date() } }),
  ]);
  return new NextResponse(null, { status: 204 });
}

/** Deletes a page and closes the gap in the order. The last page of a design cannot be deleted. */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const result = await db.$transaction(async (tx) => {
    const page = await tx.page.findUnique({ where: { id }, select: { projectId: true, order: true } });
    if (!page) return "missing" as const;
    const count = await tx.page.count({ where: { projectId: page.projectId } });
    if (count <= 1) return "last" as const;
    await tx.page.delete({ where: { id } });
    await tx.page.updateMany({
      where: { projectId: page.projectId, order: { gt: page.order } },
      data: { order: { decrement: 1 } },
    });
    await tx.project.update({ where: { id: page.projectId }, data: { updatedAt: new Date() } });
    return "deleted" as const;
  });
  if (result === "missing") return jsonError("Stránka nenalezena", 404);
  if (result === "last") return jsonError("Poslední stránku návrhu nelze smazat", 409);
  return new NextResponse(null, { status: 204 });
}
