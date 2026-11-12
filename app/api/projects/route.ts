import { NextResponse } from "next/server";
import { EMPTY_CANVAS_DATA, SCHEMA_VERSION } from "@/lib/page-data";
import { isValidDesignSize as isValidSize, MAX_DESIGN_SIZE, MIN_DESIGN_SIZE } from "@/lib/presets";
import { asJson, db } from "@/lib/server/db";
import { jsonError, parseTitle, readJson } from "@/lib/server/http";
import { isUnit } from "@/lib/units";

export async function POST(request: Request) {
  const body = (await readJson(request)) as { title?: unknown; width?: unknown; height?: unknown; unit?: unknown } | null;
  if (!body || typeof body !== "object") return jsonError("Neplatný JSON", 400);

  const { width, height, unit } = body;
  if (!isValidSize(width) || !isValidSize(height)) {
    return jsonError(`Šířka a výška musí být mezi ${MIN_DESIGN_SIZE} a ${MAX_DESIGN_SIZE} px`, 400);
  }
  if (!isUnit(unit)) return jsonError("Jednotka musí být px, mm, cm nebo in", 400);

  const project = await db.project.create({
    data: {
      title: parseTitle(body.title) ?? "Návrh bez názvu",
      width,
      height,
      unit,
      pages: { create: { order: 0, schemaVersion: SCHEMA_VERSION, canvasData: asJson(EMPTY_CANVAS_DATA) } },
    },
    select: { id: true },
  });

  return NextResponse.json(project, { status: 201 });
}
