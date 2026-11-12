import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { jsonError, parseTitle, readJson } from "@/lib/server/http";
import { deleteDataFile } from "@/lib/server/storage";

type Params = { params: Promise<{ id: string }> };

/** Updates project metadata. Only the title is editable so far. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await readJson(request)) as { title?: unknown } | null;
  if (!body || typeof body !== "object") return jsonError("Neplatný JSON", 400);
  const title = parseTitle(body.title);
  if (!title) return jsonError("Název nesmí být prázdný", 400);

  const exists = await db.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return jsonError("Návrh nenalezen", 404);
  const project = await db.project.update({ where: { id }, data: { title }, select: { id: true, title: true } });
  return NextResponse.json(project);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { thumbnailPath: true } });
  if (!project) return jsonError("Návrh nenalezen", 404);
  // Pages are removed by the cascade.
  await db.project.delete({ where: { id } });
  if (project.thumbnailPath) await deleteDataFile(project.thumbnailPath);
  return new NextResponse(null, { status: 204 });
}
