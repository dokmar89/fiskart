/** Brand kits, shared between the API and the editor. Pure functions, no server or Fabric imports. */
import type { AssetDto } from "./assets";
import { normalizeHex } from "./hex";

export const MAX_BRAND_COLORS = 24;
export const MAX_BRAND_FONTS = 12;
export const MAX_BRAND_LOGOS = 24;
export const MAX_BRAND_NAME_LENGTH = 100;

export type BrandKitDto = {
  id: string;
  name: string;
  /** "#rrggbb", in the order the owner arranged them; the first is the primary colour. */
  colors: string[];
  /** Family names, built in or uploaded. */
  fonts: string[];
  /** Logos that still exist, in the kit's order. */
  logos: AssetDto[];
};

/** What the editor sends to create or change a kit. Every field is optional on update. */
export type BrandKitInput = { name: string; colors: string[]; fonts: string[]; logoAssetIds: string[] };

const unique = <T,>(values: T[]) => [...new Set(values)];

/**
 * Validates a kit body. Colours are normalised to "#rrggbb" and duplicates dropped; anything that
 * is not usable is an error rather than silently left out, so the editor never loses an edit unseen.
 */
export function parseBrandKitInput(body: unknown): { ok: true; value: Partial<BrandKitInput> } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Očekáván objekt JSON" };
  const b = body as Record<string, unknown>;
  const value: Partial<BrandKitInput> = {};
  const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim().slice(0, MAX_BRAND_NAME_LENGTH) : "";
    if (!name) return { ok: false, error: "Zadejte název" };
    value.name = name;
  }
  if (b.colors !== undefined) {
    if (!isStringArray(b.colors)) return { ok: false, error: "Barvy musí být seznam barev v zápisu hex" };
    const colors = b.colors.map(normalizeHex);
    if (colors.some((c) => c === null)) return { ok: false, error: "Barvy musí být v zápisu hex" };
    value.colors = unique(colors as string[]);
    if (value.colors.length > MAX_BRAND_COLORS) return { ok: false, error: `Sada může mít nejvýše ${MAX_BRAND_COLORS} barev` };
  }
  if (b.fonts !== undefined) {
    if (!isStringArray(b.fonts)) return { ok: false, error: "Písma musí být seznam názvů rodin písem" };
    value.fonts = unique(b.fonts.map((f) => f.trim()).filter(Boolean));
    if (value.fonts.length > MAX_BRAND_FONTS) return { ok: false, error: `Sada může mít nejvýše ${MAX_BRAND_FONTS} písem` };
  }
  if (b.logoAssetIds !== undefined) {
    if (!isStringArray(b.logoAssetIds)) return { ok: false, error: "logoAssetIds musí být seznam ID souborů" };
    value.logoAssetIds = unique(b.logoAssetIds);
    if (value.logoAssetIds.length > MAX_BRAND_LOGOS) return { ok: false, error: `Sada může mít nejvýše ${MAX_BRAND_LOGOS} log` };
  }
  return { ok: true, value };
}

/**
 * The colour mapping "Apply brand colours" uses. `source` is the page's distinct colours, most used
 * first; `palette` is the kit's colours. Mapping `cycle` 0 gives the most used colour the kit's
 * first colour, the next one its second, and so on, wrapping round when the page has more colours
 * than the kit. Each further cycle shifts the palette by one, so pressing again moves every colour
 * on to the kit's next one; there are as many different mappings as the kit has colours.
 */
export function brandColorMapping(source: string[], palette: string[], cycle: number): Map<string, string> {
  const mapping = new Map<string, string>();
  if (palette.length === 0) return mapping;
  const shift = ((cycle % palette.length) + palette.length) % palette.length;
  source.forEach((color, i) => mapping.set(color, palette[(i + shift) % palette.length]));
  return mapping;
}

/** Sorts colours by how often they occur, most first; ties keep the order they were first seen. */
export function byUse(occurrences: string[]): string[] {
  const counts = new Map<string, number>();
  occurrences.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}
