import { NextResponse } from "next/server";
import { MAX_DESIGN_SIZE, MIN_DESIGN_SIZE } from "@/lib/presets";
import { asJson, db } from "@/lib/server/db";
import { jsonError, parseTitle, readJson } from "@/lib/server/http";
import { galleryOrder, parseTemplatePages, templateSelect, toSummary } from "@/lib/server/templates";
import { MAX_TEMPLATE_PAGES, parseTags } from "@/lib/templates";
import { isUnit } from "@/lib/units";

/** Every template without its pages, in gallery order. */
export async function GET() {
  const templates = galleryOrder(await db.template.findMany({ select: templateSelect }));
  return NextResponse.json(templates.map(toSummary), { headers: { "Cache-Control": "no-store" } });
}

const isSize = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= MIN_DESIGN_SIZE && v <= MAX_DESIGN_SIZE;

/** Saves a template: { title, category, tags, width, height, unit, pages: canvasData[] }. */
export async function POST(request: Request) {
  const body = (await readJson(request)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError("Neplatný JSON", 400);
  const title = parseTitle(body.title);
  if (!title) return jsonError("Zadejte název", 400);
  const category = parseTitle(body.category);
  if (!category) return jsonError("Zadejte kategorii", 400);
  if (!isSize(body.width) || !isSize(body.height)) return jsonError("Neplatná velikost", 400);
  if (!isUnit(body.unit)) return jsonError("Jednotka musí být px, mm nebo in", 400);
  const pages = parseTemplatePages(body.pages);
  if (!pages) return jsonError("pages musí být neprázdné pole canvasData", 400);
  if (pages.length > MAX_TEMPLATE_PAGES) return jsonError(`Šablona může mít nejvýše ${MAX_TEMPLATE_PAGES} stránek`, 400);
  const tags = parseTags(Array.isArray(body.tags) ? body.tags : typeof body.tags === "string" ? body.tags : []);

  const template = await db.template.create({
    data: { title, category, tags, width: body.width, height: body.height, unit: body.unit, pages: asJson(pages), isBuiltIn: false },
    select: templateSelect,
  });
  return NextResponse.json(toSummary(template), { status: 201 });
}
