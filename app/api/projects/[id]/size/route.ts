import { NextResponse } from "next/server";
import { SCHEMA_VERSION, validatePageData } from "@/lib/page-data";
import { isPermutation } from "@/lib/page-ops";
import { isValidDesignSize, MAX_DESIGN_SIZE, MIN_DESIGN_SIZE } from "@/lib/presets";
import { asJson, db } from "@/lib/server/db";
import { jsonError, readJson } from "@/lib/server/http";
import { isUnit } from "@/lib/units";

type Params = { params: Promise<{ id: string }> };

/**
 * Changes the design's size and replaces every page's data with the resized version, in one
 * transaction, so the size and the pages never disagree. The editor works out the new page data;
 * the body lists every page of the project once.
 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await readJson(request)) as { width?: unknown; height?: unknown; unit?: unknown; pages?: unknown } | null;
  if (!body || typeof body !== "object") return jsonError("Neplatný JSON", 400);
  const { width, height, unit, pages } = body;
  if (!isValidDesignSize(width) || !isValidDesignSize(height)) {
    return jsonError(`Šířka a výška musí být mezi ${MIN_DESIGN_SIZE} a ${MAX_DESIGN_SIZE} px`, 400);
  }
  if (!isUnit(unit)) return jsonError("Jednotka musí být px, mm nebo in", 400);
  if (!Array.isArray(pages)) return jsonError("pages musí být pole", 400);
  const entries: { id: unknown; canvasData: unknown }[] = pages.map((p: unknown) =>
    p && typeof p === "object" ? (p as { id: unknown; canvasData: unknown }) : { id: null, canvasData: null },
  );
  for (const page of entries) {
    const invalid = validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData: page.canvasData });
    if (invalid) return jsonError(invalid, 400);
  }

  const existing = await db.page.findMany({ where: { projectId: id }, select: { id: true } });
  if (existing.length === 0) return jsonError("Návrh nenalezen", 404);
  if (!isPermutation(existing.map((p) => p.id), entries.map((p) => p.id))) {
    return jsonError("pages musí obsahovat každou stránku návrhu právě jednou", 400);
  }

  await db.$transaction([
    ...entries.map((page) =>
      db.page.update({
        where: { id: page.id as string },
        data: { schemaVersion: SCHEMA_VERSION, canvasData: asJson(page.canvasData as object) },
      }),
    ),
    db.project.update({ where: { id }, data: { width, height, unit } }),
  ]);
  return new NextResponse(null, { status: 204 });
}
