/**
 * Stock photos (Pexels) and icons (Iconify): the shapes the editor sees, and reading the providers'
 * responses into them. Pure; the requests themselves are made by route handlers only, so the
 * Pexels key never reaches the browser.
 */

export type StockPhoto = {
  /** Pexels photo id. */
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographerUrl: string;
  /** The photo's page on Pexels, for credit. */
  pageUrl: string;
  /** A small preview for the panel. */
  thumb: string;
  /** Average colour, shown while the preview loads. */
  color: string;
};

export type StockPhotoPage = { photos: StockPhoto[]; page: number; hasMore: boolean };

export type StockIcon = {
  /** Iconify name, "prefix:name". */
  name: string;
  /** The icon set's name and licence, for credit. */
  set: string;
  license: string;
};

export type StockIconPage = { icons: StockIcon[]; hasMore: boolean };

/** Why a stock tab cannot show anything; the panel explains each. */
export type StockError = "missing-key" | "unavailable";

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** One photo from a Pexels API response, or null if it lacks what the editor needs. */
export function readPexelsPhoto(raw: unknown): StockPhoto | null {
  const p = obj(raw);
  const src = obj(p.src);
  const id = num(p.id);
  const thumb = str(src.medium) || str(src.small);
  if (!id || !thumb) return null;
  return {
    id,
    width: num(p.width),
    height: num(p.height),
    alt: str(p.alt),
    photographer: str(p.photographer),
    photographerUrl: str(p.photographer_url),
    pageUrl: str(p.url),
    thumb,
    color: str(p.avg_color, "#a1a1aa"),
  };
}

/** A Pexels search or curated response. */
export function readPexelsPage(raw: unknown, page: number): StockPhotoPage {
  const body = obj(raw);
  const photos = (Array.isArray(body.photos) ? body.photos : []).map(readPexelsPhoto).filter((p): p is StockPhoto => p !== null);
  return { photos, page, hasMore: typeof body.next_page === "string" && body.next_page.length > 0 };
}

/**
 * The URL to copy a Pexels photo from: a large rendition (at most 2400 px on the long side), which
 * is plenty for screen designs and A4 at 200 DPI, rather than originals that can exceed the upload
 * limit.
 */
export function pexelsDownloadUrl(raw: unknown): string | null {
  const src = obj(obj(raw).src);
  const original = str(src.original);
  if (original) {
    const url = new URL(original);
    url.searchParams.set("auto", "compress");
    url.searchParams.set("cs", "tinysrgb");
    url.searchParams.set("fit", "max");
    url.searchParams.set("w", "2400");
    url.searchParams.set("h", "2400");
    return url.toString();
  }
  return str(src.large2x) || str(src.large) || null;
}

/** Iconify icon names look like "mdi:home" or "fluent-emoji-flat:cat". */
export function isIconName(name: unknown): name is string {
  return typeof name === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(name);
}

/** An Iconify /search response. */
export function readIconifySearch(raw: unknown, limit: number, start = 0): StockIconPage {
  const body = obj(raw);
  const collections = obj(body.collections);
  const names = [...new Set((Array.isArray(body.icons) ? body.icons : []).filter(isIconName))];
  const icons = names.map((name) => {
    const info = obj(collections[name.split(":")[0]]);
    return { name, set: str(info.name, name.split(":")[0]), license: str(obj(info.license).title, "Neznámá licence") };
  });
  // Iconify can report either the full result count or a page-sized count. A full
  // page may have another page; a shorter page is final regardless of `total`.
  return { icons, hasMore: names.length >= limit || (names.length > 0 && num(body.total) > start + names.length) };
}

/** The path of an icon's SVG on the Iconify API, in black so it can be recoloured like any SVG. */
export function iconifySvgPath(name: string): string {
  const [prefix, icon] = name.split(":");
  return `/${encodeURIComponent(prefix)}/${encodeURIComponent(icon)}.svg?color=%23000000&height=256`;
}

/** Key that marks an asset copied from a stock source, so placing it again reuses the copy. */
export function stockKey(source: "pexels" | "iconify", id: string | number): string {
  return `${source}:${id}`;
}
