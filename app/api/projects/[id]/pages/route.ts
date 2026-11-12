import { NextResponse } from "next/server";
import { EMPTY_CANVAS_DATA, migratePage, SCHEMA_VERSION, validatePageData, type CanvasData } from "@/lib/page-data";
import { isPermutation } from "@/lib/page-ops";
import { asJson, db } from "@/lib/server/db";
import { jsonError, readJson } from "@/lib/server/http";

type Params = { params: Promise<{ id: string }> };

const MAX_PAGES = 200;

/** All pages of a project with their data, in page order. The editor loads them once on open. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    select: {
      pages: { orderBy: { order: "asc" }, select: { id: true, schemaVersion: true, canvasData: true } },
    },
  });
  if (!project) return jsonError("Návrh nenalezen", 404);
  return NextResponse.json(project.pages.map(migratePage), { headers: { "Cache-Control": "no-store" } });
}

/**
 * Inserts a page at `index` (0 = first), with the given canvasData or empty. Pages at or after the
 * index move down one place.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await readJson(request)) as { index?: unknown; canvasData?: unknown } | null;
  if (!body || typeof body !== "object") return jsonError("Neplatný JSON", 400);

  let canvasData: CanvasData = EMPTY_CANVAS_DATA;
  if (body.canvasData !== undefined) {
    const invalid = validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData: body.canvasData });
    if (invalid) return jsonError(invalid, 400);
    canvasData = body.canvasData as CanvasData;
  }

  const created = await db.$transaction(async (tx) => {
    const count = await tx.page.count({ where: { projectId: id } });
    if (count === 0) return null;
    if (count >= MAX_PAGES) return "full" as const;
    const index = typeof body.index === "number" && Number.isInteger(body.index) ? Math.max(0, Math.min(count, body.index)) : count;
    await tx.page.updateMany({ where: { projectId: id, order: { gte: index } }, data: { order: { increment: 1 } } });
    const page = await tx.page.create({
      data: { projectId: id, order: index, schemaVersion: SCHEMA_VERSION, canvasData: asJson(canvasData) },
      select: { id: true, schemaVersion: true, canvasData: true },
    });
    await tx.project.update({ where: { id }, data: { updatedAt: new Date() } });
    return page;
  });

  if (created === null) return jsonError("Návrh nenalezen", 404);
  if (created === "full") return jsonError(`Návrh může mít nejvýše ${MAX_PAGES} stránek`, 409);
  return NextResponse.json(created, { status: 201 });
}

/** Sets the page order. The body lists every page id of the project exactly once. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await readJson(request)) as { order?: unknown } | null;
  if (!body || !Array.isArray(body.order)) return jsonError("order musí být pole ID stránek", 400);
  const order: unknown[] = body.order;

  const pages = await db.page.findMany({ where: { projectId: id }, select: { id: true } });
  if (pages.length === 0) return jsonError("Návrh nenalezen", 404);
  if (!isPermutation(pages.map((p) => p.id), order)) return jsonError("order musí obsahovat každou stránku návrhu právě jednou", 400);

  await db.$transaction([
    ...order.map((pageId, index) => db.page.update({ where: { id: pageId }, data: { order: index } })),
    db.project.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);
  return new NextResponse(null, { status: 204 });
}
