import { NextResponse } from "next/server";
import { withFreshIds } from "@/lib/page-ops";
import { SCHEMA_VERSION } from "@/lib/page-data";
import { asJson, db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { storedPages } from "@/lib/server/templates";

type Params = { params: Promise<{ id: string }> };

/** Starts a new design from the template: its size, unit, title and every page. */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const template = await db.template.findUnique({ where: { id } });
  if (!template) return jsonError("Šablona nenalezena", 404);
  const pages = storedPages(template.pages);
  if (pages.length === 0) return jsonError("Šablona nemá žádné stránky", 422);

  const project = await db.project.create({
    data: {
      title: template.title,
      width: template.width,
      height: template.height,
      unit: template.unit,
      pages: {
        create: pages.map((data, order) => ({
          order,
          schemaVersion: SCHEMA_VERSION,
          canvasData: asJson(withFreshIds(data, () => crypto.randomUUID())),
        })),
      },
    },
    select: { id: true },
  });
  return NextResponse.json(project, { status: 201 });
}
