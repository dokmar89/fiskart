import { create } from "zustand";
import type { StockIcon, StockPhoto } from "@/lib/stock";

export type StockLoad = "idle" | "loading" | "ready" | "missing-key" | "error";

type PhotosState = {
  query: string;
  photos: StockPhoto[];
  page: number;
  hasMore: boolean;
  status: StockLoad;
  error: string | null;
};

type IconsState = {
  query: string;
  category: string;
  icons: StockIcon[];
  previews: Record<string, string>;
  start: number;
  hasMore: boolean;
  status: StockLoad;
  error: string | null;
};

type StockStore = {
  photos: PhotosState;
  icons: IconsState;
  /** Searches photos (curated when the query is empty); `more` adds the next page. */
  searchPhotos: (query: string, more?: boolean) => Promise<void>;
  searchIcons: (query: string, category?: string, more?: boolean) => Promise<void>;
};

async function errorOf(res: Response): Promise<{ code: string; message: string }> {
  const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  return { code: body.code ?? "unavailable", message: body.error ?? "Služba fotobanky neodpověděla." };
}

let photoRequest = 0;
let iconRequest = 0;

/** Search results, kept while the panels are closed and reopened. */
export const useStockStore = create<StockStore>((set, get) => ({
  photos: { query: "", photos: [], page: 0, hasMore: false, status: "idle", error: null },
  icons: { query: "", category: "all", icons: [], previews: {}, start: 0, hasMore: false, status: "idle", error: null },

  searchPhotos: async (query, more = false) => {
    const current = get().photos;
    const page = more ? current.page + 1 : 1;
    const request = ++photoRequest;
    set({ photos: { ...current, query, status: "loading", error: null, ...(more ? {} : { photos: [], page: 0, hasMore: false }) } });
    const params = new URLSearchParams({ q: query, page: String(page) });
    const res = await fetch(`/api/stock/photos?${params}`).catch(() => null);
    if (request !== photoRequest) return;
    if (!res?.ok) {
      const { code, message } = res ? await errorOf(res) : { code: "unavailable", message: "Aplikace není dostupná." };
      set({ photos: { ...get().photos, status: code === "missing-key" ? "missing-key" : "error", error: message } });
      return;
    }
    const body = (await res.json()) as { photos: StockPhoto[]; page: number; hasMore: boolean };
    const before = more ? get().photos.photos : [];
    const seen = new Set(before.map((p) => p.id));
    set({
      photos: {
        query,
        photos: [...before, ...body.photos.filter((p) => !seen.has(p.id))],
        page: body.page,
        hasMore: body.hasMore,
        status: "ready",
        error: null,
      },
    });
  },

  searchIcons: async (query, category = "all", more = false) => {
    const current = get().icons;
    if (more && (current.query !== query || current.category !== category || !current.hasMore || current.status === "loading")) return;
    const start = more ? current.start : 0;
    const request = ++iconRequest;
    set({ icons: { ...(more ? current : { query, category, icons: [], previews: {}, start: 0, hasMore: false }), status: "loading", error: null } });
    const res = await fetch(`/api/stock/icons?${new URLSearchParams({ q: query, category, start: String(start) })}`).catch(() => null);
    if (request !== iconRequest) return;
    if (!res?.ok) {
      const { message } = res ? await errorOf(res) : { message: "Aplikace není dostupná." };
      set({ icons: { ...get().icons, status: "error", error: message } });
      return;
    }
    const body = (await res.json().catch(() => null)) as { icons?: StockIcon[]; previews?: Record<string, string>; hasMore?: boolean } | null;
    if (!body || !Array.isArray(body.icons)) {
      set({ icons: { ...get().icons, status: "error", error: "Iconify vrátilo neplatnou odpověď." } });
      return;
    }
    const before = more ? get().icons.icons : [];
    const seen = new Set(before.map((icon) => icon.name));
    set({ icons: {
      query,
      category,
      icons: [...before, ...body.icons.filter((icon) => !seen.has(icon.name))],
      previews: { ...(more ? get().icons.previews : {}), ...body.previews },
      start: start + body.icons.length,
      hasMore: body.icons.length > 0 && body.hasMore === true,
      status: "ready",
      error: null,
    } });
  },
}));
