/**
 * Colours of an SVG document and replacing them, for recolouring placed graphics. Works on the
 * text, so it runs anywhere and is unit tested; it understands fill, stroke and gradient stop
 * colours given as attributes, inline styles or in a <style> element.
 */

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  lime: "#00ff00",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  aqua: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  navy: "#000080",
  purple: "#800080",
  teal: "#008080",
  orange: "#ffa500",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  gold: "#ffd700",
};

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** A CSS colour as "#rrggbb", or null for none, url(...), currentColor and anything else not a plain colour. */
export function normalizeColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (v in NAMED) return NAMED[v];
  let m = /^#([0-9a-f]{3,4})$/.exec(v);
  if (m) return `#${[...m[1].slice(0, 3)].map((c) => c + c).join("")}`;
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) return `#${m[1]}`;
  m = /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(v);
  if (m) {
    const channel = (c: string) => (c.endsWith("%") ? (parseFloat(c) * 255) / 100 : parseFloat(c));
    return `#${hex2(channel(m[1]))}${hex2(channel(m[2]))}${hex2(channel(m[3]))}`;
  }
  return null;
}

// A colour value after `fill="`, `stroke='`, `stop-color:` and so on; group 2 is the value.
const COLOR_SLOT = /(\b(?:fill|stroke|stop-color)\s*(?:=\s*["']|:\s*))([^"';}>]+)/gi;

/** Distinct colours the SVG paints with, in order of first use. */
export function svgColors(svg: string): string[] {
  const colors = new Set<string>();
  for (const match of svg.matchAll(COLOR_SLOT)) {
    const color = normalizeColor(match[2]);
    if (color) colors.add(color);
  }
  return [...colors];
}

/** The SVG with each colour in `map` (keys and values "#rrggbb") replaced; other colours stay. */
export function recolorSvg(svg: string, map: Record<string, string>): string {
  return svg.replace(COLOR_SLOT, (whole, slot: string, value: string) => {
    const color = normalizeColor(value);
    const replacement = color ? map[color] : undefined;
    if (!replacement) return whole;
    // Keep the whitespace around the value, which may close an attribute or continue a declaration.
    const trailing = /\s*$/.exec(value)?.[0] ?? "";
    return `${slot}${replacement}${trailing}`;
  });
}

/** The colour map without entries that change nothing, or null when nothing is left. */
export function effectiveColorMap(map: Record<string, string> | undefined | null): Record<string, string> | null {
  if (!map) return null;
  const entries = Object.entries(map).filter(([from, to]) => normalizeColor(from) !== normalizeColor(to));
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
