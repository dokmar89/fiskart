import { NextResponse } from "next/server";
import { MAX_PROMPT } from "@/lib/ai";
import { inspectImage } from "@/lib/image-inspect";
import { storeImageAsset } from "@/lib/server/assets";
import { AiError, editImage } from "@/lib/server/ai";
import { jsonError } from "@/lib/server/http";

const LIMIT = 25 * 1024 * 1024;

/**
 * multipart: `image` and `mask` (PNGs of the same size; the image changes where the mask is
 * transparent) and `prompt`. The result is stored as an ordinary asset.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Očekáván formát multipart/form-data", 400);
  }
  const image = form.get("image");
  const mask = form.get("mask");
  const prompt = String(form.get("prompt") ?? "").trim();
  if (!(image instanceof File) || !(mask instanceof File) || !prompt || prompt.length > MAX_PROMPT) return jsonError("Očekáván obrázek, maska a zadání", 400);
  if (image.size > LIMIT || mask.size > LIMIT) return jsonError("Obrázek je příliš velký", 413);
  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const maskBytes = new Uint8Array(await mask.arrayBuffer());
  const a = inspectImage(imageBytes);
  const b = inspectImage(maskBytes);
  if (a?.mimeType !== "image/png" || b?.mimeType !== "image/png" || a.width !== b.width || a.height !== b.height) return jsonError("Obrázek a maska musí být PNG stejné velikosti", 400);
  try {
    const asset = await storeImageAsset(await editImage(imageBytes, maskBytes, prompt));
    if (!asset) return jsonError("Služba pro obrázky poslala něco, co není obrázek", 502);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (error instanceof AiError) return jsonError(error.message, error.status);
    throw error;
  }
}
