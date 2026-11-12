/**
 * String helpers for making an exported SVG self-contained (images and fonts inlined), so it shows
 * the same when opened away from this app. Pure functions, unit tested.
 */

export type CodePointRange = [number, number];

/** Parses a CSS unicode-range ("U+0000-00FF, U+0131, U+4??"). An empty value covers everything. */
export function parseUnicodeRange(value: string): CodePointRange[] {
  const trimmed = value.trim();
  if (!trimmed) return [[0, 0x10ffff]];
  const ranges: CodePointRange[] = [];
  for (const part of trimmed.split(",")) {
    const token = part.trim().replace(/^u\+/i, "");
    if (!token) continue;
    if (token.includes("?")) {
      ranges.push([parseInt(token.replace(/\?/g, "0"), 16), parseInt(token.replace(/\?/g, "f"), 16)]);
    } else {
      const [start, end] = token.split("-");
      const from = parseInt(start, 16);
      ranges.push([from, end === undefined ? from : parseInt(end, 16)]);
    }
  }
  return ranges.filter(([from, to]) => Number.isFinite(from) && Number.isFinite(to));
}

/** True when any character of `text` falls within the ranges. */
export function textUsesRanges(text: string, ranges: CodePointRange[]): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (ranges.some(([from, to]) => code >= from && code <= to)) return true;
  }
  return false;
}

const ASSET_HREF = /href="(\/api\/assets\/[^"]+)"/g;

/** Distinct uploaded-asset URLs an SVG refers to. */
export function assetRefs(svg: string): string[] {
  return [...new Set([...svg.matchAll(ASSET_HREF)].map((m) => m[1]))];
}

/** Replaces asset URLs in href attributes with the given replacements (typically data URLs). */
export function replaceAssetRefs(svg: string, replacements: Map<string, string>): string {
  return svg.replace(ASSET_HREF, (whole, url: string) => {
    const replacement = replacements.get(url);
    return replacement === undefined ? whole : `href="${replacement}"`;
  });
}

/** Adds a `<style>` element as the first child of the root `<svg>` element. */
export function insertSvgStyle(svg: string, css: string): string {
  if (!css) return svg;
  const open = /<svg\b[^>]*>/.exec(svg);
  if (!open) return svg;
  const at = open.index + open[0].length;
  // CDATA, so characters such as & or < in the CSS do not break the XML.
  return `${svg.slice(0, at)}\n<style><![CDATA[${css.replace(/]]>/g, "]]]]><![CDATA[>")}]]></style>${svg.slice(at)}`;
}
