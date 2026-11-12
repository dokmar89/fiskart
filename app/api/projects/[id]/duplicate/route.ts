import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";
import { SCHEMA_VERSION, validatePageData } from "@/lib/page-data";
import { isValidDesignSize, MAX_DESIGN_SIZE, MIN_DESIGN_SIZE } from "@/lib/presets";
import { db } from "@/lib/server/db";
import { jsonError, MAX_TITLE_LENGTH, parseTitle } from "@/lib/server/http";
import { copyDataFile } from "@/lib/server/storage";
import { thumbnailPath } from "@/lib/server/thumbnail-path";
import { formatSize, isUnit, type Unit } from "@/lib/units";

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return "invalid";
  }
}

type Params = { params: Promise<{ id: string }> };

type Resized = { width: number; height: number; unit: Unit; pages: Prisma.InputJsonValue[] };

/**
 * Validates the optional body of "copy and resize": the new size and the resized data of every
 * page, worked out by the editor. Returns null for an empty body (a plain copy) or an error message.
 */
function parseResized(body: unknown): Resized | null | string {
  if (body === null || body === undefined) return null;
  if (typeof body !== "object") return "Neplatný JSON";
  const { width, height, unit, pages } = body as Record<string, unknown>;
  if (!isValidDesignSize(width) || !isValidDesignSize(height)) return `Šířka a výška musí být mezi ${MIN_DESIGN_SIZE} a ${MAX_DESIGN_SIZE} px`;
  if (!isUnit(unit)) return "Jednotka musí být px, mm nebo in";
  if (!Array.isArray(pages) || pages.length === 0) return "pages musí být neprázdné pole";
  for (const canvasData of pages) {
    const invalid = validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData });
    if (invalid) return invalid;
  }
  return { width, height, unit, pages: pages as Prisma.InputJsonValue[] };
}

/** Copies a design. With a body (`width`, `height`, `unit`, `pages`), the copy has that size and those pages instead. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const text = await request.text();
  const resized = parseResized(text.trim() === "" ? null : parseJson(text));
  if (typeof resized === "string") return jsonError(resized, 400);

  const source = await db.project.findUnique({
    where: { id },
    include: { pages: { orderBy: { order: "asc" } } },
  });
  if (!source) return jsonError("Návrh nenalezen", 404);
  if (resized && resized.pages.length !== source.pages.length) return jsonError("pages musí mít jednu položku pro každou stránku návrhu", 400);

  const title = resized
    ? `${source.title} (${formatSize(resized.width, resized.height, resized.unit)})`
    : `${source.title} (kopie)`;
  const copy = await db.project.create({
    data: {
      title: parseTitle(title)?.slice(0, MAX_TITLE_LENGTH) ?? "Návrh bez názvu",
      width: resized?.width ?? source.width,
      height: resized?.height ?? source.height,
      unit: resized?.unit ?? source.unit,
      pages: {
        create: source.pages.map((p, index) => ({
          order: p.order,
          schemaVersion: resized ? SCHEMA_VERSION : p.schemaVersion,
          canvasData: resized ? resized.pages[index] : (p.canvasData as Prisma.InputJsonValue),
        })),
      },
    },
    select: { id: true, title: true },
  });

  // A resized copy gets its thumbnail from the editor; the original's has the wrong shape.
  if (source.thumbnailPath && !resized) {
    const target = thumbnailPath(copy.id);
    try {
      await copyDataFile(source.thumbnailPath, target);
      await db.project.update({ where: { id: copy.id }, data: { thumbnailPath: target } });
    } catch {
      // A missing thumbnail is not worth failing the copy; the editor makes a new one on the next save.
    }
  }

  return NextResponse.json(copy, { status: 201 });
}
