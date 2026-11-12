import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assetUrl } from "@/lib/assets";
import { MAX_FONT_BYTES, type CustomFontDto } from "@/lib/custom-font-types";
import { isBuiltInFamily } from "@/lib/fonts";
import { db } from "@/lib/server/db";
import { inspectFont } from "@/lib/server/font-inspect";
import { jsonError } from "@/lib/server/http";
import { deleteDataFile, writeDataFile } from "@/lib/server/storage";

type FontRow = { id: string; fontFamily: string | null; fontWeight: number | null; fontStyle: string | null; fileName: string | null };

function toDto(a: FontRow): CustomFontDto {
  return {
    id: a.id,
    family: a.fontFamily ?? "",
    weight: a.fontWeight === 700 ? "700" : "400",
    style: a.fontStyle === "italic" ? "italic" : "normal",
    url: assetUrl(a.id),
    fileName: a.fileName ?? "",
  };
}

const fontSelect = { id: true, fontFamily: true, fontWeight: true, fontStyle: true, fileName: true } as const;

/** Uploaded fonts, one entry per face, by family. */
export async function GET() {
  const fonts = await db.asset.findMany({
    where: { kind: "font" },
    select: fontSelect,
    orderBy: [{ fontFamily: "asc" }, { fontWeight: "asc" }, { fontStyle: "asc" }],
  });
  return NextResponse.json(fonts.map(toDto), { headers: { "Cache-Control": "no-store" } });
}

/** multipart/form-data with one `file` field holding a TTF, OTF or WOFF2 font. */
export async function POST(request: Request) {
  const tooLarge = () => jsonError(`Soubor písma může mít nejvýše ${MAX_FONT_BYTES / 1024 / 1024} MB`, 413);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_FONT_BYTES + 64 * 1024) return tooLarge();

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return jsonError("Očekáván formát multipart/form-data s polem file", 400);
  }
  if (!(file instanceof File)) return jsonError("Chybí pole file", 400);
  if (file.size > MAX_FONT_BYTES) return tooLarge();

  const data = new Uint8Array(await file.arrayBuffer());
  const font = inspectFont(data);
  if (!font) return jsonError("Nahrát lze jen písma TTF, OTF a WOFF2", 415);
  if (isBuiltInFamily(font.family)) return jsonError(`Písmo ${font.family} už je v seznamu písem`, 409);
  const existing = await db.asset.findFirst({
    where: { kind: "font", fontFamily: { equals: font.family, mode: "insensitive" }, fontWeight: font.weight, fontStyle: font.style },
    select: { id: true },
  });
  if (existing) return jsonError(`Tento řez písma ${font.family} už je nahraný`, 409);

  const path = `assets/${randomUUID()}.${font.extension}`;
  await writeDataFile(path, data);
  try {
    const asset = await db.asset.create({
      data: {
        kind: "font",
        path,
        mimeType: font.mimeType,
        fileSize: data.byteLength,
        fontFamily: font.family,
        fontWeight: font.weight,
        fontStyle: font.style,
        fileName: file.name.slice(0, 200),
      },
      select: fontSelect,
    });
    return NextResponse.json(toDto(asset), { status: 201 });
  } catch (error) {
    await deleteDataFile(path);
    throw error;
  }
}

/** Pages and templates with text in the family, at any depth (text inside groups too). */
async function countFamilyUses(family: string): Promise<number> {
  const [pages, templates] = await Promise.all([
    db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Page" WHERE jsonb_path_exists("canvasData", '$.**.fontFamily ? (@ == $f)', jsonb_build_object('f', ${family}::text))`,
    db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Template" WHERE jsonb_path_exists("pages", '$.**.fontFamily ? (@ == $f)', jsonb_build_object('f', ${family}::text))`,
  ]);
  return Number(pages[0].count) + Number(templates[0].count);
}

/**
 * Deletes every uploaded face of `?family=`. If pages use the family the answer is 409 with the
 * count, unless `&force=1`; their text then falls back to another font.
 */
export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const family = params.get("family");
  if (!family) return jsonError("Chybí parametr ?family=", 400);
  const faces = await db.asset.findMany({ where: { kind: "font", fontFamily: family }, select: { id: true, path: true } });
  if (faces.length === 0) return jsonError("Písmo nenalezeno", 404);
  if (params.get("force") !== "1") {
    const uses = await countFamilyUses(family);
    if (uses > 0) return NextResponse.json({ error: "Písmo se používá", uses }, { status: 409 });
  }
  await db.asset.deleteMany({ where: { id: { in: faces.map((f) => f.id) } } });
  await db.$executeRaw`UPDATE "BrandKit" SET "fonts" = array_remove("fonts", ${family}) WHERE ${family} = ANY("fonts")`;
  await Promise.all(faces.map((f) => deleteDataFile(f.path)));
  return new NextResponse(null, { status: 204 });
}
