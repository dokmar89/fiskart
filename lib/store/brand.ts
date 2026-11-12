import { create } from "zustand";
import type { BrandKitDto, BrandKitInput } from "@/lib/brand";
import { useUploadsStore } from "./uploads";

type BrandState = {
  kits: BrandKitDto[];
  loaded: boolean;
  error: string | null;
  /** Loads the kits once; later calls wait for the same request. */
  load: () => Promise<void>;
  create: (name: string) => Promise<BrandKitDto | null>;
  /** Changes a kit. The change shows at once and is rolled back if the server refuses it. */
  update: (id: string, patch: Partial<BrandKitInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Drops a deleted uploaded font family or upload from the kits, as the server has done. */
  forget: (what: { family: string } | { assetId: string }) => void;
  clearError: () => void;
};

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

let loading: Promise<void> | null = null;

export const useBrandStore = create<BrandState>((set, get) => ({
  kits: [],
  loaded: false,
  error: null,

  load: () => {
    loading ??= (async () => {
      try {
        const res = await fetch("/api/brand-kits", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        set({ kits: (await res.json()) as BrandKitDto[], loaded: true });
      } catch {
        loading = null;
        set({ error: "Sady značky se nepodařilo načíst." });
      }
    })();
    return loading;
  },

  create: async (name) => {
    set({ error: null });
    const res = await fetch("/api/brand-kits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      set({ error: await errorMessage(res, "Sadu značky se nepodařilo vytvořit.") });
      return null;
    }
    const kit = (await res.json()) as BrandKitDto;
    set((s) => ({ kits: [...s.kits, kit] }));
    return kit;
  },

  update: async (id, patch) => {
    const before = get().kits.find((k) => k.id === id);
    if (!before) return;
    const { logoAssetIds, ...rest } = patch;
    const uploads = useUploadsStore.getState().assets;
    const logos = logoAssetIds?.flatMap((assetId) => before.logos.find((l) => l.id === assetId) ?? uploads.find((a) => a.id === assetId) ?? []);
    set((s) => ({ error: null, kits: s.kits.map((k) => (k.id === id ? { ...k, ...rest, ...(logos && { logos }) } : k)) }));
    const res = await fetch(`/api/brand-kits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res?.ok) {
      const error = res ? await errorMessage(res, "Sadu značky se nepodařilo uložit.") : "Sadu značky se nepodařilo uložit.";
      set((s) => ({ error, kits: s.kits.map((k) => (k.id === id ? before : k)) }));
      return;
    }
    const saved = (await res.json()) as BrandKitDto;
    set((s) => ({ kits: s.kits.map((k) => (k.id === id ? saved : k)) }));
  },

  remove: async (id) => {
    const res = await fetch(`/api/brand-kits/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      set({ error: await errorMessage(res, "Sadu značky se nepodařilo smazat.") });
      return;
    }
    set((s) => ({ kits: s.kits.filter((k) => k.id !== id) }));
  },

  forget: (what) =>
    set((s) => ({
      kits: s.kits.map((k) =>
        "family" in what ? { ...k, fonts: k.fonts.filter((f) => f !== what.family) } : { ...k, logos: k.logos.filter((l) => l.id !== what.assetId) },
      ),
    })),

  clearError: () => set({ error: null }),
}));
