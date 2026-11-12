import { create } from "zustand";
import { MAX_FONT_BYTES, type CustomFontDto } from "@/lib/custom-font-types";
import { useBrandStore } from "./brand";

type FontsState = {
  /** Uploaded font faces, registered with the document as they arrive. */
  custom: CustomFontDto[];
  loaded: boolean;
  uploading: boolean;
  error: string | null;
  /** Loads the uploaded fonts once and registers them; later calls wait for the same request. */
  load: () => Promise<void>;
  upload: (file: File) => Promise<CustomFontDto | null>;
  /** Deletes every face of a family. Returns the number of pages using it instead, unless `force`. */
  remove: (family: string, force?: boolean) => Promise<{ deleted: true } | { deleted: false; uses: number }>;
  clearError: () => void;
};

const registered = new Map<string, FontFace>();

/**
 * Adds the faces to `document.fonts`. A FontFace made from a URL downloads nothing until text
 * uses it (or `document.fonts.load` asks for it), so registering every upload is cheap.
 */
function register(fonts: CustomFontDto[]) {
  for (const font of fonts) {
    if (registered.has(font.id)) continue;
    const face = new FontFace(font.family, `url(${font.url})`, { weight: font.weight, style: font.style });
    document.fonts.add(face);
    registered.set(font.id, face);
  }
}

function unregister(ids: string[]) {
  for (const id of ids) {
    const face = registered.get(id);
    if (face) document.fonts.delete(face);
    registered.delete(id);
  }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

let loading: Promise<void> | null = null;

export const useFontsStore = create<FontsState>((set, get) => ({
  custom: [],
  loaded: false,
  uploading: false,
  error: null,

  load: () => {
    loading ??= (async () => {
      try {
        const res = await fetch("/api/fonts", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const custom = (await res.json()) as CustomFontDto[];
        register(custom);
        set({ custom, loaded: true });
      } catch (error) {
        console.warn("Could not load uploaded fonts", error);
        loading = null;
        set({ error: "Nahraná písma se nepodařilo načíst." });
      }
    })();
    return loading;
  },

  upload: async (file) => {
    if (file.size > MAX_FONT_BYTES) {
      set({ error: `${file.name} je větší než ${MAX_FONT_BYTES / 1024 / 1024} MB.` });
      return null;
    }
    set({ uploading: true, error: null });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/fonts", { method: "POST", body: form });
      if (!res.ok) {
        set({ error: await errorMessage(res, `${file.name} se nepodařilo nahrát.`) });
        return null;
      }
      const font = (await res.json()) as CustomFontDto;
      register([font]);
      set((s) => ({ custom: [...s.custom, font].sort((a, b) => a.family.localeCompare(b.family)) }));
      return font;
    } catch {
      set({ error: `${file.name} se nepodařilo nahrát.` });
      return null;
    } finally {
      set({ uploading: false });
    }
  },

  remove: async (family, force = false) => {
    const res = await fetch(`/api/fonts?family=${encodeURIComponent(family)}${force ? "&force=1" : ""}`, { method: "DELETE" });
    if (res.status === 409) return { deleted: false, uses: ((await res.json()) as { uses: number }).uses };
    if (!res.ok && res.status !== 404) throw new Error(await errorMessage(res, "Písmo se nepodařilo smazat."));
    unregister(get().custom.filter((f) => f.family === family).map((f) => f.id));
    set((s) => ({ custom: s.custom.filter((f) => f.family !== family) }));
    useBrandStore.getState().forget({ family });
    return { deleted: true };
  },

  clearError: () => set({ error: null }),
}));

/** The uploaded faces, for embedding in SVG export. */
export function customFontFaces(): CustomFontDto[] {
  return useFontsStore.getState().custom;
}
