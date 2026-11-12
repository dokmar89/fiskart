import { create } from "zustand";
import type { TemplateCatalogPage } from "@/lib/server/template-catalog";
import type { TemplateSummary } from "@/lib/templates";

type LoadOptions = { query?: string; category?: string | null; page?: number; preferredWidth?: number | null; preferredHeight?: number | null };

type TemplatesState = {
  templates: TemplateSummary[] | null;
  categories: string[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  category: string | null;
  preferredWidth: number | null;
  preferredHeight: number | null;
  loading: boolean;
  error: string | null;
  load: (options?: LoadOptions) => Promise<void>;
  /** Refresh the first page after a template has been saved. */
  added: (template: TemplateSummary) => void;
};

let latestRequest = 0;

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: null,
  categories: [],
  total: 0,
  page: 1,
  pageSize: 24,
  query: "",
  category: null,
  preferredWidth: null,
  preferredHeight: null,
  loading: false,
  error: null,
  load: async (options) => {
    const state = get();
    if (!options && (state.templates !== null || state.loading)) return;
    const query = options?.query ?? state.query;
    const category = options?.category === undefined ? state.category : options.category;
    const page = options?.page ?? state.page;
    const preferredWidth = options?.preferredWidth === undefined ? state.preferredWidth : options.preferredWidth;
    const preferredHeight = options?.preferredHeight === undefined ? state.preferredHeight : options.preferredHeight;
    const request = ++latestRequest;
    set({ query, category, page, preferredWidth, preferredHeight, loading: true, error: null });
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set("query", query.trim());
    if (category) params.set("category", category);
    if (preferredWidth && preferredHeight) {
      params.set("preferredWidth", String(preferredWidth));
      params.set("preferredHeight", String(preferredHeight));
    }
    try {
      const response = await fetch(`/api/templates/catalog?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const result = (await response.json()) as TemplateCatalogPage;
      if (request !== latestRequest) return;
      set({
        templates: result.items,
        categories: result.categories,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        loading: false,
        error: null,
      });
    } catch {
      if (request === latestRequest) set({ loading: false, error: "Šablony se nepodařilo načíst." });
    }
  },
  added: (template) => {
    set((state) => ({
      templates: [template, ...(state.templates ?? [])].slice(0, state.pageSize),
      total: state.total + 1,
      query: "",
      category: null,
      page: 1,
    }));
    void get().load({ query: "", category: null, page: 1 });
  },
}));
