import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/db", () => ({ db: { template: { findMany: vi.fn() } } }));

import { db } from "@/lib/server/db";
import { catalogSlice, getTemplateCatalog, TEMPLATE_CATALOG_PAGE_SIZE } from "./template-catalog";

const row = (id: string, title: string, category: string, opts: { builtIn?: boolean; createdAt?: string; tags?: string[]; width?: number; height?: number } = {}) => ({
  id,
  title,
  category,
  tags: opts.tags ?? [],
  width: opts.width ?? 1080,
  height: opts.height ?? 1080,
  isBuiltIn: opts.builtIn ?? true,
  createdAt: new Date(opts.createdAt ?? "2026-01-01T00:00:00.000Z"),
});

describe("catalogSlice", () => {
  it("returns 24 non-overlapping items and stable category order", () => {
    const rows = Array.from({ length: 50 }, (_, i) => row(`ig-${String(i).padStart(3, "0")}`, `Příspěvek ${i}`, "Příspěvek na Instagram"));
    const first = catalogSlice(rows, { page: 1 });
    const second = catalogSlice(rows, { page: 2 });
    expect(first.ids).toHaveLength(TEMPLATE_CATALOG_PAGE_SIZE);
    expect(second.ids).toHaveLength(TEMPLATE_CATALOG_PAGE_SIZE);
    expect(new Set([...first.ids, ...second.ids]).size).toBe(48);
    expect(first.total).toBe(50);
    expect(first.categories).toEqual(["Příspěvek na Instagram"]);
  });

  it("finds Czech text without diacritics and searches tags", () => {
    const rows = [row("cv", "Životopis architekta", "Životopis", { tags: ["práce"] }), row("poster", "Plakát", "Plakát")];
    expect(catalogSlice(rows, { query: "zivotopis prace", page: 1 }).ids).toEqual(["cv"]);
    expect(catalogSlice(rows, { query: "životopis práce", page: 1 }).ids).toEqual(["cv"]);
  });

  it("shows saved items first and sorts built-ins by category then stable creation order", () => {
    const rows = [
      row("poster", "Poster", "Plakát", { createdAt: "2026-01-02T00:00:00.000Z" }),
      row("saved-old", "Old", "Plakát", { builtIn: false, createdAt: "2026-01-03T00:00:00.000Z" }),
      row("ig-b", "B", "Příspěvek na Instagram", { createdAt: "2026-01-02T00:00:00.000Z" }),
      row("saved-new", "New", "Plakát", { builtIn: false, createdAt: "2026-01-04T00:00:00.000Z" }),
      row("ig-a", "A", "Příspěvek na Instagram", { createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(catalogSlice(rows, { page: 1 }).ids).toEqual(["saved-new", "saved-old", "ig-a", "ig-b", "poster"]);
  });

  it("returns empty results for an absent category and starts at page one for invalid numbers", () => {
    const rows = [row("a", "A", "Plakát")];
    expect(catalogSlice(rows, { category: "Není", page: 1 })).toMatchObject({ ids: [], total: 0 });
    expect(catalogSlice(rows, { page: Number.NaN }).page).toBe(1);
  });

  it("places all preferred-size templates before pagination, not only within a page", () => {
    const others = Array.from({ length: 30 }, (_, i) => row(`other-${i}`, `Other ${i}`, "Příspěvek na Instagram"));
    const preferred = [
      row("slide-a", "Slide A", "Prezentace", { width: 1920, height: 1080 }),
      row("slide-b", "Slide B", "Prezentace", { width: 1920, height: 1080 }),
    ];
    const first = catalogSlice([...others, ...preferred], { page: 1, preferredWidth: 1920, preferredHeight: 1080 });
    expect(first.ids.slice(0, 2)).toEqual(["slide-a", "slide-b"]);
    expect(first.ids).toHaveLength(24);
    expect(first.total).toBe(32);
  });
});

describe("getTemplateCatalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads page data only for returned cards", async () => {
    const many = Array.from({ length: 100 }, (_, i) => row(`id-${String(i).padStart(3, "0")}`, `Card ${i}`, "Plakát"));
    const findMany = db.template.findMany as unknown as ReturnType<typeof vi.fn>;
    findMany.mockImplementation(async (input: unknown) => {
      const args = input as { where?: { id: { in: string[] } } };
      if (!args.where) return many;
      return args.where.id.in.map((id) => ({
        ...many.find((r) => r.id === id)!, width: 1080, height: 1080, unit: "px", thumbnailPath: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"), pages: [{ objects: [] }],
      }));
    });
    const page = await getTemplateCatalog({ page: 2 });
    expect(page.items).toHaveLength(24);
    expect(page.total).toBe(100);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect((findMany.mock.calls[0][0] as { select: Record<string, unknown> }).select).not.toHaveProperty("pages");
    expect((findMany.mock.calls[1][0] as { where: { id: { in: string[] } } }).where.id.in).toHaveLength(24);
  });
});
