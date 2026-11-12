import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/assets";
import { storeImageAsset, toAssetDto } from "@/lib/server/assets";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";

const tooLarge = () => jsonError(`Soubor může mít nejvýše ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`, 413);

/** Uploaded images, SVGs and videos (stock copies included), newest first. */
export async function GET() {
  const assets = await db.asset.findMany({
    where: { kind: { in: ["image", "svg", "video"] } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(assets.map(toAssetDto), { headers: { "Cache-Control": "no-store" } });
}

/** multipart/form-data with one `file` field. The type is decided by the content, not the name. */
export async function POST(request: Request) {
  // Refuse obviously oversized bodies before reading them.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return tooLarge();

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return jsonError("Očekáván formát multipart/form-data s polem file", 400);
  }
  if (!(file instanceof File)) return jsonError("Chybí pole file", 400);
  if (file.size > MAX_UPLOAD_BYTES) return tooLarge();

  const asset = await storeImageAsset(new Uint8Array(await file.arrayBuffer()));
  if (!asset) return jsonError("Nahrát lze jen obrázky PNG, JPEG, WebP a SVG", 415);
  return NextResponse.json(asset, { status: 201 });
}
