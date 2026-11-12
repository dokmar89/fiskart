import "server-only";
import { iconifyCategory, iconifySearchTerm } from "@/lib/iconify-categories";
import { iconifySvgPath, pexelsDownloadUrl, readIconifySearch, readPexelsPage, type StockIconPage, type StockPhotoPage } from "@/lib/stock";

/**
 * Requests to the stock providers. Only route handlers call these, so the Pexels key stays on the
 * server. The base URLs can be pointed elsewhere (the e2e tests use a local stand-in).
 */

const pexelsBase = () => (process.env.PEXELS_API_URL || "https://api.pexels.com/v1").replace(/\/+$/, "");
const iconifyBase = () => (process.env.ICONIFY_API_URL || "https://api.iconify.design").replace(/\/+$/, "");
const pexelsKey = () => process.env.PEXELS_API_KEY?.trim() || null;

export const PHOTOS_PER_PAGE = 30;
export const ICONS_PER_SEARCH = 96;
const TIMEOUT_MS = 20_000;

/** The provider did not answer usefully; the message is safe to show. */
export class StockError extends Error {
  constructor(
    message: string,
    readonly code: "missing-key" | "unavailable" | "not-found",
  ) {
    super(message);
  }
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new StockError("Služba fotobanky není dostupná.", "unavailable");
  }
}

async function pexels(path: string): Promise<unknown> {
  const key = pexelsKey();
  if (!key) throw new StockError("Není nastaven PEXELS_API_KEY.", "missing-key");
  const res = await request(`${pexelsBase()}${path}`, { headers: { Authorization: key } });
  if (res.status === 404) throw new StockError("Fotka nenalezena.", "not-found");
  if (res.status === 401 || res.status === 403) throw new StockError("Pexels odmítl klíč API.", "missing-key");
  if (!res.ok) throw new StockError(`Pexels odpověděl chybou ${res.status}.`, "unavailable");
  return res.json();
}

/** A page of photos for a search, or curated photos when the query is empty. */
export async function searchPhotos(query: string, page: number): Promise<StockPhotoPage> {
  const params = new URLSearchParams({ per_page: String(PHOTOS_PER_PAGE), page: String(page) });
  if (query) params.set("query", query);
  return readPexelsPage(await pexels(`/${query ? "search" : "curated"}?${params}`), page);
}

/** Where to download a photo from, looked up by id so the browser cannot make the server fetch any URL. */
export async function photoDownloadUrl(id: number): Promise<string> {
  const url = pexelsDownloadUrl(await pexels(`/photos/${id}`));
  if (!url) throw new StockError("Pexels k této fotce nevrátil žádný obrázek.", "unavailable");
  return url;
}

export async function searchIcons(query: string, start = 0, category = "all"): Promise<StockIconPage & { previews: Record<string, string> }> {
  const selected = iconifyCategory(category);
  const params = new URLSearchParams({ query: iconifySearchTerm(query, category), limit: String(ICONS_PER_SEARCH), start: String(start) });
  if (selected.prefixes) params.set("prefixes", selected.prefixes);
  const res = await request(`${iconifyBase()}/search?${params}`);
  if (res.status === 429) throw new StockError("Iconify je právě vytížené. Zkuste to za chvíli znovu.", "unavailable");
  if (!res.ok) throw new StockError(`Iconify odpověděl chybou ${res.status}.`, "unavailable");
  const raw = await res.json().catch(() => { throw new StockError("Iconify vrátilo neplatnou odpověď.", "unavailable"); });
  const page = readIconifySearch(raw, ICONS_PER_SEARCH, start);
  // Previews come straight from Iconify: they carry no key and nothing about the design.
  const previews = Object.fromEntries(page.icons.map((icon) => [icon.name, `${iconifyBase()}${iconifySvgPath(icon.name)}`]));
  return { ...page, previews };
}

export function iconSvgUrl(name: string): string {
  return `${iconifyBase()}${iconifySvgPath(name)}`;
}

/** Downloads a file, refusing anything larger than `maxBytes`. */
export async function download(url: string, maxBytes: number): Promise<Uint8Array> {
  const res = await request(url);
  if (!res.ok || !res.body) throw new StockError(`Stahování selhalo (${res.status}).`, "unavailable");
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new StockError("Soubor je příliš velký.", "unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new StockError("Soubor je příliš velký.", "unavailable");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}
