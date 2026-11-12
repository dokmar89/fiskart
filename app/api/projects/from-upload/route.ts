import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/assets";
import { SCHEMA_VERSION } from "@/lib/page-data";
import { MAX_DESIGN_SIZE, MIN_DESIGN_SIZE } from "@/lib/presets";
import { storeImageAsset } from "@/lib/server/assets";
import { asJson, db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { deleteDataFile } from "@/lib/server/storage";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) return jsonError("Soubor je příliš velký.", 413);
  let file: FormDataEntryValue | null;
  try { file = (await request.formData()).get("file"); }
  catch { return jsonError("Očekáván obrázek v poli file.", 400); }
  if (!(file instanceof File)) return jsonError("Chybí obrázek.", 400);
  if (file.size > MAX_UPLOAD_BYTES) return jsonError("Soubor je příliš velký.", 413);

  const asset = await storeImageAsset(new Uint8Array(await file.arrayBuffer()));
  if (!asset) return jsonError("Nahrát lze jen obrázky PNG, JPEG, WebP a SVG.", 415);
  try {
    const scale = Math.min(1, MAX_DESIGN_SIZE / Math.max(asset.width, asset.height));
    const imageWidth = asset.width * scale;
    const imageHeight = asset.height * scale;
    const width = Math.max(MIN_DESIGN_SIZE, imageWidth);
    const height = Math.max(MIN_DESIGN_SIZE, imageHeight);
    const project = await db.project.create({
      data: {
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Nahraný obrázek",
        width, height, unit: "px",
        pages: { create: { order: 0, schemaVersion: SCHEMA_VERSION, canvasData: asJson({ objects: [{ type: "Image", version: "6.9.0", src: asset.url, left: (width - imageWidth) / 2, top: (height - imageHeight) / 2, width: asset.width, height: asset.height, scaleX: scale, scaleY: scale, originX: "left", originY: "top", name: "Nahraný obrázek" }] }) } },
      },
      select: { id: true },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const row = await db.asset.findUnique({ where: { id: asset.id }, select: { path: true } });
    if (row) { await db.asset.delete({ where: { id: asset.id } }); await deleteDataFile(row.path); }
    throw error;
  }
}
