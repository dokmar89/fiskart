/**
 * AI tools (phase 19): what the editor can ask for and how the requests are worded. Pure, unit
 * tested; the providers are called only by route handlers (lib/server/ai.ts).
 */

export const TEXT_ACTIONS = ["shorter", "longer", "formal", "spelling", "translate", "write"] as const;
export type TextAction = (typeof TEXT_ACTIONS)[number];

export const TEXT_ACTION_LABELS: Record<TextAction, string> = {
  shorter: "Kratší",
  longer: "Delší",
  formal: "Formálněji",
  spelling: "Opravit pravopis",
  translate: "Přeložit",
  write: "Napsat text",
};

export const IMAGE_ASPECTS = ["square", "landscape", "portrait"] as const;
export type ImageAspect = (typeof IMAGE_ASPECTS)[number];
/** Sizes the image API accepts for each shape. */
export const IMAGE_SIZES: Record<ImageAspect, string> = { square: "1024x1024", landscape: "1536x1024", portrait: "1024x1536" };

export type AiStatus = {
  /** Writing and rewriting text (Anthropic). */
  text: boolean;
  /** Generating and editing images (an OpenAI-compatible image API). */
  image: boolean;
  textProvider: string | null;
  imageProvider: string | null;
};

export const MAX_TEXT = 4000;
export const MAX_PROMPT = 1000;

export const TEXT_SYSTEM =
  "You edit short texts for graphic designs: headings, captions, slogans, body copy. Reply with the resulting text only, with no quotes, notes or explanations. Keep the language of the original unless asked to translate. Keep line breaks where they still make sense.";

/** The instruction for one rewrite. `text` is the text box's current content (or a brief, for "write"). */
export function textPrompt(action: TextAction, text: string, language?: string): string {
  const body = text.slice(0, MAX_TEXT);
  switch (action) {
    case "shorter":
      return `Make this text shorter, keeping its meaning and tone:\n\n${body}`;
    case "longer":
      return `Make this text somewhat longer and richer, keeping its meaning and tone:\n\n${body}`;
    case "formal":
      return `Rewrite this text in a more formal tone:\n\n${body}`;
    case "spelling":
      return `Correct the spelling, grammar and punctuation of this text, changing nothing else:\n\n${body}`;
    case "translate":
      return `Translate this text into ${(language || "English").slice(0, 60)}:\n\n${body}`;
    case "write":
      return `Write text for a design from this brief. Keep it as short as a design needs:\n\n${body}`;
  }
}

/** The model's reply as text for the design: trimmed, without wrapping quotes. */
export function cleanReply(reply: string): string {
  let text = reply.trim();
  const pairs: [string, string][] = [['"', '"'], ["“", "”"], ["'", "'"]];
  for (const [open, close] of pairs) {
    if (text.length > 1 && text.startsWith(open) && text.endsWith(close)) text = text.slice(1, -1).trim();
  }
  return text;
}

export function isTextAction(value: unknown): value is TextAction {
  return typeof value === "string" && (TEXT_ACTIONS as readonly string[]).includes(value);
}

/**
 * A canvas size for "expand": the image placed in the middle of a canvas `factor` times its size
 * (each side), so the provider fills the new border.
 */
export function expandedSize(width: number, height: number, factor = 1.5): { width: number; height: number; offsetX: number; offsetY: number } {
  const w = Math.round(width * factor);
  const h = Math.round(height * factor);
  return { width: w, height: h, offsetX: Math.round((w - width) / 2), offsetY: Math.round((h - height) / 2) };
}
