export type TextCase = "upper";

/**
 * The text as drawn. Upper case is a display setting: the stored text keeps what was typed. Only
 * characters whose upper case has the same length are changed ("ß" stays), because Fabric maps
 * cursor positions by character index.
 */
export function applyTextCase(text: string, textCase: TextCase | undefined): string {
  if (textCase !== "upper") return text;
  let out = "";
  for (const char of text) {
    const upper = char.toLocaleUpperCase();
    out += [...upper].length === 1 ? upper : char;
  }
  return out;
}
