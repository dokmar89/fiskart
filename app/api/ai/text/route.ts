import { NextResponse } from "next/server";
import { isTextAction, MAX_TEXT } from "@/lib/ai";
import { AiError, rewriteText } from "@/lib/server/ai";
import { jsonError, readJson } from "@/lib/server/http";

/** POST {action, text, language?}: the rewritten text, from Claude. */
export async function POST(request: Request) {
  const body = (await readJson(request)) as { action?: unknown; text?: unknown; language?: unknown } | null;
  if (!body || !isTextAction(body.action) || typeof body.text !== "string" || !body.text.trim() || body.text.length > MAX_TEXT) {
    return jsonError("Očekávána akce a text o délce nejvýše 4000 znaků", 400);
  }
  try {
    const text = await rewriteText(body.action, body.text, typeof body.language === "string" ? body.language : undefined);
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof AiError) return jsonError(error.message, error.status);
    throw error;
  }
}
