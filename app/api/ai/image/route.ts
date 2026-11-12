import { NextResponse } from "next/server";
import { IMAGE_ASPECTS, MAX_PROMPT, type ImageAspect } from "@/lib/ai";
import { storeImageAsset } from "@/lib/server/assets";
import { AiError, generateImage } from "@/lib/server/ai";
import { jsonError, readJson } from "@/lib/server/http";

/** POST {prompt, aspect}: generates an image and stores it as an ordinary asset. */
export async function POST(request: Request) {
  const body = (await readJson(request)) as { prompt?: unknown; aspect?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_PROMPT) return jsonError("Očekáváno zadání o délce nejvýše 1000 znaků", 400);
  const aspect: ImageAspect = IMAGE_ASPECTS.includes(body?.aspect as ImageAspect) ? (body!.aspect as ImageAspect) : "square";
  try {
    const asset = await storeImageAsset(await generateImage(prompt, aspect));
    if (!asset) return jsonError("Služba pro obrázky poslala něco, co není obrázek", 502);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (error instanceof AiError) return jsonError(error.message, error.status);
    throw error;
  }
}
