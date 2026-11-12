/** Colour helpers shared by the editor and the API. No Fabric imports. */

/** Normalises CSS hex input ("abc", "#AABBCC") to "#aabbcc"; null when it is not a hex colour. */
export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(value)) return `#${[...value].map((c) => c + c).join("")}`;
  if (/^[0-9a-f]{6}$/.test(value)) return `#${value}`;
  return null;
}
