import { create } from "zustand";
import { MAX_UPLOAD_BYTES, type AssetDto } from "@/lib/assets";
import { uploadVideo } from "@/lib/canvas/video-upload";
import { MAX_VIDEO_BYTES } from "@/lib/video";
import { useBrandStore } from "./brand";

type UploadsState = {
  assets: AssetDto[];
  loaded: boolean;
  /** Files currently being uploaded, for placeholder tiles. */
  pending: number;
  error: string | null;
  load: () => Promise<void>;
  /** Uploads one file and adds it to the list. Throws with a readable message on failure. */
  upload: (file: File) => Promise<AssetDto>;
  /** Deletes an asset. Returns the number of pages using it instead, unless `force`. */
  remove: (id: string, force?: boolean) => Promise<{ deleted: true } | { deleted: false; uses: number }>;
  clearError: () => void;
};

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export const useUploadsStore = create<UploadsState>((set, get) => ({
  assets: [],
  loaded: false,
  pending: 0,
  error: null,

  load: async () => {
    const res = await fetch("/api/assets", { cache: "no-store" });
    if (!res.ok) {
      set({ error: "Nahrané soubory se nepodařilo načíst." });
      return;
    }
    set({ assets: (await res.json()) as AssetDto[], loaded: true });
  },

  upload: async (file) => {
    const video = file.type.startsWith("video/");
    const limit = video ? MAX_VIDEO_BYTES : MAX_UPLOAD_BYTES;
    if (file.size > limit) {
      const message = `${file.name} je větší než ${limit / 1024 / 1024} MB.`;
      set({ error: message });
      throw new Error(message);
    }
    set((s) => ({ pending: s.pending + 1, error: null }));
    if (video) {
      try {
        const asset = await uploadVideo(file);
        set((s) => ({ assets: [asset, ...s.assets.filter((a) => a.id !== asset.id)] }));
        return asset;
      } catch (error) {
        const message = error instanceof Error ? error.message : `${file.name} se nepodařilo nahrát.`;
        set({ error: message });
        throw new Error(message);
      } finally {
        set((s) => ({ pending: s.pending - 1 }));
      }
    }
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/assets", { method: "POST", body: form });
      if (!res.ok) throw new Error(await errorMessage(res, `${file.name} se nepodařilo nahrát.`));
      const asset = (await res.json()) as AssetDto;
      set((s) => ({ assets: [asset, ...s.assets.filter((a) => a.id !== asset.id)] }));
      return asset;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${file.name} se nepodařilo nahrát.`;
      set({ error: message });
      throw new Error(message);
    } finally {
      set((s) => ({ pending: s.pending - 1 }));
    }
  },

  remove: async (id, force = false) => {
    const res = await fetch(`/api/assets/${id}${force ? "?force=1" : ""}`, { method: "DELETE" });
    if (res.status === 409) {
      const body = (await res.json()) as { uses: number };
      return { deleted: false, uses: body.uses };
    }
    if (!res.ok && res.status !== 404) throw new Error(await errorMessage(res, "Nahraný soubor se nepodařilo smazat."));
    set({ assets: get().assets.filter((a) => a.id !== id) });
    useBrandStore.getState().forget({ assetId: id });
    return { deleted: true };
  },

  clearError: () => set({ error: null }),
}));
