import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { cleanReply, IMAGE_SIZES, TEXT_SYSTEM, textPrompt, type AiStatus, type ImageAspect, type TextAction } from "@/lib/ai";

/**
 * The AI providers, called only from route handlers so keys never reach the browser.
 *
 * Text: Anthropic's Messages API through the official SDK. Set ANTHROPIC_API_KEY; ANTHROPIC_MODEL
 * overrides the model (default claude-opus-5-5) and ANTHROPIC_BASE_URL the endpoint.
 * Images: an OpenAI-compatible image API (Claude does not make images). Set OPENAI_API_KEY;
 * OPENAI_BASE_URL and OPENAI_IMAGE_MODEL (default gpt-image-1) override the endpoint and model.
 */

const anthropicKey = () => process.env.ANTHROPIC_API_KEY?.trim() || null;
const imageKey = () => process.env.OPENAI_API_KEY?.trim() || null;
const imageBase = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const imageModel = () => process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const textModel = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function aiStatus(): AiStatus {
  return {
    text: anthropicKey() !== null,
    image: imageKey() !== null,
    textProvider: anthropicKey() ? `Anthropic (${textModel()})` : null,
    imageProvider: imageKey() ? `${new URL(imageBase()).host} (${imageModel()})` : null,
  };
}

/** Writes or rewrites a text with Claude; returns the new text. */
export async function rewriteText(action: TextAction, text: string, language?: string): Promise<string> {
  const key = anthropicKey();
  if (!key) throw new AiError("Není nastaven ANTHROPIC_API_KEY.", 503);
  const client = new Anthropic({ apiKey: key, baseURL: process.env.ANTHROPIC_BASE_URL || undefined, maxRetries: 1, timeout: 60_000 });
  let response;
  try {
    response = await client.beta.messages.create({
      model: textModel(),
      max_tokens: 8000,
      // Short edits need little deliberation; the default (medium) would only add waiting.
      output_config: { effort: "low" },
      // If the model declines, the API retries on another model by itself.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: TEXT_SYSTEM,
      messages: [{ role: "user", content: textPrompt(action, text, language) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw new AiError("Anthropic odmítl klíč API.", 503);
    if (error instanceof Anthropic.RateLimitError) throw new AiError("Anthropic je přetížený, zkuste to za chvíli znovu.", 429);
    if (error instanceof Anthropic.APIError) throw new AiError(`Anthropic odpověděl chybou${error.status ? ` ${error.status}` : ""}.`, 502);
    throw new AiError("Anthropic není dostupný.", 502);
  }
  if (response.stop_reason === "refusal") throw new AiError("Model tento požadavek odmítl.", 422);
  const reply = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const result = cleanReply(reply);
  if (!result) throw new AiError("Model nevrátil žádný text.", 502);
  return result;
}

async function imageResponse(res: Response): Promise<Uint8Array> {
  if (res.status === 401 || res.status === 403) throw new AiError("Služba pro obrázky odmítla klíč API.", 503);
  if (res.status === 429) throw new AiError("Služba pro obrázky je přetížená, zkuste to za chvíli znovu.", 429);
  const body = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null;
  if (!res.ok) throw new AiError(body?.error?.message ? `Služba pro obrázky odpověděla: ${body.error.message}` : `Služba pro obrázky odpověděla chybou ${res.status}.`, res.status === 400 ? 422 : 502);
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new AiError("Služba pro obrázky nevrátila žádný obrázek.", 502);
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Generates an image from a prompt; returns PNG bytes. */
export async function generateImage(prompt: string, aspect: ImageAspect): Promise<Uint8Array> {
  const key = imageKey();
  if (!key) throw new AiError("Není nastaven OPENAI_API_KEY.", 503);
  const res = await fetch(`${imageBase()}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: imageModel(), prompt, size: IMAGE_SIZES[aspect], n: 1 }),
    signal: AbortSignal.timeout(180_000),
  }).catch(() => {
    throw new AiError("Služba pro obrázky není dostupná.", 502);
  });
  return imageResponse(res);
}

/** Edits an image where the mask is transparent (PNG bytes in, PNG bytes out). */
export async function editImage(image: Uint8Array, mask: Uint8Array, prompt: string): Promise<Uint8Array> {
  const key = imageKey();
  if (!key) throw new AiError("Není nastaven OPENAI_API_KEY.", 503);
  const form = new FormData();
  form.append("model", imageModel());
  form.append("prompt", prompt);
  form.append("image", new Blob([image as Uint8Array<ArrayBuffer>], { type: "image/png" }), "image.png");
  form.append("mask", new Blob([mask as Uint8Array<ArrayBuffer>], { type: "image/png" }), "mask.png");
  const res = await fetch(`${imageBase()}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(180_000),
  }).catch(() => {
    throw new AiError("Služba pro obrázky není dostupná.", 502);
  });
  return imageResponse(res);
}
